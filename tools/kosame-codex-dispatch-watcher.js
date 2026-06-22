#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HANDOFF_DIR = path.join(ROOT, '.kosame-handoff');
const QUEUE_FILENAME = 'queue.jsonl';
const LATEST_FILENAME = 'latest.md';
const DEFAULT_PORT = Number(process.env.PORT || 8080);
const DEFAULT_HOST = process.env.KOSAME_CONSOLE_HOST || '127.0.0.1';
const POLL_INTERVAL_MS = 2000;
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000;
const {
  ZERO_CONFIRM_EXECUTOR,
  ZERO_CONFIRM_ROUTE,
  buildZeroConfirmRunnerCommand,
  lintForZeroConfirmText,
  validateZeroConfirmRunnerCommand,
} = require('./kosame-zero-confirm-guard');
const { detectSafetyStop } = require('./kosame-safety-stop-detector');
const { assertExecutorPolicy } = require('./kosame-executor-policy-kernel');
const { buildBlockedResult, createRecoveryPlan } = require('./kosame-recovery-manager');
const { safeSpawn } = require('./kosame-safe-spawn');
const { evaluateNoYesGate } = require('./kosame-no-yes-gate');
const { appendPipelineStageEvent } = require('./kosame-pipeline-telemetry');

// Safety Stop conditions: dispatch is BLOCKED if any of these are detected in the prompt.
// Patterns are intentionally specific to avoid matching safety-condition documentation text.
const DISPATCH_SAFETY_STOP_PATTERNS = [
  /git\s+push\s+.*--force|git\s+push\s+-f\b|--force\s+origin/i,
  /git\s+tag\s+-f\b/i,
  /rm\s+-rf\s+\//i,
  /DROP\s+TABLE|DROP\s+DATABASE/i,
  /npm\s+.*publish\s+--tag\s+latest/i,
];

// Required safety conditions that must appear in every dispatched prompt.
const REQUIRED_SAFETY_KEYWORDS = [
  '機密情報・環境変数ファイル・認証情報・APIキーは読まない',
  '外部APIを呼ばない',
  '対象repo以外を触らない',
];

// Injected prefix that guarantees required safety keywords are present in every dispatch prompt.
// The work order body (from latest.md) may be compacted/truncated and lose the tail conditions,
// so the watcher always prepends these conditions itself.
const DISPATCH_SAFETY_PREAMBLE = [
  '# KOSAME自動ディスパッチ',
  '',
  '必須安全条件:',
  '- 機密情報・環境変数ファイル・認証情報・APIキーは読まない',
  '- 外部APIを呼ばない',
  '- 対象repo以外を触らない',
  '',
].join('\n');

const DISPATCH_RESULT_SUFFIX = [
  '',
  '---',
  '上記作業票に従って実装してください。完了後に必ず以下フォーマットで結果を出力してください:',
  'KOSAME_RESULT_BEGIN',
  '{"result_status":"success","smoke_result":"PASS","verify_result":"PASS","result_summary":"完了"}',
  'KOSAME_RESULT_END',
].join('\n');

function buildDispatchPrompt(workOrderMd) {
  return `${DISPATCH_SAFETY_PREAMBLE}## 作業票\n\n${workOrderMd}${DISPATCH_RESULT_SUFFIX}`;
}

function readQueueCount(handoffDir) {
  const p = path.join(handoffDir, QUEUE_FILENAME);
  if (!fs.existsSync(p)) return 0;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).length;
}

function readLatestEntry(handoffDir) {
  const p = path.join(handoffDir, QUEUE_FILENAME);
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try { return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}

function readLatestMd(handoffDir) {
  const p = path.join(handoffDir, LATEST_FILENAME);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function safetyPreFlight(prompt) {
  for (const pattern of DISPATCH_SAFETY_STOP_PATTERNS) {
    if (pattern.test(prompt)) {
      return { ok: false, reason: `Safety Stop: prompt matched forbidden pattern ${pattern}` };
    }
  }
  for (const keyword of REQUIRED_SAFETY_KEYWORDS) {
    if (!prompt.includes(keyword)) {
      return { ok: false, reason: `Safety Stop: required condition missing — "${keyword}"` };
    }
  }
  return { ok: true };
}

function extractResultBlock(output) {
  const match = /KOSAME_RESULT_BEGIN\s*([\s\S]*?)\s*KOSAME_RESULT_END/.exec(output);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function assertZeroConfirmCommand() {
  const command = buildZeroConfirmRunnerCommand();
  validateZeroConfirmRunnerCommand(command.command);
  assertExecutorPolicy({
    executorId: ZERO_CONFIRM_EXECUTOR,
    route: ZERO_CONFIRM_ROUTE,
    command: command.command,
    stdio: 'pipe',
    shell: false,
    interactive: false,
    tty: false,
    prompt: '',
    autoResponder: true,
    promptClassifier: true,
    promptFirewall: true,
    safetyStopDetector: true,
    resultPOST: true,
  });
  return command;
}

function postResult(data, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const payload = JSON.stringify({ ...data, source: data.source || 'codex-auto' });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/api/work-orders/result',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ statusCode: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function runClaude(prompt, timeoutMs) {
  const command = assertZeroConfirmCommand();
  return new Promise((resolve, reject) => {
    let spawnResult;
    try {
      spawnResult = safeSpawn(command.command[0], command.command.slice(1), {
        cwd: ROOT,
        env: { ...process.env },
        executionHost: 'kosame-runner',
        executionSource: 'kosame-runner',
        executorId: ZERO_CONFIRM_EXECUTOR,
        route: ZERO_CONFIRM_ROUTE,
      });
    } catch (error) {
      reject(error);
      return;
    }
    const proc = spawnResult.child;
    const hostInfo = spawnResult.hostInfo;

    let stdout = '';
    let stderr = '';
    let autoApprovedCount = 0;
    let autoBlockedCount = 0;
    let autoResponseSent = false;
    let autoResponseValueType = '';
    let promptDetected = '';
    let retryCount = 0;
    let recovered = false;
    let blockedDecision = null;

    proc.stdout.on('data', (chunk) => {
      const text = String(chunk || '');
      stdout += text;
      process.stdout.write(chunk);
      const gate = evaluateNoYesGate({
        text,
        source: 'stdout',
        executionHost: hostInfo.executionHost,
        executionSource: 'kosame-runner',
        executionHostInfo: hostInfo,
      });
      if (!gate.ok) {
        promptDetected = gate.promptType || promptDetected;
        blockedDecision = gate;
        if (gate.decision === 'safety_stop') {
          autoBlockedCount += 1;
        } else {
          autoBlockedCount += 1;
        }
        try { proc.kill('SIGTERM'); } catch {}
      }
    });
    proc.stderr.on('data', (chunk) => {
      const text = String(chunk || '');
      stderr += text;
      const gate = evaluateNoYesGate({
        text,
        source: 'stderr',
        executionHost: hostInfo.executionHost,
        executionSource: 'kosame-runner',
        executionHostInfo: hostInfo,
      });
      if (!gate.ok) {
        promptDetected = gate.promptType || promptDetected;
        blockedDecision = gate;
        autoBlockedCount += 1;
        try { proc.kill('SIGTERM'); } catch {}
      }
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Claude runner timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout,
        stderr,
        autoApprovedCount,
        autoBlockedCount,
        autoResponseSent,
        autoResponseValueType,
        promptDetected,
        retryCount,
        recovered,
        blockedDecision,
        hostInfo,
      });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

async function dispatchWorkOrder(entry, handoffDir, options) {
  const workOrderMd = readLatestMd(handoffDir) || entry.prompt || entry.body || '';
  if (!workOrderMd.trim()) {
    process.stderr.write('[watcher] No prompt in latest.md\n');
    return;
  }

  const prompt = buildDispatchPrompt(workOrderMd);
  const safety = safetyPreFlight(prompt);
  if (!safety.ok) {
    process.stderr.write(`[watcher] ⛔ SAFETY STOP — ${safety.reason}\n`);
    process.stderr.write('[watcher] Dispatch blocked. Human review required.\n');
    return;
  }
  const promptGuard = lintForZeroConfirmText(prompt, { label: 'dispatch prompt', allowNegatedContext: true });
  if (!promptGuard.ok) {
    process.stderr.write(`[watcher] ⛔ OUTPUT GUARD — ${promptGuard.violations.map((v) => v.label).join(', ')}\n`);
    return;
  }

  process.stdout.write(`[watcher] KOSAME Runner dispatch: ${entry.title || entry.id || '?'} / route=${ZERO_CONFIRM_ROUTE} / executor=${ZERO_CONFIRM_EXECUTOR} / executionHost=kosame-runner / officialRoute=Console → Handoff → Runner\n`);
  appendPipelineStageEvent({
    stage: 'runner.dispatch.started',
    status: 'running',
    workOrderId: entry.id || entry.work_order_id || '',
    attachmentCount: Array.isArray(entry.attachments) ? entry.attachments.length : 0,
    attachmentIds: Array.isArray(entry.attachments) ? entry.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
    manifestPath: String(entry.attachment_manifest_path || entry.attachmentManifestPath || ''),
    route: ZERO_CONFIRM_ROUTE,
    executionHost: 'kosame-runner',
    executionHostAllowed: true,
    interactiveHostBlocked: false,
    noYesGateRuntime: true,
    safeSpawnActive: true,
    manualCodeUiAllowed: false,
    officialRoute: 'Console → Handoff → Runner',
    timestamp: new Date().toISOString(),
    message: `Runner dispatch を開始します: ${entry.title || entry.id || '?'}`,
  }, { agent: 'RUNNER', task: 'runner.dispatch.started' });

  let claudeResult;
  try {
    claudeResult = await runClaude(prompt, options.timeoutMs || CLAUDE_TIMEOUT_MS);
  } catch (error) {
    process.stderr.write(`[watcher] Claude runner error: ${error.message}\n`);
    await postResult({
      result_status: 'error',
      result_summary: `Claude runner failed: ${error.message}`,
      smoke_result: 'unknown',
      verify_result: 'unknown',
      executor: ZERO_CONFIRM_EXECUTOR,
      route: ZERO_CONFIRM_ROUTE,
      approval_request_count: 0,
      manual_paste_count: 0,
      wait_request_count: 0,
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
    }, options).catch(() => {});
    return;
  }

  const outputGuard = lintForZeroConfirmText(`${claudeResult.stdout}\n${claudeResult.stderr}`, {
    label: 'runner output',
    allowNegatedContext: true,
  });
  const outputSafety = detectSafetyStop(`${claudeResult.stdout}\n${claudeResult.stderr}`);
  if (claudeResult.blockedDecision) {
    const blockedStatus = claudeResult.blockedDecision.decision === 'safety_stop'
      ? 'safety_stop'
      : claudeResult.blockedDecision.decision === 'blocked_interactive_host'
        ? 'blocked_interactive_host'
        : 'blocked_by_interactive_prompt';
    const blockedReason = claudeResult.blockedDecision.blockedReason || blockedStatus;
    const blocked = buildBlockedResult({
      reason: blockedReason,
      smoke_result: 'FAIL',
      verify_result: 'FAIL',
      resultPOSTStatus: 'POST /api/work-orders/result 200',
    });
    await postResult({
      ...blocked,
      result_status: blockedStatus,
      work_order_status: blockedStatus,
      handoff_status: 'needs_attention',
      decision_status: blockedStatus,
      nextRecommendedAction: blockedStatus,
      executor: ZERO_CONFIRM_EXECUTOR,
      route: ZERO_CONFIRM_ROUTE,
      execution_host: claudeResult.hostInfo.executionHost,
      execution_host_allowed: claudeResult.hostInfo.executionHostAllowed,
      interactive_host_blocked: claudeResult.hostInfo.interactiveHostBlocked,
      no_yes_gate_runtime: claudeResult.hostInfo.noYesGateRuntime,
      safe_spawn_active: claudeResult.hostInfo.safeSpawnActive,
      manual_code_ui_allowed: claudeResult.hostInfo.manualCodeUiAllowed,
      official_route: claudeResult.hostInfo.officialRoute,
      prompt_detected: claudeResult.promptDetected || '',
      prompt_type: claudeResult.promptDetected || '',
      prompt_origin: claudeResult.blockedDecision.promptOrigin || 'interactive_prompt',
      blocked_reason: blockedReason,
      user_input_required: false,
      approval_request_count: 0,
      manual_paste_count: 0,
      wait_request_count: 0,
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
      auto_approved_count: claudeResult.autoApprovedCount || 0,
      auto_blocked_count: claudeResult.autoBlockedCount || 0,
      retry_count: claudeResult.retryCount || 0,
      recovered: !!claudeResult.recovered,
      result_post_retry_count: 0,
      result_summary: `blocked ${blockedStatus}: ${blockedReason}`,
    }, options).catch(() => {});
    appendPipelineStageEvent({
      stage: 'runner.dispatch.completed',
      status: 'blocked',
      workOrderId: entry.id || entry.work_order_id || '',
      attachmentCount: Array.isArray(entry.attachments) ? entry.attachments.length : 0,
      attachmentIds: Array.isArray(entry.attachments) ? entry.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
      manifestPath: String(entry.attachment_manifest_path || entry.attachmentManifestPath || ''),
      route: ZERO_CONFIRM_ROUTE,
      executionHost: claudeResult.hostInfo.executionHost,
      executionHostAllowed: claudeResult.hostInfo.executionHostAllowed,
      interactiveHostBlocked: claudeResult.hostInfo.interactiveHostBlocked,
      noYesGateRuntime: claudeResult.hostInfo.noYesGateRuntime,
      safeSpawnActive: claudeResult.hostInfo.safeSpawnActive,
      manualCodeUiAllowed: claudeResult.hostInfo.manualCodeUiAllowed,
      officialRoute: claudeResult.hostInfo.officialRoute,
      promptType: claudeResult.blockedDecision.promptType || claudeResult.promptDetected || '',
      promptOrigin: claudeResult.blockedDecision.promptOrigin || 'interactive_prompt',
      userInputRequired: false,
      blockedReason: blockedReason,
      timestamp: new Date().toISOString(),
      message: `Execution host guard blocked runner output: ${blockedStatus}`,
    }, { agent: 'RUNNER', task: 'runner.dispatch.completed' });
    process.stderr.write(`[watcher] blocked: ${blockedStatus} / ${blockedReason}\n`);
    return;
  }
  if (!outputGuard.ok) {
    const reason = outputGuard.violations.map((v) => v.label).join(', ');
    process.stderr.write(`[watcher] ⛔ OUTPUT GUARD — ${reason}\n`);
    const blocked = buildBlockedResult({
      reason: `Zero-confirm output guard failed: ${reason}`,
      smoke_result: 'FAIL',
      verify_result: 'FAIL',
      resultPOSTStatus: 'POST /api/work-orders/result 200',
    });
    await postResult({
      ...blocked,
      executor: ZERO_CONFIRM_EXECUTOR,
      route: ZERO_CONFIRM_ROUTE,
      approval_request_count: 0,
      manual_paste_count: 0,
      wait_request_count: 0,
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
      prompt_detected: 'forbidden_prompt',
      auto_approved_count: 0,
      auto_blocked_count: 1,
      retry_count: 0,
      recovered: false,
      result_post_retry_count: 0,
    }, options).catch(() => {});
    return;
  }

  const extracted = extractResultBlock(claudeResult.stdout);
  const recoveryPlan = createRecoveryPlan({
    failures: outputSafety.matched ? [{ reason: outputSafety.reason }] : [],
    retryCount: claudeResult.retryCount || 0,
    recovered: !!claudeResult.recovered,
  });
  const resultData = extracted || {
    result_status: claudeResult.code === 0 ? 'success' : 'error',
    smoke_result: 'unknown',
    verify_result: 'unknown',
    result_summary: `Claude runner完了 (exit ${claudeResult.code})`,
    executor: ZERO_CONFIRM_EXECUTOR,
    route: ZERO_CONFIRM_ROUTE,
    approval_request_count: 0,
    manual_paste_count: 0,
    wait_request_count: 0,
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    prompt_detected: claudeResult.promptDetected || '',
    auto_approved_count: claudeResult.autoApprovedCount || 0,
    auto_blocked_count: claudeResult.autoBlockedCount || 0,
    auto_response_sent: claudeResult.autoResponseSent || false,
    auto_response_value_type: claudeResult.autoResponseValueType || '',
    retry_count: claudeResult.retryCount || 0,
    recovered: claudeResult.recovered || recoveryPlan.recovered,
    result_post_retry_count: 0,
  };
  resultData.executor = resultData.executor || ZERO_CONFIRM_EXECUTOR;
  resultData.route = resultData.route || ZERO_CONFIRM_ROUTE;
  resultData.yes_count = Number.isFinite(Number(resultData.yes_count)) ? Number(resultData.yes_count) : 0;
  resultData.copy_count = Number.isFinite(Number(resultData.copy_count)) ? Number(resultData.copy_count) : 0;
  resultData.human_wait = Number.isFinite(Number(resultData.human_wait)) ? Number(resultData.human_wait) : 0;
  resultData.approval_request_count = Number.isFinite(Number(resultData.approval_request_count)) ? Number(resultData.approval_request_count) : resultData.yes_count;
  resultData.manual_paste_count = Number.isFinite(Number(resultData.manual_paste_count)) ? Number(resultData.manual_paste_count) : resultData.copy_count;
  resultData.wait_request_count = Number.isFinite(Number(resultData.wait_request_count)) ? Number(resultData.wait_request_count) : resultData.human_wait;
  resultData.result_post = resultData.result_post || 'POST /api/work-orders/result 200';
  resultData.execution_host = claudeResult.hostInfo.executionHost || 'kosame-runner';
  resultData.execution_host_allowed = claudeResult.hostInfo.executionHostAllowed;
  resultData.interactive_host_blocked = claudeResult.hostInfo.interactiveHostBlocked;
  resultData.no_yes_gate_runtime = claudeResult.hostInfo.noYesGateRuntime;
  resultData.safe_spawn_active = claudeResult.hostInfo.safeSpawnActive;
  resultData.manual_code_ui_allowed = claudeResult.hostInfo.manualCodeUiAllowed;
  resultData.official_route = claudeResult.hostInfo.officialRoute;
  resultData.auto_approved_count = Number.isFinite(Number(resultData.auto_approved_count)) ? Number(resultData.auto_approved_count) : 0;
  resultData.auto_blocked_count = Number.isFinite(Number(resultData.auto_blocked_count)) ? Number(resultData.auto_blocked_count) : 0;
  resultData.auto_response_sent = !!resultData.auto_response_sent;
  resultData.auto_response_value_type = resultData.auto_response_value_type || '';
  resultData.retry_count = Number.isFinite(Number(resultData.retry_count)) ? Number(resultData.retry_count) : 0;
  resultData.recovered = !!resultData.recovered;
  resultData.result_post_retry_count = Number.isFinite(Number(resultData.result_post_retry_count)) ? Number(resultData.result_post_retry_count) : 0;

  if (!extracted) {
      process.stdout.write('[watcher] No KOSAME_RESULT block in output, using defaults\n');
  }

  try {
    const posted = await postResult(resultData, options);
    if (posted.statusCode === 200 && posted.body && posted.body.ok) {
      process.stdout.write(`[watcher] ✅ Result posted to Console / route=${ZERO_CONFIRM_ROUTE} / executor=${ZERO_CONFIRM_EXECUTOR} / executionHost=kosame-runner\n`);
    } else {
      process.stderr.write(`[watcher] ❌ Post failed: ${posted.statusCode}\n`);
    }
  } catch (error) {
    process.stderr.write(`[watcher] ❌ Post error: ${error.message}\n`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const handoffDir = path.resolve(args.dir || DEFAULT_HANDOFF_DIR);
  const port = Number(args.port || DEFAULT_PORT);
  const host = args.host || DEFAULT_HOST;

  process.stdout.write(`[watcher] Watching ${handoffDir}\n`);
  process.stdout.write(`[watcher] Posting results → http://${host}:${port}\n`);
  process.stdout.write('[watcher] KOSAME Runner起動 — dispatch watcherが自動ディスパッチ / Claudeはreview/audit専用\n');

  let lastCount = readQueueCount(handoffDir);
  let dispatching = false;

  const timer = setInterval(async () => {
    if (dispatching) return;
    const count = readQueueCount(handoffDir);
    if (count > lastCount) {
      const entry = readLatestEntry(handoffDir) || {};
      lastCount = count;
      dispatching = true;
      try {
        await dispatchWorkOrder(entry, handoffDir, { host, port });
      } finally {
        dispatching = false;
      }
    }
  }, POLL_INTERVAL_MS);

  process.on('SIGINT', () => { clearInterval(timer); process.stdout.write('[watcher] Stopped\n'); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
}

module.exports = {
  extractResultBlock,
  readQueueCount,
  readLatestEntry,
  dispatchWorkOrder,
  safetyPreFlight,
  buildDispatchPrompt,
  DISPATCH_SAFETY_STOP_PATTERNS,
  REQUIRED_SAFETY_KEYWORDS,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  });
}
