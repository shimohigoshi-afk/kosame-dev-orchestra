#!/usr/bin/env node
'use strict';

/**
 * kosame-runner-queue.js — Runner Queue Lite v113.3.112
 *
 * Handoff Inbox (queue.jsonl) を監視し作業票を自動実行する。
 * - ユーザーへのコピペ・YES入力・結果貼り戻し不要
 * - 失敗時は最大 MAX_ATTEMPTS 回まで自動再試行
 * - MAX_ATTEMPTS 回失敗で blocked_by_test_failure に移行し報告のみ
 * - Safety Stop 条件検出時は即停止（再試行なし）
 */

const fs   = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const { readHandoffQueue }    = require('./kosame-codex-handoff-bridge-server');
const { checkRuntimeContract } = require('./kosame-runtime-contract');

const ROOT       = path.resolve(__dirname, '..');
const RUNNER_DIR = path.join(ROOT, '.kosame-runner');
const RUNS_DIR   = path.join(RUNNER_DIR, 'runs');
const STATE_FILE = path.join(RUNNER_DIR, 'queue-state.json');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

// ── Progress reporter (v113.9.0) ──────────────────────────────────────────
let _progressCallback = null;
function setProgressCallback(fn) { _progressCallback = fn; }
function emitProgress(msg) {
  if (_progressCallback) { try { _progressCallback(msg); return; } catch (_) {} }
  emitProgress(`${msg}\n`);
}

const MAX_ATTEMPTS = 3;
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function nowIso()     { return new Date().toISOString(); }

// ── File verification helpers (v113.3.112) ──────────────────────────────────

function fileHash(absPath) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(absPath)).digest('hex'); }
  catch { return null; }
}

function gitDiffForFile(targetRepo, filePath) {
  try {
    const res = spawnSync('git', ['diff', '--', filePath], { cwd: targetRepo, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return (res.stdout || '').trim();
  } catch { return ''; }
}

function readState(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile || STATE_FILE, 'utf8')); }
  catch (_) { return {}; }
}

function saveState(state, stateFile) {
  const f = stateFile || STATE_FILE;
  ensureDir(path.dirname(f));
  fs.writeFileSync(f, JSON.stringify(state, null, 2) + '\n');
}

// ── Input formatter ───────────────────────────────────────────────────────────

function formatInput(ticket) {
  return [
    `# Work Ticket: ${ticket.title || ticket.id}`,
    '',
    `- id: ${ticket.id}`,
    `- assigned_agent: ${ticket.assigned_agent || '—'}`,
    `- risk_level: ${ticket.risk_level || '—'}`,
    `- human_gate_required: ${ticket.human_gate_required ? 'true' : 'false'}`,
    `- created_at: ${ticket.created_at || '—'}`,
    `- target_repo: ${ticket.target_repo || '—'}`,
    '',
    '## prompt_text',
    '',
    '```text',
    ticket.prompt_text || ticket.body || '',
    '```',
  ].join('\n');
}

// ── Claude Chat Executor (v113.3.96) ─────────────────────────────────────────
// stdout: 'inherit' so claude-auto-launch's stdout (= claude's output) streams
// live through runner-queue's stdout → cockpit-server SSE → AGENT STREAM LOG.
// stderr: 'pipe' so we can write it to output.md without flooding SSE.

function claudeChatExecutor(ticket, runDir) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;

  const jsonArg = JSON.stringify({ promptText, cwd: targetRepo, runDir });
  process.stdout.write(`[START] zero-confirm: claude起動中 ticket=${ticket.id} — ${promptText.slice(0, 60)}\n`);
  const res = spawnSync(process.execPath, [path.join(__dirname, 'kosame-claude-auto-launch.js'), '--json-arg', jsonArg], {
    cwd: ROOT,
    timeout: 720000,
    stdio: ['ignore', 'inherit', 'pipe'],
    env: { ...process.env, KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS: '600000', KOSAME_SKIP_POST_LAUNCH_VERIFY: '1' },
  });

  const stderr = res.stderr ? res.stderr.toString() : '';
  process.stdout.write(`[DONE] zero-confirm: exit_code=${res.status} ticket=${ticket.id}\n`);

  const outputMd = [
    '# Runner Queue Lite — Claude Auto-Launch Log',
    `ticket_id: ${ticket.id}`,
    `source: ${ticket.source || ''}`,
    `target_repo: ${targetRepo}`,
    `exit_code: ${res.status}`,
    `prompt_text: ${promptText.slice(0, 200)}`,
    '',
    '## stderr (tail)',
    stderr.slice(-1000),
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  fs.writeFileSync(path.join(runDir, 'verify.log'), `exit_code: ${res.status}\n${stderr.slice(-500)}`);

  return {
    ok: res.status === 0,
    exitCode: res.status,
    error: res.error ? res.error.message : (stderr.slice(-200) || null),
  };
}

// ── Local deterministic executor (v113.3.110) ──────────────────────────────
// Handles simple file-append tasks without Claude.
// Falls back when Claude is unavailable.
// Returns { ok, exitCode, error, executor } where executor === 'local' on success.

// Allowed file patterns (low risk, repo-root relative)
const ALLOWED_FILE_PATTERNS = [
  /^public\/[^/]+\.html$/i,
  /^public\/[^/]+\.htm$/i,
  /^README(?:\.md)?$/i,
  /^[^/]+\.txt$/i,
  /^[^/]+\.md$/i,
];

function isAllowedFilePath(filePath) {
  // Reject path traversal
  if (filePath.includes('..')) return false;
  return ALLOWED_FILE_PATTERNS.some((re) => re.test(filePath));
}

function extractFileAppendInfo(promptText) {
  // Accept KOSAME_* markers (any suffix)
  const markerRe = /(KOSAME_[A-Z0-9_]+)/i;
  const markerMatch = promptText.match(markerRe);
  if (!markerMatch) return null;
  const textToAppend = markerMatch[1];

  // Allowed file extensions
  const fileRe = /(public\/[^\s,。、、"]+\.html|public\/[^\s,。、"]+\.htm|[^\s,。、"]+\.md|[^\s,。、"]+\.txt)\b/i;
  const fileMatch = promptText.match(fileRe);
  if (!fileMatch) {
    return { filePath: null, textToAppend, error: 'no file path matched in prompt' };
  }
  let filePath = fileMatch[1];

  if (!isAllowedFilePath(filePath)) {
    return { filePath, textToAppend, error: `file path not allowed: ${filePath}` };
  }

  return { filePath, textToAppend, error: null };
}

// ── Executor Lane Detection (v113.3.112) ────────────────────────────────────

const ALLOWED_FILE_EXT_RE = /(public\/[^\s,。、"]+\.html|public\/[^\s,。、"]+\.htm|[^\s,。、"]+\.(?:md|txt))\b/i;

function extractFilePath(text) {
  const m = text.match(ALLOWED_FILE_EXT_RE);
  return m ? m[1] : null;
}

function detectExecutorLane(ticket) {
  const promptText = String(ticket.prompt_text || ticket.body || ticket.title || '').trim();
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo) ? path.resolve(ticket.target_repo) : ROOT;

  // ── Blocked checks ──
  if (promptText.includes('..')) {
    return { lane: 'blocked_with_reason', reason: 'path traversal detected', promptText };
  }
  if (ticket.target_repo && targetRepo !== ROOT) {
    return { lane: 'blocked_with_reason', reason: 'target_repo mismatch', promptText };
  }
  if (/(?:sales[-_]?dx|transcriber|transcribe)/i.test(promptText)) {
    return { lane: 'blocked_with_reason', reason: 'Sales DX / transcriber paths are not allowed', promptText };
  }
  if (/secret|\.env|credentials?/i.test(promptText)) {
    return { lane: 'blocked_with_reason', reason: 'secret / .env / credentials files are not allowed', promptText };
  }
  if (/(?:削除|delete|rm\s|remove|del\b)/i.test(promptText)) {
    return { lane: 'blocked_with_reason', reason: 'delete operations are not allowed', promptText };
  }
  if (/(?:deploy|git push|git commit|git tag|npm publish|gcloud)/i.test(promptText)) {
    return { lane: 'blocked_with_reason', reason: 'deploy/push/commit/tag operations are not allowed', promptText };
  }

  // ── Sensitive checks (v113.7.2) ──
  // customer/billing/insurance/production → sensitive, only Tier A (Claude/Gemini/GPT)
  // DeepSeek/Grok/Llama must not receive these
  if (/(?:顧客|customer|client|契約|contract|保険|insurance|課金|billing|revenue|payment|production|本番|release|tag|プライバシー|privacy)/i.test(promptText)) {
    return { lane: 'sensitive_internal_only', reason: 'sensitive content — internal AI only (Claude/Gemini/GPT)', promptText };
  }

  // ── Local append ──
  const markerMatch = promptText.match(/(KOSAME_[A-Z0-9_]+)/i);
  const filePath = extractFilePath(promptText);

  if (markerMatch && /(追記|append|追加)/i.test(promptText) && filePath && isAllowedFilePath(filePath)) {
    return { lane: 'local_append', filePath, content: markerMatch[1], promptText };
  }

  // ── Local small HTML/CSS patch (check BEFORE replace) ──
  if (/(?:見出し|heading|h1|h2|h3|タイトル)/i.test(promptText) && /(?:変更|change|書き換え)/i.test(promptText) && filePath && isAllowedFilePath(filePath)) {
    const headingVal = markerMatch ? markerMatch[1] : 'KOSAME_HEADING';
    return { lane: 'local_small_html_css_patch', filePath, newContent: headingVal, patchType: 'heading', promptText };
  }

  // ── Local replace (require explicit 置換/replace keyword) ──
  if (/(置換|replace|書き換え)/i.test(promptText)) {
    const replaceRe = /(public\/[^\s,。、"]+?)\s*の\s*(.+?)\s*を\s*(.+?)\s*(?:に(?:置換|replace|書き換え)|$)/i;
    const replaceMatch = promptText.match(replaceRe);
    if (replaceMatch) {
      const fp = replaceMatch[1].trim();
      if (isAllowedFilePath(fp)) {
        return { lane: 'local_replace', filePath: fp, oldText: replaceMatch[2].trim(), newText: replaceMatch[3].trim(), promptText };
      }
    }
  }

  // ── Local create file ──
  if (/(?:作成|create|新規)/i.test(promptText) && filePath && isAllowedFilePath(filePath)) {
    const content = markerMatch ? markerMatch[1] : 'KOSAME_CREATED';
    return { lane: 'local_create_file', filePath, content, promptText };
  }

  // ── DeepSeek lane ──
  return { lane: 'deepseek_patch_required', reason: 'local executor cannot handle this prompt', promptText };
}

// ── Model Lane Router (v113.3.119) ─────────────────────────────────────────

const CONFIDENTIALITY_LEVELS = ['safe', 'sanitized', 'sensitive', 'forbidden'];

const DIFFICULTY_LEVELS = ['low', 'medium', 'high', 'blocked'];

const MODEL_LANES = {
  L0_LOCAL:                 { label: 'Local Executor',       model: 'local',           audit_required: false },
  L1_DEEPSEEK_V4_FLASH:     { label: 'DeepSeek V4 Flash',    model: 'deepseek-v4-flash',     audit_required: false },
  L2_DEEPSEEK_V4_PRO:       { label: 'DeepSeek V4 Pro',      model: 'deepseek-v4-pro',       audit_required: false },
  L3_DEEPSEEK_V4_PRO_AUDIT: { label: 'DeepSeek V4 Pro+Audit',model: 'deepseek-v4-pro',       audit_required: true  },
  INTERNAL_ONLY:            { label: 'Internal Only',        model: 'internal',         audit_required: false },
  BLOCKED:                  { label: 'Blocked',              model: null,               audit_required: false },
};

/**
 * detectConfidentiality(ticket) → 'safe' | 'sanitized' | 'sensitive' | 'forbidden'
 */
function detectConfidentiality(ticket) {
  const text = String(ticket.prompt_text || ticket.body || ticket.title || '').toLowerCase();

  // ── Forbidden patterns ──
  if (/\.env\b/i.test(text) || /credentials\.json/i.test(text) || /private[\s_-]*key/i.test(text) || /api[\s_-]*key/i.test(text)) {
    return 'forbidden';
  }
  if (/(?:secret|パスワード|password)/i.test(text) && !/(?:secretary|secretary)/i.test(text)) {
    return 'forbidden';
  }
  if (/\/home\/lavie\/repos\/(?:transcriber|kosame-sales-dx)/i.test(text) || /\b(?:transcriber|sales[-_]?dx)\b/i.test(text)) {
    return 'forbidden';
  }
  // Sensitive operations
  if (/\b(?:deploy|git\s+push|npm\s+publish|gcloud)\b/i.test(text)) {
    return 'forbidden';
  }

  // ── Sensitive patterns ──
  if (/\b(?:顧客|customer|client|契約|contract|保険|insurance|課金|billing|revenue|payment)\b/i.test(text)) {
    return 'sensitive';
  }
  if (/\b(?:production|本番|release|tag)\b/i.test(text)) {
    return 'sensitive';
  }

  // ── Sanitized patterns ──
  if (/\b(?:smoke|test|テスト|boilerplate|template|CI|config|eslint|prettier)\b/i.test(text)) {
    return 'sanitized';
  }
  if (/\b(?:lock|health|status|readiness|audit|review|check|verify|確認|チェック)\b/i.test(text)) {
    return 'sanitized';
  }

  return 'safe';
}

/**
 * detectTaskDifficulty(ticket) → 'low' | 'medium' | 'high' | 'blocked'
 */
function detectTaskDifficulty(ticket) {
  const text = String(ticket.prompt_text || ticket.body || ticket.title || '').toLowerCase();
  const countMatches = (re) => { const m = text.match(new RegExp(re.source, 'gi')); return m ? m.length : 0; };

  // ── Blocked checks ──
  if (text.includes('..')) return 'blocked';
  if (/(?:削除|delete|rm\s|remove|\bdel\b)/i.test(text)) return 'blocked';

  let score = 0;

  // ── High signals (+5 each keyword) ──
  score += countMatches(/\b(?:refactor|リファクタ|rearchitect|再設計)\b/) * 5;
  score += countMatches(/\b(?:migration|移行)\b/) * 5;
  score += countMatches(/\b(?:security[.\-_\s]?vulnerability|脆弱性)\b/) * 5;
  score += countMatches(/\b(?:penetration|pentest|owasp)\b/) * 5;

  // ── Elevated signals (+3 each keyword) ──
  score += countMatches(/\b(?:api|endpoint|server|router|handler|middleware)\b/) * 3;
  score += countMatches(/\b(?:state|状態|store|reducer|context)\b/) * 3;
  score += countMatches(/\b(?:performance|パフォーマンス|最適化|optimize|profiling)\b/) * 3;
  score += countMatches(/\b(?:database|schema|index|query)\b/) * 3;
  score += countMatches(/\b(?:concurrency|race|deadlock|async|parallel)\b/) * 3;
  score += countMatches(/\b(?:error|exception|fallback|recovery)\b/) * 3;

  // ── Medium signals (+1 each keyword) ──
  score += countMatches(/\b(?:implement|実装)\b/) * 1;
  score += countMatches(/\b(?:function|関数)\b/) * 1;
  score += countMatches(/\b(?:build|construct|作成)\b/) * 1;
  score += countMatches(/\b(?:modify|修正|fix|change|変更|update|改善)\b/) * 1;
  score += countMatches(/\b(?:component|コンポーネント|module|モジュール)\b/) * 1;
  score += countMatches(/\b(?:style|css|layout|レイアウト|ui|render)\b/) * 1;

  // ── Text complexity bonus ──
  if (text.length > 300) score += 3;
  else if (text.length > 150) score += 1;

  if (score >= 6) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * selectModelLane(ticket) → { lane, label, model, audit_required, reason, ... }
 */
function selectModelLane(ticket) {
  const confidentiality = detectConfidentiality(ticket);
  const difficulty = detectTaskDifficulty(ticket);

  // ── Gate 1: confidentiality block ──
  if (confidentiality === 'forbidden') {
    return {
      lane: 'BLOCKED', label: 'Blocked', model: null, audit_required: false,
      confidentiality, difficulty,
      reason: 'forbidden content detected',
      human_gate_required: true,
    };
  }

  // ── Gate 2: difficulty block ──
  if (difficulty === 'blocked') {
    return {
      lane: 'BLOCKED', label: 'Blocked', model: null, audit_required: false,
      confidentiality, difficulty,
      reason: 'blocked operation detected',
      human_gate_required: true,
    };
  }

  // ── Gate 3: sensitive → internal only ──
  if (confidentiality === 'sensitive') {
    return {
      lane: 'INTERNAL_ONLY', label: 'Internal Only', model: 'internal', audit_required: false,
      confidentiality, difficulty,
      reason: 'sensitive data — external AI routing blocked',
      human_gate_required: true,
    };
  }

  // ── Gate 4: safe/sanitized routing ──
  const isSanitized = confidentiality === 'sanitized';
  const isSafe = confidentiality === 'safe';

  if (difficulty === 'low') {
    return {
      lane: 'L1_DEEPSEEK_V4_FLASH', label: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', audit_required: false,
      confidentiality, difficulty,
      reason: 'low difficulty — V4 Flash sufficient',
      human_gate_required: false,
    };
  }

  if (difficulty === 'medium') {
    return {
      lane: 'L2_DEEPSEEK_V4_PRO', label: 'DeepSeek V4 Pro', model: 'deepseek-v4-pro', audit_required: false,
      confidentiality, difficulty,
      reason: 'medium difficulty — V4 Pro recommended',
      human_gate_required: false,
    };
  }

  // high difficulty
  return {
    lane: 'L3_DEEPSEEK_V4_PRO_AUDIT', label: 'DeepSeek V4 Pro+Audit', model: 'deepseek-v4-pro', audit_required: true,
    confidentiality, difficulty,
    reason: 'high difficulty — V4 Pro + Llama/Groq audit recommended',
    human_gate_required: false,
  };
}

function localDeterministicExecutor(ticket, runDir) {
  // Check multiple fields for the prompt text
  const promptText = String(ticket.prompt_text || ticket.body || ticket.title || ticket.instruction || ticket.safe_prompt_summary || '');
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;

  const info = extractFileAppendInfo(promptText);
  let logLines = [];
  let ok = false;
  let error = null;

  logLines.push('# Local Deterministic Executor (v113.3.111)');
  logLines.push(`ticket_id: ${ticket.id}`);
  logLines.push(`target_repo: ${targetRepo}`);
  logLines.push(`prompt_text: ${promptText.slice(0, 200)}`);
  logLines.push(`checked_fields: prompt_text/body/title/instruction`);
  logLines.push('');

  // Strict target_repo check — only kosame-dev-orchestra
  if (targetRepo !== ROOT) {
    logLines.push('## result: wrong_target_repo');
    logLines.push(`expected: ${ROOT}`);
    logLines.push(`got: ${targetRepo}`);
    error = `target_repo must be ${ROOT}, got ${targetRepo}`;
    ok = false;
  } else if (!info || !info.textToAppend) {
    logLines.push('## result: cannot_handle');
    logLines.push('reason: prompt does not contain KOSAME_ marker');
    logLines.push('note: prompt must include a KOSAME_* marker string');
    error = 'local executor cannot handle this prompt — no KOSAME_ marker';
    ok = false;
  } else if (info.error) {
    logLines.push('## result: cannot_handle');
    logLines.push(`reason: ${info.error}`);
    error = info.error;
    ok = false;
  } else if (!info.filePath) {
    logLines.push('## result: cannot_handle');
    logLines.push('reason: no recognized file pattern in prompt');
    logLines.push('note: expected a .html / .md / .txt file path');
    error = 'local executor cannot handle this prompt — no file path';
    ok = false;
  } else {
    const absPath = path.resolve(targetRepo, info.filePath);
    logLines.push(`target_file: ${info.filePath}`);
    logLines.push(`absolute_path: ${absPath}`);
    logLines.push(`text_to_append: ${info.textToAppend}`);
    logLines.push('');

    try {
      if (!fs.existsSync(absPath)) {
        logLines.push('## result: file_not_found');
        logLines.push(`error: ${absPath} does not exist`);
        error = `file not found: ${absPath}`;
        ok = false;
      } else {
        const existing = fs.readFileSync(absPath, 'utf8');
        if (existing.includes(info.textToAppend)) {
          logLines.push('## result: skipped');
          logLines.push('reason: marker already present in file');
          ok = true;
        } else {
          const appendLine = `\n<!-- ${info.textToAppend} -->\n`;
          fs.appendFileSync(absPath, appendLine, 'utf8');
          const after = fs.readFileSync(absPath, 'utf8');
          if (after.includes(info.textToAppend)) {
            logLines.push('## result: success');
            logLines.push(`action: appended marker to ${info.filePath}`);
            logLines.push(`grep_check: ${after.includes(info.textToAppend)}`);
            ok = true;
          } else {
            logLines.push('## result: write_failed');
            logLines.push('error: appendFileSync succeeded but marker not found after write');
            error = 'write verification failed';
            ok = false;
          }
        }
      }
    } catch (e) {
      logLines.push('## result: error');
      logLines.push(`error: ${e.message}`);
      error = e.message;
      ok = false;
    }
  }

  const outputMd = logLines.join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  const grepResult = info && info.textToAppend && info.filePath
    ? fs.existsSync(path.resolve(targetRepo, info.filePath)) && fs.readFileSync(path.resolve(targetRepo, info.filePath), 'utf8').includes(info.textToAppend)
    : 'N/A';
  fs.writeFileSync(path.join(runDir, 'verify.log'), [
    `executor: local`,
    `ok: ${ok}`,
    error ? `error: ${error}` : '',
    `grep_marker: ${grepResult}`,
  ].filter(Boolean).join('\n'));

  return {
    ok,
    exitCode: ok ? 0 : 1,
    error,
    executor: ok ? 'local' : 'local_failed',
  };
}

// ── Lane Executor Functions (v113.3.112) ─────────────────────────────────────

function executeLocalAppend(ticket, runDir, lane) {
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo) ? ticket.target_repo : ROOT;
  const absPath = path.resolve(targetRepo, lane.filePath);
  let logLines = [`# Lane Executor: local_append`, `ticket_id: ${ticket.id}`, `target_file: ${lane.filePath}`, `content: ${lane.content}`, ''];
  let ok = false;
  let error = null;

  if (!fs.existsSync(absPath)) {
    logLines.push('## result: file_not_found');
    error = `file not found: ${absPath}`;
  } else {
    const beforeHash = fileHash(absPath);
    const existing = fs.readFileSync(absPath, 'utf8');
    if (existing.includes(lane.content)) {
      logLines.push('## result: skipped (already present)');
      ok = true;
    } else {
      const appendLine = `\n<!-- ${lane.content} -->\n`;
      fs.appendFileSync(absPath, appendLine, 'utf8');
      const afterHash = fileHash(absPath);
      const diff = gitDiffForFile(targetRepo, lane.filePath);
      logLines.push(`before_hash: ${beforeHash}`, `after_hash: ${afterHash}`);
      if (diff) logLines.push('', '## git diff', '```diff', diff, '```');
      if (afterHash !== beforeHash) {
        logLines.push('## result: success');
        ok = true;
      } else {
        logLines.push('## result: write_failed (hash unchanged)');
        error = 'file hash unchanged after write';
      }
    }
  }

  fs.writeFileSync(path.join(runDir, 'output.md'), logLines.join('\n'));
  fs.writeFileSync(path.join(runDir, 'verify.log'), [`executor: local_append`, `ok: ${ok}`, error ? `error: ${error}` : ''].filter(Boolean).join('\n'));
  return { ok, exitCode: ok ? 0 : 1, error };
}

function executeLocalReplace(ticket, runDir, lane) {
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo) ? ticket.target_repo : ROOT;
  const absPath = path.resolve(targetRepo, lane.filePath);
  let logLines = [`# Lane Executor: local_replace`, `ticket_id: ${ticket.id}`, `target_file: ${lane.filePath}`, `oldText: ${lane.oldText}`, `newText: ${lane.newText}`, ''];
  let ok = false;
  let error = null;

  if (!fs.existsSync(absPath)) {
    logLines.push('## result: file_not_found');
    error = `file not found: ${absPath}`;
  } else {
    const beforeHash = fileHash(absPath);
    const content = fs.readFileSync(absPath, 'utf8');
    if (!content.includes(lane.oldText)) {
      logLines.push('## result: not_found');
      logLines.push(`note: oldText "${lane.oldText}" not found in file`);
      error = `text not found: ${lane.oldText}`;
    } else {
      const updated = content.split(lane.oldText).join(lane.newText);
      fs.writeFileSync(absPath, updated, 'utf8');
      const afterHash = fileHash(absPath);
      const diff = gitDiffForFile(targetRepo, lane.filePath);
      logLines.push(`before_hash: ${beforeHash}`, `after_hash: ${afterHash}`);
      if (diff) logLines.push('', '## git diff', '```diff', diff, '```');
      if (afterHash !== beforeHash) {
        logLines.push('## result: success');
        ok = true;
      } else {
        logLines.push('## result: write_failed (hash unchanged)');
        error = 'file hash unchanged after write';
      }
    }
  }

  fs.writeFileSync(path.join(runDir, 'output.md'), logLines.join('\n'));
  fs.writeFileSync(path.join(runDir, 'verify.log'), [`executor: local_replace`, `ok: ${ok}`, error ? `error: ${error}` : ''].filter(Boolean).join('\n'));
  return { ok, exitCode: ok ? 0 : 1, error };
}

function executeLocalCreateFile(ticket, runDir, lane) {
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo) ? ticket.target_repo : ROOT;
  const absPath = path.resolve(targetRepo, lane.filePath);
  let logLines = [`# Lane Executor: local_create_file`, `ticket_id: ${ticket.id}`, `target_file: ${lane.filePath}`, `content: ${lane.content}`, ''];
  let ok = false;
  let error = null;

  if (fs.existsSync(absPath)) {
    logLines.push('## result: file_already_exists');
    error = `file already exists: ${absPath}`;
  } else {
    const bodyContent = lane.content.startsWith('KOSAME_') ? `<p>${lane.content}</p>` : lane.content;
    const html = `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<title>Test</title>\n</head>\n<body>\n${bodyContent}\n</body>\n</html>\n`;
    fs.writeFileSync(absPath, html, 'utf8');
    const afterHash = fileHash(absPath);
    const diff = gitDiffForFile(targetRepo, lane.filePath);
    logLines.push(`before_hash: null (new file)`, `after_hash: ${afterHash}`);
    if (diff) logLines.push('', '## git diff', '```diff', diff, '```');
    if (fs.existsSync(absPath) && afterHash) {
      logLines.push('## result: success');
      ok = true;
    } else {
      logLines.push('## result: write_failed');
      error = 'file not found or empty after write';
    }
  }

  fs.writeFileSync(path.join(runDir, 'output.md'), logLines.join('\n'));
  fs.writeFileSync(path.join(runDir, 'verify.log'), [`executor: local_create_file`, `ok: ${ok}`, error ? `error: ${error}` : ''].filter(Boolean).join('\n'));
  return { ok, exitCode: ok ? 0 : 1, error };
}

function executeLocalSmallPatch(ticket, runDir, lane) {
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo) ? ticket.target_repo : ROOT;
  const absPath = path.resolve(targetRepo, lane.filePath);
  let logLines = [`# Lane Executor: local_small_html_css_patch`, `ticket_id: ${ticket.id}`, `target_file: ${lane.filePath}`, `patchType: ${lane.patchType}`, `newContent: ${lane.newContent}`, ''];
  let ok = false;
  let error = null;

  if (!fs.existsSync(absPath)) {
    logLines.push('## result: file_not_found');
    error = `file not found: ${absPath}`;
  } else {
    const beforeHash = fileHash(absPath);
    let content = fs.readFileSync(absPath, 'utf8');
    if (lane.patchType === 'heading') {
      const h1Re = /<h1[^>]*>.*?<\/h1>/i;
      const h1Match = content.match(h1Re);
      if (h1Match) {
        content = content.replace(h1Re, `<h1>${lane.newContent}</h1>`);
        fs.writeFileSync(absPath, content, 'utf8');
        const afterHash = fileHash(absPath);
        const diff = gitDiffForFile(targetRepo, lane.filePath);
        logLines.push(`before_hash: ${beforeHash}`, `after_hash: ${afterHash}`);
        if (diff) logLines.push('', '## git diff', '```diff', diff, '```');
        if (afterHash !== beforeHash) {
          logLines.push('## result: success');
          ok = true;
        } else {
          logLines.push('## result: write_failed (hash unchanged)');
          error = 'file hash unchanged after write';
        }
      } else {
        logLines.push('## result: not_found');
        error = 'no h1 found in file';
      }
    } else {
      logLines.push('## result: unknown_patch_type');
      error = `unknown patch type: ${lane.patchType}`;
    }
  }

  fs.writeFileSync(path.join(runDir, 'output.md'), logLines.join('\n'));
  fs.writeFileSync(path.join(runDir, 'verify.log'), [`executor: local_small_html_css_patch`, `ok: ${ok}`, error ? `error: ${error}` : ''].filter(Boolean).join('\n'));
  return { ok, exitCode: ok ? 0 : 1, error };
}

// ── Executor dir helpers (v113.3.114) ────────────────────────────────────────

function writeLatestStatus(lane, status, ticket, outputPath, deepseekPath, reason) {
  const now = new Date().toISOString();
  const modelLane = ticket && ticket.prompt_text ? selectModelLane(ticket) : null;
  const lines = [
    '# KOSAME Runner — Latest Executor Status',
    `updated_at: ${now}`,
    `lane: ${lane}`,
    `status: ${status}`,
    `ticket_id: ${ticket.id}`,
    `title: ${ticket.title || ticket.id}`,
    `target_repo: ${ticket.target_repo || ROOT}`,
    `output_path: ${outputPath || ''}`,
    deepseekPath ? `deepseek_handoff_path: ${deepseekPath}` : null,
    reason ? `reason: ${reason}` : null,
    modelLane ? `confidentiality: ${modelLane.confidentiality}` : null,
    modelLane ? `difficulty: ${modelLane.difficulty}` : null,
    modelLane ? `model_lane: ${modelLane.lane}` : null,
    modelLane ? `recommended_model: ${modelLane.model || 'none'}` : null,
    modelLane ? `audit_required: ${modelLane.audit_required}` : null,
    modelLane ? `human_gate_required: ${modelLane.human_gate_required}` : null,
    '',
  ].filter(Boolean).join('\n');

  ensureDir(EXECUTOR_DIR);
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'latest.md'), lines);
}

function writeDeepSeekHandoffFile(ticket, lane, runDir) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const targetRepo = ticket.target_repo || ROOT;
  const modelLane = selectModelLane(ticket);
  const lines = [
    '# DeepSeek Handoff Work Order',
    `generated_at: ${new Date().toISOString()}`,
    `ticket_id: ${ticket.id}`,
    `title: ${ticket.title || ticket.id}`,
    `target_repo: ${targetRepo}`,
    `reason: ${lane && lane.reason ? lane.reason : 'local executor cannot handle'}`,
    `confidentiality: ${modelLane.confidentiality}`,
    `difficulty: ${modelLane.difficulty}`,
    `model_lane: ${modelLane.lane}`,
    `recommended_model: ${modelLane.model || 'none'}`,
    `audit_required: ${modelLane.audit_required}`,
    `lane_reason: ${modelLane.reason}`,
    `human_gate_required: ${modelLane.human_gate_required}`,
    '',
    '## User Prompt',
    '',
    '```text',
    promptText,
    '```',
    '',
    '## Safety Constraints',
    '',
    '- target_repo: /home/lavie/kosame-dev-orchestra only',
    '- Do NOT touch Sales DX / transcriber / Secret / .env / credentials / customer data',
    '- Do NOT delete files (rm, remove, del)',
    '- Do NOT deploy / push / commit / tag',
    '- Do NOT run gcloud, npm publish, or git push',
    '- git add -A is prohibited (use individual git add)',
    '- Codex is prohibited',
    '- Claude is prohibited',
    '- Safety Stop conditions must be respected',
    '',
    '## Allowed Files',
    '',
    '- public/*.html, public/*.htm',
    '- *.md, *.txt (repo root only)',
    '',
    '## Forbidden Patterns',
    '',
    '- Path traversal (../)',
    '- /home/lavie/repos/kosame-sales-dx or any sales-dx path',
    '- transcriber or transcribe paths',
    '- .env, credentials.json, secret files',
    '- node_modules/',
    '',
    '## Expected Verification',
    '',
    '- node --check on all modified .js files',
    '- file hash must change after modification (no silent no-ops)',
    '- git diff -- <file> to confirm changes',
    '- npm run smoke:v113-3-115 if available',
    '- npm run verify to confirm no regressions',
    '',
    '## Result Return Format',
    '',
    'After completing the work, return your result using the following format:',
    '',
    '```',
    'KOSAME_DEEPSEEK_RESULT_BEGIN',
    'status: completed | blocked | failed',
    'ticket_id: <ticket id>',
    'summary: <brief summary of changes>',
    'changed_files:',
    '- <file1>',
    '- <file2>',
    'verification:',
    '- <verification step 1>',
    '- <verification step 2>',
    'commit: none | <commit hash>',
    'notes: <any additional notes>',
    'KOSAME_DEEPSEEK_RESULT_END',
    '```',
    '',
    '## Constraints (Reminder)',
    '',
    '- git add -A is prohibited',
    '- Codex is prohibited',
    '- Claude is prohibited',
    '- Do NOT include secret / API keys / credentials in output',
    '- Do NOT touch Sales DX / transcriber files',
    '',
  ].join('\n');

  ensureDir(EXECUTOR_DIR);
  const handoffPath = path.join(EXECUTOR_DIR, 'latest-deepseek.md');
  fs.writeFileSync(handoffPath, lines);
  return handoffPath;
}

function writeRevisionHandoffFile(prevTicketId, prevSummary, prevChangedFiles, prevVerification, reviseReason, nextInstruction) {
  const lines = [
    '# DeepSeek Revision Handoff (v113.3.116)',
    `generated_at: ${new Date().toISOString()}`,
    `original_ticket_id: ${prevTicketId || '—'}`,
    `revise_reason: ${reviseReason || '—'}`,
    `next_instruction: ${nextInstruction || '—'}`,
    '',
    '## Previous Result Summary',
    '',
    `summary: ${prevSummary || '—'}`,
    '',
    '## Previous Changed Files',
    (prevChangedFiles || []).length ? prevChangedFiles.map(f => `- ${f}`).join('\n') : '- (none)',
    '',
    '## Previous Verification',
    (prevVerification || []).length ? prevVerification.map(v => `- ${v}`).join('\n') : '- (none)',
    '',
    '## Revision Instruction',
    '',
    '```text',
    nextInstruction || reviseReason || 'Revise based on previous review.',
    '```',
    '',
    '## Safety Constraints',
    '',
    '- target_repo: /home/lavie/kosame-dev-orchestra only',
    '- Do NOT touch Sales DX / transcriber / Secret / .env / credentials / customer data',
    '- Do NOT delete files',
    '- Do NOT deploy / push / commit / tag',
    '- git add -A is prohibited',
    '- git add . is prohibited',
    '- Codex is prohibited',
    '- Claude is prohibited',
    '- Automatic push is prohibited',
    '- Automatic deploy is prohibited',
    '',
    '## Result Return Format',
    '',
    'Return your result using the following format:',
    '',
    '```',
    'KOSAME_DEEPSEEK_RESULT_BEGIN',
    'status: completed | blocked | failed',
    'ticket_id: <ticket id>',
    'summary: <brief summary>',
    'changed_files:',
    '- <file1>',
    '- <file2>',
    'verification:',
    '- <step 1>',
    '- <step 2>',
    'commit: none | <commit hash>',
    'notes: <any notes>',
    'KOSAME_DEEPSEEK_RESULT_END',
    '```',
    '',
  ].join('\n');

  ensureDir(EXECUTOR_DIR);
  const revisionPath = path.join(EXECUTOR_DIR, 'latest-deepseek-revision.md');
  fs.writeFileSync(revisionPath, lines);
  return revisionPath;
}

function executeDeepSeekHandoff(ticket, runDir, lane) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const handoffLines = [
    '# DeepSeek Patch Required (v113.3.112)',
    `ticket_id: ${ticket.id}`,
    `title: ${ticket.title || ticket.id}`,
    `reason: ${lane.reason || 'local executor cannot handle'}`,
    '',
    '## Handoff Instructions for DeepSeek',
    '',
    'The following work ticket requires DeepSeek to process:',
    '',
    '```text',
    promptText,
    '```',
    '',
    '## Constraints',
    '',
    '- target_repo: /home/lavie/kosame-dev-orchestra',
    '- Do NOT touch Sales DX / transcriber / Secret / .env / credentials / customer data',
    '- Do NOT delete files',
    '- Do NOT deploy / push / commit / tag',
    '- git add -A is prohibited',
    '- Codex prohibited',
    '- Claude prohibited',
  ].join('\n');

  const outputMdPath = path.join(runDir, 'output.md');
  fs.writeFileSync(outputMdPath, handoffLines);
  fs.writeFileSync(path.join(runDir, 'verify.log'), `status: deepseek_patch_required\nreason: ${lane.reason}`);

  // Write executor dir files
  const deepseekPath = writeDeepSeekHandoffFile(ticket, lane, runDir);
  writeLatestStatus('deepseek_patch_required', 'pending', ticket, outputMdPath, deepseekPath, lane.reason);

  return { ok: false, exitCode: 0, error: null, executorStatus: 'deepseek_patch_required' };
}

function executeBlocked(ticket, runDir, lane) {
  const blockedLines = [
    '# Blocked by Runner Queue Policy',
    `ticket_id: ${ticket.id}`,
    `reason: ${lane.reason}`,
    '',
    '## Details',
    '',
    `This ticket was blocked because: ${lane.reason}`,
    '',
    'No changes were made to any files.',
  ].join('\n');

  const outputMdPath = path.join(runDir, 'output.md');
  fs.writeFileSync(outputMdPath, blockedLines);
  fs.writeFileSync(path.join(runDir, 'verify.log'), `status: blocked_with_reason\nreason: ${lane.reason}`);

  // Update latest.md but do NOT create latest-deepseek.md
  writeLatestStatus('blocked_with_reason', 'blocked', ticket, outputMdPath, null, lane.reason);

  return { ok: false, exitCode: 1, error: lane.reason, executorStatus: 'blocked_with_reason' };
}

// ── Executor Lane Router (v113.3.112) ─────────────────────────────────────────

function executorLaneRouter(ticket, runDir) {
  const lane = detectExecutorLane(ticket);
  emitProgress(`lane 判定: ${lane.lane} (${(lane.reason || lane.filePath || '').slice(0, 60)})\n`);

  switch (lane.lane) {
    case 'local_append':
      emitProgress(`→ local_append 実行中: ${lane.filePath}\n`);
      return executeLocalAppend(ticket, runDir, lane);
    case 'local_replace':
      emitProgress(`→ local_replace 実行中: ${lane.filePath}\n`);
      return executeLocalReplace(ticket, runDir, lane);
    case 'local_create_file':
      emitProgress(`→ local_create_file 実行中: ${lane.filePath}\n`);
      return executeLocalCreateFile(ticket, runDir, lane);
    case 'local_small_html_css_patch':
      emitProgress(`→ local_html_patch 実行中: ${lane.filePath}\n`);
      return executeLocalSmallPatch(ticket, runDir, lane);
    case 'deepseek_patch_required':
      emitProgress(`→ deepseek handoff 生成中...\n`);
      return executeDeepSeekHandoff(ticket, runDir, lane);
    case 'sensitive_internal_only':
      emitProgress(`→ blocked (sensitive): ${lane.reason.slice(0, 60)}\n`);
      return executeBlocked(ticket, runDir, { reason: lane.reason, promptText: lane.promptText });
    case 'blocked_with_reason':
      emitProgress(`→ blocked: ${lane.reason.slice(0, 60)}\n`);
      return executeBlocked(ticket, runDir, lane);
    default:
      emitProgress(`→ unknown lane: ${lane.lane}\n`);
      return { ok: false, exitCode: 1, error: `unknown lane: ${lane.lane}` };
  }
}

// ── Default executor ──────────────────────────────────────────────────────────

function defaultExecutor(ticket, runDir) {
  emitProgress(`作業開始: ${(ticket.title || ticket.id).slice(0, 60)}\n`);
  // 1. Try lane router for all tickets
  const laneResult = executorLaneRouter(ticket, runDir);

  // 2. For chat-dispatch tickets that lane router can't handle locally,
  //    fall back to Claude (backward compat for kosame-chat-dispatch)
  if (laneResult.executorStatus === 'deepseek_patch_required' && ticket.source === 'kosame-chat-dispatch') {
    process.stdout.write(`[FALLBACK] deepseek → Claude for chat-dispatch ticket=${ticket.id}\n`);
    const claudeResult = claudeChatExecutor(ticket, runDir);
    if (claudeResult.ok) return claudeResult;
    laneResult.claudeFallbackAttempted = true;
    laneResult.claudeExitCode = claudeResult.exitCode;
    laneResult.claudeError = claudeResult.error;
    return laneResult;
  }

  return laneResult;
}

// ── Single ticket execution ───────────────────────────────────────────────────

/**
 * @param {object} ticket   - Handoff queue item
 * @param {number} attempt  - 1-based attempt number
 * @param {object} opts
 *   opts.executor  fn(ticket, runDir) → { ok, exitCode, error } — injectable (for testing)
 *   opts.runsDir   string — override run directory (for testing)
 * @returns {object} result
 */
function runTicket(ticket, attempt, opts) {
  const executor = (opts && opts.executor) || defaultExecutor;
  const runsDir  = (opts && opts.runsDir)  || RUNS_DIR;
  const runDir   = path.join(runsDir, ticket.id);

  ensureDir(runDir);

  // input.md — 初回のみ書き込む
  const inputPath = path.join(runDir, 'input.md');
  if (attempt === 1 || !fs.existsSync(inputPath)) {
    fs.writeFileSync(inputPath, formatInput(ticket));
  }

  const startedAt = nowIso();

  // Safety Stop チェック — original_request（ユーザーの実際の要求）を優先。
  // prompt_text / body は AUTO_YES_CONTRACT 等のポリシー前文を含むため false positive を
  // 引き起こす("課金発生"等がポリシー説明として記述されている)。
  const safetyText  = ticket.original_request || ticket.originalRequest || ticket.prompt_text || ticket.body || '';
  const contractRes = checkRuntimeContract({ action: safetyText });

  if (contractRes.decision === 'STOP') {
    const errMsg     = `Safety Stop: ${contractRes.reason}`;
    const stopOutput = [
      '# Runner Queue Lite — Safety Stop',
      `ticket_id: ${ticket.id}`,
      `attempt: ${attempt}`,
      '',
      errMsg,
    ].join('\n');
    fs.writeFileSync(path.join(runDir, 'output.md'), stopOutput);
    fs.writeFileSync(path.join(runDir, 'verify.log'), errMsg);
    const result = {
      runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id,
      status: 'safety_stop', attempts: attempt,
      startedAt, completedAt: nowIso(), error: errMsg,
    };
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  }

    // 4. 実行
  emitProgress(`実装中...\n`);
  let execRes;
  try {
    execRes = executor(ticket, runDir);
  } catch (err) {
    execRes = { ok: false, exitCode: 1, error: err.message };
    const errOutput = `# Executor Error\n\n${err.message}`;
    fs.writeFileSync(path.join(runDir, 'output.md'), errOutput);
    fs.writeFileSync(path.join(runDir, 'verify.log'), err.message);
  }

  const status = execRes.executorStatus || (execRes.ok ? 'completed' : 'verify_failed');
  const result = {
    runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id,
    status, attempts: attempt,
    startedAt, completedAt: nowIso(),
    exitCode: execRes.exitCode !== undefined ? execRes.exitCode : (status === 'completed' ? 0 : 1),
    error: execRes.error || null,
    blockedReason: execRes.executorStatus === 'blocked_with_reason' ? execRes.error : undefined,
  };
  emitProgress(`結果: ${status} exit=${result.exitCode}\n`);
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

// ── Task Vault auto-update (v113.8.0) ─────────────────────────────────────

function updateTaskVault(ticket, result) {
  try {
    const stateDir = path.join(ROOT, '.kosame-state');
    ensureDir(stateDir);
    const vaultPath = path.join(stateDir, 'task-vault.json');
    const now = new Date().toISOString();

    // Load existing vault
    let vault = { version: PKG_VERSION, history: [] };
    try { vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8')); } catch (_) {}

    // Determine lane from result
    const lane = result.status === 'completed' ? (result.modelLane || 'executed') :
                 result.status === 'blocked_with_reason' ? 'blocked' :
                 result.status === 'deepseek_patch_required' ? 'deepseek_patch_required' :
                 result.status === 'safety_stop' ? 'safety_stop' : 'unknown';

    // Only save implementation tasks (skip status inquiries / questions)
    const title = ticket.title || ticket.id || '';
    const promptText = String(ticket.prompt_text || ticket.body || '').toLowerCase();
    const isQuestion = /(?:現在地|バージョン|version|状態.*確認|何をし|教えて|状況|ステータス|教え)/i.test(title + promptText);

    if (isQuestion) {
      // Skip entirely — don't update last_completed_task, don't add to history
      fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + '\n');
      return;
    }

    vault.last_completed_task = {
      title: ticket.title || ticket.id,
      status: result.status,
      exit_code: result.exitCode,
      lane: lane,
      completed_at: now,
      error: result.error || null,
      blocked_reason: result.blockedReason || null,
    };
    vault.current_mission = {
      lane: lane,
      status: result.status,
      last_task: ticket.title || ticket.id,
    };
    vault.model_lane = lane;
    vault.updated_at = now;
    vault.history = (vault.history || []).slice(-19);
    vault.history.push({ ticket: ticket.title || ticket.id, status: result.status, lane: lane, at: now });

    fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + '\n');
  } catch (_) { /* best-effort: task vault update failure is non-fatal */ }
}

// ── Process ticket with retry ─────────────────────────────────────────────────

/**
 * @param {object} ticket
 * @param {object} opts
 *   opts.executor  — injectable executor
 *   opts.runsDir   — override runs directory
 *   opts.state     — in-memory state object (mutated in-place; if absent, reads/writes STATE_FILE)
 *   opts.stateFile — override state file path
 * @returns {object} final result
 */
function processTicket(ticket, opts) {
  opts = opts || {};
  const useFile   = opts.state === undefined;
  const state     = useFile ? readState(opts.stateFile) : opts.state;
  const flushState = useFile ? (s) => saveState(s, opts.stateFile) : () => {};

  const existing = state[ticket.id];
  const terminalStatuses = new Set(['completed', 'blocked_by_test_failure', 'blocked_with_reason', 'deepseek_patch_required', 'safety_stop']);
  if (existing && terminalStatuses.has(existing.status)) {
    return { runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id, ...existing };
  }

  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastResult = runTicket(ticket, attempt, opts);

    if (lastResult.status === 'safety_stop') {
      state[ticket.id] = { status: 'safety_stop', error: lastResult.error, blockedAt: lastResult.completedAt };
      flushState(state);
      updateTaskVault(ticket, lastResult);
      return lastResult;
    }

    if (lastResult.status === 'blocked_with_reason' || lastResult.status === 'deepseek_patch_required') {
      state[ticket.id] = { status: lastResult.status, error: lastResult.error, blockedAt: lastResult.completedAt };
      flushState(state);
      updateTaskVault(ticket, lastResult);
      return lastResult;
    }

    if (lastResult.status === 'completed') {
      state[ticket.id] = { status: 'completed', completedAt: lastResult.completedAt };
      flushState(state);
      updateTaskVault(ticket, lastResult);
      return lastResult;
    }
    // verify_failed → 次の試行へ
  }

  // MAX_ATTEMPTS 回失敗 → blocked_by_test_failure
  lastResult.status   = 'blocked_by_test_failure';
  lastResult.attempts = MAX_ATTEMPTS;
  const runDir = path.join(opts.runsDir || RUNS_DIR, ticket.id);
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(lastResult, null, 2) + '\n');

  state[ticket.id] = {
    status: 'blocked_by_test_failure',
    attempts: MAX_ATTEMPTS,
    blockedAt: lastResult.completedAt,
  };
  flushState(state);

  process.stderr.write(
    `[runner-queue] BLOCKED: ${ticket.id} — "${ticket.title || ticket.id}" failed after ${MAX_ATTEMPTS} attempts\n`
  );
  return lastResult;
}

// ── Process entire queue ──────────────────────────────────────────────────────

function processQueue(opts) {
  opts = opts || {};
  const queue   = readHandoffQueue(opts.handoffOpts || {});
  const results = [];
  for (const item of queue.items) {
    results.push(processTicket(item, opts));
  }
  return results;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  processQueue,
  processTicket,
  runTicket,
  formatInput,
  defaultExecutor,
  claudeChatExecutor,
  localDeterministicExecutor,
  extractFileAppendInfo,
  detectExecutorLane,
  detectConfidentiality,
  detectTaskDifficulty,
  selectModelLane,
  MODEL_LANES,
  CONFIDENTIALITY_LEVELS,
  DIFFICULTY_LEVELS,
  executorLaneRouter,
  executeLocalAppend,
  executeLocalReplace,
  executeLocalCreateFile,
  executeLocalSmallPatch,
  executeDeepSeekHandoff,
  executeBlocked,
  writeLatestStatus,
  writeDeepSeekHandoffFile,
  writeRevisionHandoffFile,
  setProgressCallback,
  emitProgress,
  MAX_ATTEMPTS,
  RUNS_DIR,
  RUNNER_DIR,
  STATE_FILE,
  EXECUTOR_DIR,
};

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const results = processQueue();
  for (const r of results) {
    const sym = r.status === 'completed'              ? '✅' :
                r.status === 'blocked_by_test_failure'  ? '🔴' :
                r.status === 'blocked_with_reason'      ? '⛔' :
                r.status === 'safety_stop'              ? '⛔' : '⚠️';
    process.stdout.write(`${sym} [${r.status}] ${r.ticketId} — ${r.title || ''}\n`);
  }
}
