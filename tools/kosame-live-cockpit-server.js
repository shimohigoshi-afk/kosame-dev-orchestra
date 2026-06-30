#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
// Load .env before any module reads process.env at init time
try {
  const _el = require('node:fs').readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8').split('\n');
  for (const _l of _el) { const _m = _l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (_m && !(_m[1] in process.env)) process.env[_m[1]] = _m[2].trim(); }
} catch (_) { /* .env is optional */ }
const http = require('node:http');
const { collectLiveCockpitSnapshot } = require('./kosame-live-cockpit-snapshot');
const { buildConsoleContextSummary } = require('./kosame-cockpit-context');
const { detectConfirmation } = require('./kosame-confirmation-detector');
const { handleChatRequest } = require('./kosame-cockpit-chat-server');
const { approveWorkOrder, APPROVAL_LOG_PATH_ENV } = require('./kosame-work-order-approval-store');
const { readLatestWorkOrderHandoff, recordWorkOrderHandoff, HANDOFF_LOG_PATH_ENV } = require('./kosame-work-order-handoff-store');
const { readLatestWorkOrderResult, recordWorkOrderResult, RESULT_LOG_PATH_ENV } = require('./kosame-work-order-result-store');
const { appendShellAgentActivityEvent, SHELL_ACTIVITY_LOG_PATH_ENV } = require('./kosame-shell-agent-activity');
const { buildWorkOrderResultDecision } = require('./kosame-work-order-result-decision');
const { saveHandoffInbox, readLatestHandoffInbox } = require('./kosame-codex-handoff-bridge-server');
const { processTicket } = require('./kosame-runner-queue');
const { appendPipelineStageEvent } = require('./kosame-pipeline-telemetry');
const { evaluateNoYesGate } = require('./kosame-no-yes-gate');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function saveHistory(type, data, ticketId, action) {
  try {
    const historyDir = path.join(EXECUTOR_DIR, 'history');
    ensureDir(historyDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const entry = { type, timestamp: new Date().toISOString(), ticket_id: ticketId || '—', action: action || null, data, path: null };
    const fname = `${ts}-${type}.json`;
    const fp = path.join(historyDir, fname);
    fs.writeFileSync(fp, JSON.stringify(entry, null, 2) + '\n');
  } catch (_) { /* silent */ }
}

function writeLatestBlocked(reason, ticketId) {
  try {
    const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
    const lines = [
      '# KOSAME Runner — Latest Executor Status',
      `updated_at: ${new Date().toISOString()}`,
      `status: blocked`,
      `reason: ${reason}`,
      ticketId ? `ticket_id: ${ticketId}` : null,
      '',
    ].filter(Boolean).join('\n');
    ensureDir(EXECUTOR_DIR);
    fs.writeFileSync(latestPath, lines);
  } catch (_) { /* silent */ }
}

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function targetRepoToProject(targetRepo) {
  if (targetRepo === '/home/lavie/kosame-dev-orchestra') return 'KOSAME Dev Orchestra';
  if (targetRepo === '/home/lavie/repos/kosame-sales-dx') return 'Sales DX';
  if (targetRepo === '/home/lavie/repos/transcriber') return 'Sales DX';
  return 'KOSAME Project';
}

function buildHandoffActivityMessage(status, title) {
  const safeTitle = String(title || '作業票').trim();
  const messages = {
    approved: `${safeTitle} を承認しました。dispatch待ちです。`,
    ready_to_handoff: `${safeTitle} は dispatch待ちです。`,
    handed_to_agent: `${safeTitle} を KOSAME Runner へ渡しました。runner実行中です。`,
    waiting_result: `${safeTitle} は runner実行中です。resultPOST待ちです。`,
  };
  return messages[status] || `${safeTitle} の dispatch 状態を更新しました。`;
}

function buildResultActivityMessage(decision, title, agent) {
  const safeTitle = String(title || '作業票').trim();
  const safeAgent = String(agent || '担当AI').trim() || '担当AI';
  const decisionStatus = String(decision && decision.decision_status || decision && decision.nextRecommendedAction || 'wait_for_result').trim();
  const executor = String(decision && decision.executor || safeAgent || '担当AI').trim() || '担当AI';
  const route = String(decision && decision.route || 'zero-confirm').trim() || 'zero-confirm';
  const resultPost = String(decision && decision.result_post || decision && decision.resultPOST || 'POST /api/work-orders/result 200').trim() || 'POST /api/work-orders/result 200';
  const approvalCount = Number.isFinite(Number(decision && (decision.approval_request_count ?? decision.yes_count))) ? Number(decision.approval_request_count ?? decision.yes_count) : 0;
  const manualPasteCount = Number.isFinite(Number(decision && (decision.manual_paste_count ?? decision.copy_count))) ? Number(decision.manual_paste_count ?? decision.copy_count) : 0;
  const waitCount = Number.isFinite(Number(decision && (decision.wait_request_count ?? decision.human_wait))) ? Number(decision.wait_request_count ?? decision.human_wait) : 0;
  const autoApprovedCount = Number.isFinite(Number(decision && (decision.auto_approved_count ?? decision.autoApprovedCount))) ? Number(decision.auto_approved_count ?? decision.autoApprovedCount) : 0;
  const autoBlockedCount = Number.isFinite(Number(decision && (decision.auto_blocked_count ?? decision.autoBlockedCount))) ? Number(decision.auto_blocked_count ?? decision.autoBlockedCount) : 0;
  const retryCount = Number.isFinite(Number(decision && (decision.retry_count ?? decision.retryCount))) ? Number(decision.retry_count ?? decision.retryCount) : 0;
  const executionHost = String(decision && (decision.execution_host || decision.executionHost) || 'kosame-runner').trim() || 'kosame-runner';
  const executionHostAllowed = decision && (decision.execution_host_allowed ?? decision.executionHostAllowed);
  const interactiveHostBlocked = !!(decision && (decision.interactive_host_blocked ?? decision.interactiveHostBlocked));
  const interactivePromptBlocked = !!(decision && (decision.interactive_prompt_blocked ?? decision.interactivePromptBlocked));
  const noYesGateRuntime = decision && (decision.no_yes_gate_runtime ?? decision.noYesGateRuntime);
  const safeSpawnActive = decision && (decision.safe_spawn_active ?? decision.safeSpawnActive);
  const manualCodeUiAllowed = decision && (decision.manual_code_ui_allowed ?? decision.manualCodeUiAllowed);
  const officialRoute = String(decision && (decision.official_route || decision.officialRoute) || 'Console → Handoff → Runner').trim() || 'Console → Handoff → Runner';
  const codexYesHellGuard = String(decision && (decision.codex_yes_hell_guard || decision.codexYesHellGuard) || 'active').trim() || 'active';
  const codexAutoApproveMode = String(decision && (decision.codex_auto_approve_mode || decision.codexAutoApproveMode) || 'active').trim() || 'active';
  const userYesRequired = !!(decision && (decision.user_yes_required ?? decision.userYesRequired));
  const safetyStopGuard = String(decision && (decision.safety_stop_guard || decision.safetyStopGuard) || 'active').trim() || 'active';
  const countSummary = `承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount}`;
  const messages = {
    ready_for_commit: `[ready_for_commit] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    ready_for_review: `[ready_for_review] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    request_fix: `[request_fix] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    stop_and_investigate: `[stop_and_investigate] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    blocked_interactive_host: `[blocked_interactive_host] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    blocked_by_interactive_prompt: `[blocked_by_interactive_prompt] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    blocked: `[blocked] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    safety_stop: `[safety_stop] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
    wait_for_result: `[wait_for_result] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / ${countSummary} / executionHost: ${executionHost} / executionHostAllowed: ${executionHostAllowed !== false ? 'true' : 'false'} / interactiveHostBlocked: ${interactiveHostBlocked ? 'true' : 'false'} / interactivePromptBlocked: ${interactivePromptBlocked ? 'true' : 'false'} / noYesGateRuntime: ${noYesGateRuntime !== false ? 'true' : 'false'} / safeSpawnActive: ${safeSpawnActive !== false ? 'true' : 'false'} / manualCodeUiAllowed: ${manualCodeUiAllowed ? 'true' : 'false'} / officialRoute: ${officialRoute} / codexYesHellGuard: ${codexYesHellGuard} / codexAutoApproveMode: ${codexAutoApproveMode} / userYesRequired: ${userYesRequired ? 'true' : 'false'} / safetyStopGuard: ${safetyStopGuard} / retryCount: ${retryCount}`,
  };
  return messages[decisionStatus] || `${safeTitle} の実装結果を ${safeAgent} から受け取りました。`;
}

function parseJsonBody(req, callback) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body || '{}'); } catch { /* ignore */ }
    callback(parsed);
  });
}

const _sseClients = new Set();
const _sseLog = [];
const _SSE_LOG_MAX = 100;

function _emitRunnerSSE(event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  _sseLog.push({ event, data });
  if (_sseLog.length > _SSE_LOG_MAX) _sseLog.shift();
  for (const client of _sseClients) {
    try { client.write(line); } catch (_) { _sseClients.delete(client); }
  }
}

// ── Dev OS router bridge ──────────────────────────────────────────────────────
// POST task → localhost:8091/api/dev-os → { route, route_label }
// 2-second timeout; on failure returns null so caller uses fallback.
function _callDevOsRouter(task, workdir) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({ task, workdir }));
    const devOsPort = Number(process.env.DEV_OS_PORT || 8091);
    const req = http.request(
      { hostname: '127.0.0.1', port: devOsPort, path: '/api/dev-os', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (!parsed.ok) return reject(new Error(parsed.error || 'dev-os !ok'));
            resolve({ route: parsed.route, route_label: parsed.route_label || parsed.route });
          } catch (e) { reject(e); }
        });
      },
    );
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('dev-os router timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createLiveCockpitServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8080);
  const host = options.host || '0.0.0.0';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/snapshot') {
      try {
        const confirmationBridge = detectConfirmation();
        const snapshot = collectLiveCockpitSnapshot({
          activeRepoPath: options.activeRepoPath,
          devRepoPath: options.devRepoPath,
          salesRepoPath: options.salesRepoPath,
          projectRegistryPath: options.projectRegistryPath,
          workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
          workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
          workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
          shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
          confirmationBridge,
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify(snapshot, null, 2));
      } catch (snapshotErr) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: snapshotErr && snapshotErr.message ? snapshotErr.message : String(snapshotErr) }));
      }
      return;
    }

    if (url.pathname === '/api/confirmation') {
      const result = detectConfirmation();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    if (url.pathname === '/api/work-orders/approve') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        try {
          const result = approveWorkOrder(parsed, {
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            approvedBy: options.approvedBy,
          });
          let activityLogged = false;
          try {
            const ap = result.approval;
            const riskPart = ap.risk_level ? ` / risk:${ap.risk_level}` : '';
            appendShellAgentActivityEvent({
              shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
              agent: 'KOSAME',
              project: targetRepoToProject(ap.target_repo),
              status: 'human_gate',
              task: ap.title || '作業票採用',
              message: `作業票を採用しました。dispatch待ちです。${riskPart}`,
            });
            activityLogged = true;
          } catch {
            // best-effort: activity log failure does not fail the approval
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ...result, activityLogged }));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'invalid work order' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/work-orders/handoff') {
      if (req.method === 'GET') {
        const latest = readLatestWorkOrderHandoff({
          workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
          workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify(latest, null, 2));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        try {
          const snapshot = collectLiveCockpitSnapshot({
            activeRepoPath: options.activeRepoPath,
            devRepoPath: options.devRepoPath,
            salesRepoPath: options.salesRepoPath,
            projectRegistryPath: options.projectRegistryPath,
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
            shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
            confirmationBridge: detectConfirmation(),
          });
          const latestApproved = snapshot.latestApprovedWorkOrder || null;
          if (!latestApproved) {
            throw new Error('承認済みの作業票がありません。');
          }
          if (parsed.work_order_id && String(parsed.work_order_id) !== String(latestApproved.approval_id || '')) {
            throw new Error('work_order_id が承認済みの作業票と一致しません。');
          }
          const status = parsed.status || 'handed_to_agent';
          const result = recordWorkOrderHandoff({
            ...parsed,
            status,
            work_order: parsed.work_order || latestApproved,
            latestApprovedWorkOrder: latestApproved,
            assigned_agent: parsed.assigned_agent || latestApproved.agent,
          }, {
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            latestApprovedWorkOrder: latestApproved,
          });

          let activityLogged = false;
          try {
            const handoff = result.latestHandoffWorkOrder;
            appendShellAgentActivityEvent({
              shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
              agent: 'KOSAME',
              project: targetRepoToProject(handoff.target_repo),
              status: handoff.status,
              task: 'work order handoff',
              message: buildHandoffActivityMessage(handoff.status, handoff.title),
            });
            activityLogged = true;
          } catch {
            // best-effort logging only
          }

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({
            ...result,
            ok: true,
            status: result.latestHandoffWorkOrder ? result.latestHandoffWorkOrder.status : status,
            activityLogged,
            latestHandoffWorkOrder: result.latestHandoffWorkOrder,
          }));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'invalid handoff' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/chat') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        console.log('[CHAT] received:', String(parsed && parsed.message || '').slice(0, 80));
        let contextSummary = '';
        let contextStatus = 'unavailable';
        let snapshot = null;
        try {
          const confirmationBridge = detectConfirmation();
          snapshot = collectLiveCockpitSnapshot({
            activeRepoPath: options.activeRepoPath,
            devRepoPath: options.devRepoPath,
            salesRepoPath: options.salesRepoPath,
            projectRegistryPath: options.projectRegistryPath,
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
            shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
            confirmationBridge,
          });
          const consoleContext = buildConsoleContextSummary(snapshot);
          contextSummary = consoleContext.summary;
          contextStatus = consoleContext.status;
        } catch {
          contextSummary = '';
          contextStatus = 'unavailable';
          snapshot = null;
        }

        const decisionContext = `${parsed.contextSummary || parsed.context || ''}`;
        const shouldAttachDecisionFields = /workOrderDecision=|workOrderResult=/.test(decisionContext);
        handleChatRequest({
          ...parsed,
          contextSummary: parsed.contextSummary || contextSummary,
          contextStatus: parsed.contextStatus || contextStatus,
          consoleContextSummary: contextSummary,
          consoleContextStatus: contextStatus,
          latestWorkOrderResult: shouldAttachDecisionFields && snapshot && snapshot.latestWorkOrderResult ? snapshot.latestWorkOrderResult : null,
          workOrderResultQueue: shouldAttachDecisionFields && snapshot && Array.isArray(snapshot.workOrderResultQueue) ? snapshot.workOrderResultQueue : [],
          latestWorkOrderDecision: shouldAttachDecisionFields && snapshot && snapshot.latestWorkOrderDecision ? snapshot.latestWorkOrderDecision : null,
          workOrderDecisionQueue: shouldAttachDecisionFields && snapshot && Array.isArray(snapshot.workOrderDecisionQueue) ? snapshot.workOrderDecisionQueue : [],
          latestApprovedWorkOrder: shouldAttachDecisionFields && snapshot && snapshot.latestApprovedWorkOrder ? snapshot.latestApprovedWorkOrder : null,
          latestHandoffWorkOrder: shouldAttachDecisionFields && snapshot && snapshot.latestHandoffWorkOrder ? snapshot.latestHandoffWorkOrder : null,
        }).then((result) => {
          // Stream chat reply to AGENT STREAM LOG via SSE
          if (result && result.ok && result.reply) {
            try {
              _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'KOSAME', msg: result.reply });
            } catch (_) {}
          }
          const statusCode = result && result.ok === false ? 400 : 200;
          res.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify(result));
        }).catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '内部エラーが発生しました。' }));
        });
      });
      return;
    }

    if (url.pathname === '/api/handoff') {
      if (req.method === 'GET') {
        try {
          const result = readLatestHandoffInbox({ handoffDir: options.handoffDir });
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({
            ok: true,
            latestHandoff: result.latest || null,
            handoffDir: result.handoffDir,
            latestPath: result.latestPath,
            queuePath: result.queuePath,
            count: result.count,
          }));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'cannot read handoff inbox' }));
        }
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        try {
          const result = saveHandoffInbox(parsed, { handoffDir: options.handoffDir });
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({
            ok: true,
            handoffDir: result.handoffDir,
            saved_at: result.saved_at,
            latestHandoff: result.latestHandoff,
            latestPath: result.latestPath,
            queuePath: result.queuePath,
            message: 'Inboxに保存しました。Runner Queue が official route で自動実行します。',
          }));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'invalid handoff payload' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/work-orders/result') {
      if (req.method === 'GET') {
        const latestHandoff = readLatestWorkOrderHandoff({
          workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
          workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
        });
        const latest = readLatestWorkOrderResult({
          workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
          workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
          workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
          latestHandoffWorkOrder: latestHandoff.latestHandoffWorkOrder || null,
        });
        const latestDecision = buildWorkOrderResultDecision({
          latestWorkOrderResult: latest.latestWorkOrderResult || null,
          latestHandoffWorkOrder: latest.latestHandoffWorkOrder || latestHandoff.latestHandoffWorkOrder || null,
          latestApprovedWorkOrder: latest.latestApprovedWorkOrder || latestHandoff.latestHandoffWorkOrder || null,
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify({ ...latest, latestWorkOrderDecision: latestDecision }, null, 2));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        try {
          const snapshot = collectLiveCockpitSnapshot({
            activeRepoPath: options.activeRepoPath,
            devRepoPath: options.devRepoPath,
            salesRepoPath: options.salesRepoPath,
            projectRegistryPath: options.projectRegistryPath,
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
            shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
            confirmationBridge: detectConfirmation(),
          });
          const latestHandoff = snapshot.latestHandoffWorkOrder || null;
          if (!latestHandoff) {
            throw new Error('handoff 済みの作業票がありません。');
          }
          if (!['handed_to_agent', 'waiting_result'].includes(String(latestHandoff.status || ''))) {
            throw new Error('結果貼り戻しは handoff 済みの作業票のみ可能です。');
          }
          const incomingWorkOrderId = String(parsed.work_order_id || parsed.approval_id || parsed.handoff_id || '').trim();
          const latestApprovalId = String(latestHandoff.approval_id || latestHandoff.work_order_id || '').trim();
          if (incomingWorkOrderId && incomingWorkOrderId !== latestApprovalId) {
            throw new Error('work_order_id が handoff 中の作業票と一致しません。');
          }
          const result = recordWorkOrderResult({
            ...parsed,
            work_order_id: incomingWorkOrderId || latestApprovalId,
            approval_id: incomingWorkOrderId || latestApprovalId,
            handoff_id: latestHandoff.handoff_id || latestApprovalId,
            work_order: latestHandoff,
            source: parsed.source || 'kosame-console',
          }, {
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
            latestApprovedWorkOrder: latestHandoff,
            latestHandoffWorkOrder: latestHandoff,
          });

          const latestResult = result.latestWorkOrderResult || null;
          const latestDecision = buildWorkOrderResultDecision({
            latestWorkOrderResult: latestResult,
            latestHandoffWorkOrder: result.latestHandoffWorkOrder || latestHandoff,
            latestApprovedWorkOrder: latestHandoff,
          });
          appendPipelineStageEvent({
            stage: 'result.decision.updated',
            status: latestDecision.decision_status === 'ready_for_commit' || latestDecision.decision_status === 'ready_for_review'
              ? 'success'
              : latestDecision.decision_status === 'stop_and_investigate'
                ? 'failed'
                : 'running',
            workOrderId: latestResult ? (latestResult.work_order_id || latestResult.approval_id || latestResult.handoff_id || '') : (latestHandoff.work_order_id || latestHandoff.approval_id || ''),
            attachmentCount: Array.isArray(latestHandoff.attachments) ? latestHandoff.attachments.length : 0,
            attachmentIds: Array.isArray(latestHandoff.attachments) ? latestHandoff.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
            manifestPath: String(latestHandoff.attachment_manifest_path || latestHandoff.attachmentManifestPath || ''),
            route: String(latestDecision.route || latestHandoff.route || 'zero-confirm'),
            executionHost: String(latestDecision.execution_host || latestDecision.executionHost || latestResult?.execution_host || latestResult?.executionHost || latestHandoff.execution_host || latestHandoff.executionHost || 'kosame-runner'),
            executionHostAllowed: latestDecision.execution_host_allowed ?? latestDecision.executionHostAllowed ?? latestResult?.execution_host_allowed ?? latestResult?.executionHostAllowed,
            interactiveHostBlocked: latestDecision.interactive_host_blocked ?? latestDecision.interactiveHostBlocked ?? latestResult?.interactive_host_blocked ?? latestResult?.interactiveHostBlocked,
            interactivePromptBlocked: latestDecision.interactive_prompt_blocked ?? latestDecision.interactivePromptBlocked ?? latestResult?.interactive_prompt_blocked ?? latestResult?.interactivePromptBlocked,
            noYesGateRuntime: latestDecision.no_yes_gate_runtime ?? latestDecision.noYesGateRuntime ?? latestResult?.no_yes_gate_runtime ?? latestResult?.noYesGateRuntime,
            safeSpawnActive: latestDecision.safe_spawn_active ?? latestDecision.safeSpawnActive ?? latestResult?.safe_spawn_active ?? latestResult?.safeSpawnActive,
            manualCodeUiAllowed: latestDecision.manual_code_ui_allowed ?? latestDecision.manualCodeUiAllowed ?? latestResult?.manual_code_ui_allowed ?? latestResult?.manualCodeUiAllowed,
            officialRoute: String(latestDecision.official_route || latestDecision.officialRoute || latestResult?.official_route || latestResult?.officialRoute || 'Console → Handoff → Runner'),
            codexYesHellGuard: String(latestDecision.codex_yes_hell_guard || latestDecision.codexYesHellGuard || latestResult?.codex_yes_hell_guard || latestResult?.codexYesHellGuard || 'active').trim() || 'active',
            codexAutoApproveMode: String(latestDecision.codex_auto_approve_mode || latestDecision.codexAutoApproveMode || latestResult?.codex_auto_approve_mode || latestResult?.codexAutoApproveMode || 'active').trim() || 'active',
            userYesRequired: !!(latestDecision.user_yes_required ?? latestDecision.userYesRequired ?? latestResult?.user_yes_required ?? latestResult?.userYesRequired),
            safetyStopGuard: String(latestDecision.safety_stop_guard || latestDecision.safetyStopGuard || latestResult?.safety_stop_guard || latestResult?.safetyStopGuard || 'active').trim() || 'active',
            timestamp: new Date().toISOString(),
            message: `Result Decision updated: ${latestDecision.decision_status} / ${latestDecision.result_post || 'resultPOST待ち'}`,
          }, { agent: 'KOSAME', task: 'result.decision.updated' });
          let activityLogged = false;
          try {
            if (latestResult) {
              appendShellAgentActivityEvent({
                shellAgentActivityLogPath: options.shellAgentActivityLogPath || process.env[SHELL_ACTIVITY_LOG_PATH_ENV],
                agent: 'KOSAME',
                project: 'KOSAME Dev Orchestra',
                status: latestDecision.decision_status === 'ready_for_commit' || latestDecision.decision_status === 'ready_for_review'
                  ? 'review_ready'
                  : latestDecision.decision_status === 'stop_and_investigate'
                    ? 'needs_attention'
                    : latestDecision.decision_status === 'request_fix'
                      ? 'revision_needed'
                      : latestResult.activity_status || latestDecision.activity_status,
                task: 'work order result decision',
                message: buildResultActivityMessage(latestDecision, latestResult.title, latestResult.assigned_agent || latestHandoff.assigned_agent || latestHandoff.recommended_agent),
              });
              activityLogged = true;
            }
          } catch {
            // best-effort logging only
          }

          const refreshed = readLatestWorkOrderResult({
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            workOrderHandoffLogPath: options.workOrderHandoffLogPath || process.env[HANDOFF_LOG_PATH_ENV],
            workOrderResultLogPath: options.workOrderResultLogPath || process.env[RESULT_LOG_PATH_ENV],
            latestHandoffWorkOrder: latestHandoff,
          });

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({
            ok: true,
            ...result,
            latestWorkOrderResult: refreshed.latestWorkOrderResult || latestResult || null,
            latestHandoffWorkOrder: refreshed.latestHandoffWorkOrder || latestHandoff,
            latestWorkOrderDecision: buildWorkOrderResultDecision({
              latestWorkOrderResult: refreshed.latestWorkOrderResult || latestResult || null,
              latestHandoffWorkOrder: refreshed.latestHandoffWorkOrder || latestHandoff,
              latestApprovedWorkOrder: latestHandoff,
            }),
            activityLogged,
            nextRecommendedAction: (refreshed.latestWorkOrderResult && refreshed.latestWorkOrderResult.nextRecommendedAction) || result.latestWorkOrderResult?.nextRecommendedAction || latestDecision.nextRecommendedAction || 'wait_for_result',
          }, null, 2));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'invalid work order result' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/runner-stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
      for (const e of _sseLog) {
        res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
      }
      _sseClients.add(res);
      req.on('close', () => { _sseClients.delete(res); });
      return;
    }

    if (url.pathname === '/api/runner-dispatch') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, async (parsed) => {
        try {
          const ticketId = `chat-${Date.now()}`;
          const promptText = String(parsed.prompt_text || parsed.message || '').trim();
          const title = String(parsed.title || promptText || 'KOSAME Chat Dispatch').slice(0, 80);
          const targetRepo = String(parsed.target_repo || '').trim() || ROOT;
          const requestedRoute = String(parsed.route || '').trim();

          _emitRunnerSSE('log', {
            ts: new Date().toISOString(), agent: 'RUNNER',
            msg: `[START] zero-confirm dispatch 開始 — ${title}`,
          });

          // ── Dev OS route classification ─────────────────────────────────────
          let devOsRoute = requestedRoute || 'claude_code';
          let devOsRouteLabel = requestedRoute || 'Claude Code';
          let devOsWarning = null;
          if (!requestedRoute) {
            try {
              const devOsResult = await _callDevOsRouter(promptText, targetRepo);
              devOsRoute = devOsResult.route || devOsRoute;
              devOsRouteLabel = devOsResult.route_label || devOsRoute;
            } catch (e) {
              devOsWarning = String(e.message || e);
            }
          }
          _emitRunnerSSE('log', {
            ts: new Date().toISOString(), agent: 'DEV-OS',
            msg: `[route] ${devOsRouteLabel}${devOsWarning ? ' [fallback]' : ''} — ${title}`,
          });

          appendPipelineStageEvent({
            stage: 'runner.dispatch.started',
            status: 'running',
            workOrderId: ticketId,
            attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0,
            attachmentIds: Array.isArray(parsed.attachments) ? parsed.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
            manifestPath: String(parsed.attachmentManifestPath || parsed.attachment_manifest_path || ''),
            route: devOsRoute,
            timestamp: new Date().toISOString(),
            message: `Runner dispatch を開始します: ${title}`,
          }, { agent: 'RUNNER', task: 'runner.dispatch.started' });
          const payload = {
            id: ticketId,
            title,
            prompt_text: promptText,
            target_repo: targetRepo,
            assigned_agent: devOsRoute,
            risk_level: String(parsed.risk_level || 'low').trim(),
            human_gate_required: false,
            source: 'kosame-chat-dispatch',
            created_at: new Date().toISOString(),
          };
          saveHandoffInbox(payload, { handoffDir: options.handoffDir });
          _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: `[dispatch] ${ticketId} — ${title}` });

          _emitRunnerSSE('log', {
            ts: new Date().toISOString(), agent: 'RUNNER',
            msg: `[RUNNING] Runner Queue — processTicket 起動 id=${ticketId}`,
          });

          let result;
          try {
            result = processTicket(payload, { runsDir: path.join(ROOT, '.kosame-runner', 'runs') });
          } catch (procErr) {
            result = { status: 'failed', exitCode: 1, error: String(procErr.message || procErr) };
          }

          const ok = result && (result.status === 'completed' || result.exitCode === 0);
          appendPipelineStageEvent({
            stage: 'runner.dispatch.completed',
            status: ok ? 'success' : 'failed',
            workOrderId: ticketId,
            attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0,
            attachmentIds: Array.isArray(parsed.attachments) ? parsed.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
            manifestPath: String(parsed.attachmentManifestPath || parsed.attachment_manifest_path || ''),
            route: devOsRoute,
            timestamp: new Date().toISOString(),
            message: ok ? `Runner dispatch completed for ${ticketId}` : `Runner dispatch failed: ${result.error || ''}`,
          }, { agent: 'RUNNER', task: 'runner.dispatch.completed' });
          _emitRunnerSSE('log', {
            ts: new Date().toISOString(), agent: 'RUNNER',
            msg: `[DONE] zero-confirm dispatch 完了 status=${result.status} — ${title}`,
          });
          _emitRunnerSSE('done', { ts: new Date().toISOString(), exitCode: result.exitCode, ticketId, title });
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: true, ticketId, title }));
        } catch (error) {
          res.writeHead(400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'dispatch failed' }));
        }
      });
      return;
    }

    if (url.pathname === '/api/runner-notify') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      parseJsonBody(req, (parsed) => {
        const message = String(parsed && parsed.message || '').trim().slice(0, 400);
        if (message) {
          _emitRunnerSSE('notify', { ts: new Date().toISOString(), agent: 'RUNNER', msg: message });
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // ── Executor status / deepseek handoff API (v113.3.114) ──────────────────

    if (url.pathname === '/api/executor/latest') {
      const latestPath = path.join(ROOT, '.kosame-executor', 'latest.md');
      if (!fs.existsSync(latestPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, type: 'latest', empty: true, status: 'no_handoff', reason: 'latest.md not found' }));
        return;
      }
      const content = fs.readFileSync(latestPath, 'utf8');
      // Parse lane/status/ticket_id from latest.md
      const laneMatch = content.match(/^lane:\s*(.+)$/m);
      const statusMatch = content.match(/^status:\s*(.+)$/m);
      const ticketMatch = content.match(/^ticket_id:\s*(.+)$/m);
      const updatedMatch = content.match(/^updated_at:\s*(.+)$/m);
      const reasonMatch = content.match(/^reason:\s*(.+)$/m);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({
        ok: true,
        type: 'latest',
        empty: false,
        content,
        status: statusMatch ? statusMatch[1].trim() : 'unknown',
        lane: laneMatch ? laneMatch[1].trim() : null,
        ticket_id: ticketMatch ? ticketMatch[1].trim() : null,
        updated_at: updatedMatch ? updatedMatch[1].trim() : null,
        reason: reasonMatch ? reasonMatch[1].trim() : null,
        path: latestPath,
      }));
      return;
    }

    if (url.pathname === '/api/executor/deepseek-handoff') {
      const handoffPath = path.join(ROOT, '.kosame-executor', 'latest-deepseek.md');
      if (!fs.existsSync(handoffPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, type: 'handoff', empty: true, status: 'no_handoff', reason: 'latest-deepseek.md not found' }));
        return;
      }
      const content = fs.readFileSync(handoffPath, 'utf8');
      const ticketMatch = content.match(/^ticket_id:\s*(.+)$/m);
      const genMatch = content.match(/^generated_at:\s*(.+)$/m);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({
        ok: true,
        type: 'handoff',
        empty: false,
        status: 'handoff_ready',
        content,
        ticket_id: ticketMatch ? ticketMatch[1].trim() : null,
        generated_at: genMatch ? genMatch[1].trim() : null,
        path: handoffPath,
      }));
      return;
    }

    // ── DeepSeek result intake (v113.3.115) ─────────────────────────────────

    if (url.pathname === '/api/executor/deepseek-result') {
      if (req.method === 'POST') {
        parseJsonBody(req, (parsed) => {
          try {
            const rawText = String(parsed.raw_text || '').trim();
            const ticketId = String(parsed.ticket_id || '').trim();
            if (!rawText) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
              res.end(JSON.stringify({ ok: false, reason: 'raw_text is required' }));
              return;
            }

            // Extract KOSAME_DEEPSEEK_RESULT block
            const blockRe = /KOSAME_DEEPSEEK_RESULT_BEGIN\n([\s\S]*?)\nKOSAME_DEEPSEEK_RESULT_END/;
            const blockMatch = rawText.match(blockRe);
            if (!blockMatch) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
              res.end(JSON.stringify({ ok: false, reason: 'KOSAME_DEEPSEEK_RESULT_BEGIN/END block not found in raw_text' }));
              return;
            }

            const blockContent = blockMatch[1].trim();

            // Blocked checks on the result
            const blockedPatterns = [/\.env\b/i, /credentials/i, /SECRET/i, /private\s*key/i, /\/home\/lavie\/repos\/transcriber/, /\/home\/lavie\/repos\/kosame-sales-dx/];
            for (const bp of blockedPatterns) {
              if (bp.test(blockContent)) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
                res.end(JSON.stringify({ ok: false, reason: 'result contains blocked content (secret/api keys/credentials/transcriber/sales-dx)' }));
                return;
              }
            }

            // Parse individual fields
            const getField = (label) => { const m = blockContent.match(new RegExp(`^${label}:\\s*(.+)$`, 'm')); return m ? m[1].trim() : ''; };
            const getMultiLineField = (label) => {
              const re = new RegExp(`^${label}:\\s*\\n((?:-\\s.*\\n?)*)`, 'm');
              const m = blockContent.match(re);
              if (!m) return [];
              return m[1].split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
            };

            const parsedResult = {
              status: getField('status'),
              ticket_id: getField('ticket_id') || ticketId,
              summary: getField('summary'),
              changed_files: getMultiLineField('changed_files'),
              verification: getMultiLineField('verification'),
              commit: getField('commit'),
              notes: getField('notes'),
              raw_block: blockMatch[0],
              received_at: new Date().toISOString(),
            };

            ensureDir(EXECUTOR_DIR);
            const resultMdPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.md');
            const resultJsonPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.json');

            // Write markdown
            const mdLines = [
              '# DeepSeek Result',
              `received_at: ${parsedResult.received_at}`,
              `status: ${parsedResult.status}`,
              `ticket_id: ${parsedResult.ticket_id}`,
              `summary: ${parsedResult.summary}`,
              '',
              '## Changed Files',
              parsedResult.changed_files.length ? parsedResult.changed_files.map(f => `- ${f}`).join('\n') : '- (none)',
              '',
              '## Verification',
              parsedResult.verification.length ? parsedResult.verification.map(v => `- ${v}`).join('\n') : '- (none)',
              '',
              `commit: ${parsedResult.commit}`,
              `notes: ${parsedResult.notes}`,
              '',
              '## Raw Block',
              '',
              '```',
              blockMatch[0],
              '```',
              '',
            ].join('\n');
            fs.writeFileSync(resultMdPath, mdLines);

            // Write JSON
            fs.writeFileSync(resultJsonPath, JSON.stringify(parsedResult, null, 2) + '\n');

            // Save to history
            saveHistory('result', parsedResult, parsedResult.ticket_id, 'received');

            // Update latest.md with result status
            const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
            const latestContent = fs.existsSync(latestPath) ? fs.readFileSync(latestPath, 'utf8') : '';
            const latestUpdated = latestContent
              ? latestContent.replace(/^status: .+$/m, `status: deepseek_result_received`)
              : `# KOSAME Runner — Latest Executor Status\nupdated_at: ${parsedResult.received_at}\nstatus: deepseek_result_received\nticket_id: ${parsedResult.ticket_id}\n`;
            fs.writeFileSync(latestPath, latestUpdated);

            _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: `[DEEPSEEK RESULT] received status=${parsedResult.status} ticket=${parsedResult.ticket_id} — ${parsedResult.summary.slice(0, 80)}` });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(JSON.stringify({ ok: true, type: 'result', status: parsedResult.status, result: parsedResult, path: resultJsonPath }));
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(JSON.stringify({ ok: false, reason: String(err.message || err) }));
          }
        });
        return;
      }

      // GET
      const resultJsonPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.json');
      if (!fs.existsSync(resultJsonPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, type: 'result', empty: true, status: 'no_result', reason: 'latest-deepseek-result.json not found' }));
        return;
      }
      try {
        const resultData = JSON.parse(fs.readFileSync(resultJsonPath, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, type: 'result', empty: false, status: resultData.status || 'received', ...resultData, path: resultJsonPath }));
      } catch (_) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: false, type: 'result', reason: 'latest-deepseek-result.json is malformed' }));
      }
      return;
    }

    // ── DeepSeek result action API (v113.3.116) ──────────────────────────────

    if (url.pathname === '/api/executor/deepseek-result/action') {
      if (req.method === 'POST') {
        parseJsonBody(req, (parsed) => {
          try {
            const action = String(parsed.action || '').trim().toLowerCase();
            const ticketId = String(parsed.ticket_id || '').trim();
            const reason = String(parsed.reason || '').trim();
            const nextInstruction = String(parsed.next_instruction || '').trim();

            if (!action || !['accept', 'revise', 'reject'].includes(action)) {
              res.writeHead(200, JSON_HEADERS);
              res.end(JSON.stringify({ ok: false, reason: 'action must be accept | revise | reject' }));
              return;
            }

            // Blocked checks
            const blockedText = [action, reason, nextInstruction].join(' ');
            const blockedPatterns = [/\.env\b/i, /credentials/i, /SECRET/i, /private\s*key/i, /\/home\/lavie\/repos\/transcriber/, /\/home\/lavie\/repos\/kosame-sales-dx/, /\btranscriber\b/i, /kosame-sales-dx/i];
            for (const bp of blockedPatterns) {
              if (bp.test(blockedText)) {
                writeLatestBlocked('action contains blocked content', ticketId || '—');
                res.writeHead(200, JSON_HEADERS);
                res.end(JSON.stringify({ ok: false, reason: 'action/reason/instruction contains blocked content' }));
                return;
              }
            }

            const actionObj = {
              action,
              ticket_id: ticketId,
              reason: reason || null,
              next_instruction: nextInstruction || null,
              created_at: new Date().toISOString(),
            };

            ensureDir(EXECUTOR_DIR);
            const actionJsonPath = path.join(EXECUTOR_DIR, 'latest-deepseek-action.json');
            const actionMdPath = path.join(EXECUTOR_DIR, 'latest-deepseek-action.md');

            // Write JSON
            fs.writeFileSync(actionJsonPath, JSON.stringify(actionObj, null, 2) + '\n');

            // Write MD
            const mdLines = [
              '# DeepSeek Result Action',
              `action: ${actionObj.action}`,
              `ticket_id: ${actionObj.ticket_id || '—'}`,
              `created_at: ${actionObj.created_at}`,
              reason ? `reason: ${reason}` : null,
              nextInstruction ? `next_instruction: ${nextInstruction}` : null,
              '',
            ].filter(Boolean).join('\n');
            fs.writeFileSync(actionMdPath, mdLines);

            // Update latest.md
            const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
            const latestContent = fs.existsSync(latestPath) ? fs.readFileSync(latestPath, 'utf8') : '';
            let latestUpdated;
            if (latestContent) {
              latestUpdated = latestContent
                .replace(/^status: .+$/m, 'status: deepseek_result_actioned')
                .replace(/^action: .+$/m, `action: ${action}`)
                .replace(/^reason: .+$/m, reason ? `reason: ${reason}` : '');
              if (!latestUpdated.includes('\naction: ')) latestUpdated += `\naction: ${action}`;
              if (reason && !latestContent.includes('\nreason: ')) latestUpdated += `\nreason: ${reason}`;
            } else {
              latestUpdated = `# KOSAME Runner — Latest Executor Status\nupdated_at: ${actionObj.created_at}\nstatus: deepseek_result_actioned\naction: ${action}\nticket_id: ${actionObj.ticket_id}\n`;
              if (reason) latestUpdated += `reason: ${reason}\n`;
            }
            fs.writeFileSync(latestPath, latestUpdated);

            // Handle revision
            let revisionPath = null;
            if (action === 'revise') {
              // Read previous result for context
              let prevSummary = '';
              let prevChangedFiles = [];
              let prevVerification = [];
              try {
                const resultJsonPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.json');
                if (fs.existsSync(resultJsonPath)) {
                  const prevResult = JSON.parse(fs.readFileSync(resultJsonPath, 'utf8'));
                  prevSummary = prevResult.summary || '';
                  prevChangedFiles = prevResult.changed_files || [];
                  prevVerification = prevResult.verification || [];
                }
              } catch (_) {}

              const { writeRevisionHandoffFile } = require('./kosame-runner-queue');
              revisionPath = writeRevisionHandoffFile(ticketId, prevSummary, prevChangedFiles, prevVerification, reason, nextInstruction);

              // Save revision to history
              if (revisionPath) {
                try {
                  const historyDir = path.join(EXECUTOR_DIR, 'history');
                  ensureDir(historyDir);
                  const ts = new Date().toISOString().replace(/[:.]/g, '-');
                  const revisionContent = fs.readFileSync(revisionPath, 'utf8');
                  const revEntry = { type: 'revision', timestamp: new Date().toISOString(), ticket_id: ticketId, action: 'revise', path: revisionPath };
                  const revFname = `${ts}-revision.json`;
                  fs.writeFileSync(path.join(historyDir, revFname), JSON.stringify(revEntry, null, 2) + '\n');
                  // Also copy the revision md
                  const revMdName = `${ts}-revision.md`;
                  fs.copyFileSync(revisionPath, path.join(historyDir, revMdName));
                } catch (_) {}
              }
            }

            // Save to history
            saveHistory('action', actionObj, ticketId, action);

            _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: `[DEEPSEEK ACTION] ${action} ticket=${ticketId}` });

            const response = {
              ok: true,
              type: 'action',
              status: 'action_' + action,
              action,
              ticket_id: ticketId,
              reason: reason || null,
              created_at: actionObj.created_at,
              saved_json_path: actionJsonPath,
              saved_md_path: actionMdPath,
              revision_path: revisionPath,
              latest_path: latestPath,
            };
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify(response));
          } catch (err) {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify({ ok: false, reason: String(err.message || err) }));
          }
        });
        return;
      }

      // GET: return latest action
      const actionJsonPath = path.join(EXECUTOR_DIR, 'latest-deepseek-action.json');
      if (!fs.existsSync(actionJsonPath)) {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, type: 'action', empty: true, status: 'no_action', reason: 'latest-deepseek-action.json not found' }));
        return;
      }
      try {
        const actionData = JSON.parse(fs.readFileSync(actionJsonPath, 'utf8'));
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, type: 'action', empty: false, status: 'action_' + (actionData.action || 'unknown'), ...actionData, path: actionJsonPath }));
      } catch (_) {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, type: 'action', reason: 'latest-deepseek-action.json is malformed' }));
      }
      return;
    }

    // ── DeepSeek workflow history API (v113.3.116) ──────────────────────────

    if (url.pathname === '/api/executor/history') {
      const historyDir = path.join(EXECUTOR_DIR, 'history');
      if (!fs.existsSync(historyDir)) {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, type: 'history', count: 0, items: [] }));
        return;
      }
      const files = fs.readdirSync(historyDir).sort().reverse().slice(0, 20);
      const items = [];
      for (const f of files) {
        const fp = path.join(historyDir, f);
        if (!f.endsWith('.json') || !fs.statSync(fp).isFile()) continue;
        try {
          const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
          // Normalize history item shape
          data._path = fp;
          items.push(data);
        } catch (_) { /* skip malformed */ }
      }
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ ok: true, type: 'history', count: items.length, items }));
      return;
    }

    // ── Release Readiness API (v113.3.119) ──────────────────────────────────

    if (url.pathname === '/api/executor/readiness') {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      const blockers = [];
      const warnings = [];
      let readiness = 'ready';

      // ── Blocker checks ──
      const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
      if (fs.existsSync(latestPath)) {
        try {
          const latestContent = fs.readFileSync(latestPath, 'utf8');
          if (latestContent.includes('blocked')) {
            blockers.push('latest.md status is blocked');
            readiness = 'blocked';
          }
        } catch (_) {}
      }

      // Check for blocked content in source files
      const checkFiles = ['tools/kosame-runner-queue.js', 'tools/kosame-live-cockpit-server.js', 'public/kosame-live-cockpit.html'];
      for (const fp of checkFiles) {
        try {
          const c = fs.readFileSync(path.join(ROOT, fp), 'utf8');
          if (/\.env\b/i.test(c) && /secret|key|password/i.test(c)) {
            blockers.push(fp + ' may contain env/secret references');
            readiness = 'blocked';
          }
        } catch (_) {}
      }

      // ── Warning checks ──
      const resultPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.json');
      const actionPath = path.join(EXECUTOR_DIR, 'latest-deepseek-action.json');
      if (!fs.existsSync(resultPath)) {
        warnings.push('no DeepSeek result intake yet');
        if (readiness === 'ready') readiness = 'caution';
      }
      if (!fs.existsSync(actionPath)) {
        warnings.push('no DeepSeek action recorded yet');
        if (readiness === 'ready') readiness = 'caution';
      }

      const historyDir = path.join(EXECUTOR_DIR, 'history');
      if (!fs.existsSync(historyDir) || fs.readdirSync(historyDir).filter(f => f.endsWith('.json')).length === 0) {
        warnings.push('workflow history is empty');
        if (readiness === 'ready') readiness = 'caution';
      }

      // Check public/test.html for smoke residue
      try {
        const testHtml = path.join(ROOT, 'public', 'test.html');
        if (fs.existsSync(testHtml)) {
          const testContent = fs.readFileSync(testHtml, 'utf8');
          if (testContent.includes('KOSAME_') && testContent.includes('Hello World')) {
            warnings.push('public/test.html has smoke test markers');
          }
        }
      } catch (_) {}

      // ── Verify smoke scripts registered ──
      const requiredSmokes = ['v113-3-112', 'v113-3-114', 'v113-3-115', 'v113-3-116', 'v113-3-117', 'v113-3-118', 'v113-3-119'];
      for (const sv of requiredSmokes) {
        const key = 'smoke:' + sv;
        if (!pkg.scripts || !pkg.scripts[key]) {
          warnings.push(key + ' not in package.json');
          if (readiness === 'ready') readiness = 'caution';
        }
      }

      // Parse latest status
      let latestStatus = 'unknown', latestLane = 'unknown', latestConfidentiality = null, latestDifficulty = null;
      if (fs.existsSync(latestPath)) {
        try {
          const lc = fs.readFileSync(latestPath, 'utf8');
          const sm = lc.match(/^status:\s*(.+)$/m);
          const lm = lc.match(/^lane:\s*(.+)$/m);
          const cm = lc.match(/^confidentiality:\s*(.+)$/m);
          const dm = lc.match(/^difficulty:\s*(.+)$/m);
          if (sm) latestStatus = sm[1].trim();
          if (lm) latestLane = lm[1].trim();
          if (cm) latestConfidentiality = cm[1].trim();
          if (dm) latestDifficulty = dm[1].trim();
        } catch (_) {}
      }

      const nextActions = [];
      if (readiness !== 'blocked') {
        if (!fs.existsSync(resultPath)) nextActions.push('intake DeepSeek result');
        if (!fs.existsSync(actionPath)) nextActions.push('review and action result');
        if (fs.existsSync(actionPath) && fs.existsSync(resultPath)) nextActions.push('run npm run verify');
      }
      if (readiness === 'blocked') nextActions.push('resolve blockers first');
      if (readiness === 'caution') nextActions.push('resolve warnings for full readiness');
      if (readiness === 'ready') nextActions.push('ready for release gate');

      const rcSummary = [
        '# KOSAME Dev Orchestra RC80 Summary',
        `version: ${pkg.version}`,
        `readiness: ${readiness}`,
        `latest_status: ${latestStatus}`,
        `latest_lane: ${latestLane}`,
        `confidentiality: ${latestConfidentiality || '—'}`,
        `difficulty: ${latestDifficulty || '—'}`,
        '',
        '## Available Lanes',
        '- L0_LOCAL: Local Executor',
        '- L1_DEEPSEEK_V4_FLASH: DeepSeek V4 Flash (low difficulty)',
        '- L2_DEEPSEEK_V4_PRO: DeepSeek V4 Pro (medium difficulty)',
        '- L3_DEEPSEEK_V4_PRO_AUDIT: DeepSeek V4 Pro + Audit (high difficulty)',
        '- INTERNAL_ONLY: GPT/こさめ (sensitive)',
        '- BLOCKED: forbidden',
        '',
        '## Blockers',
        blockers.length ? blockers.map(b => '- ' + b).join('\n') : '- (none)',
        '',
        '## Warnings',
        warnings.length ? warnings.map(w => '- ' + w).join('\n') : '- (none)',
        '',
        '## Next Actions',
        nextActions.map(a => '- ' + a).join('\n'),
        '',
        `generated_at: ${new Date().toISOString()}`,
        '',
      ].join('\n');

      // Write rc80-summary.md (generated artifact, not committed)
      try {
        ensureDir(EXECUTOR_DIR);
        fs.writeFileSync(path.join(EXECUTOR_DIR, 'rc80-summary.md'), rcSummary);
      } catch (_) {}

      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({
        ok: true,
        readiness,
        version: pkg.version,
        latest_status: latestStatus,
        latest_lane: latestLane,
        latest_confidentiality: latestConfidentiality,
        latest_difficulty: latestDifficulty,
        verify_hint: 'npm run verify',
        blockers,
        warnings,
        next_actions: nextActions,
        rc_summary: rcSummary,
      }));
      return;
    }

    // ── RC80 Summary API (v113.3.119) ───────────────────────────────────────

    if (url.pathname === '/api/executor/rc-summary') {
      const rcPath = path.join(EXECUTOR_DIR, 'rc80-summary.md');
      if (fs.existsSync(rcPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, content: fs.readFileSync(rcPath, 'utf8'), path: rcPath }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, empty: true, reason: 'rc80-summary.md not found. Call GET /api/executor/readiness first.' }));
      }
      return;
    }

    // ── Judge API (v113.3.120) ──────────────────────────────────────────────

    if (url.pathname === '/api/executor/judge') {
      if (req.method === 'POST') {
        parseJsonBody(req, (parsed) => {
          try {
            const judgeStatus = String(parsed.judge_status || '').trim().toLowerCase();
            if (!judgeStatus || !['pending_judge','judge_accept','judge_revise','judge_reject','judge_human_gate'].includes(judgeStatus)) {
              res.writeHead(200, JSON_HEADERS);
              res.end(JSON.stringify({ ok: false, reason: 'judge_status must be pending_judge|judge_accept|judge_revise|judge_reject|judge_human_gate' }));
              return;
            }
            const judge = {
              ticket_id: String(parsed.ticket_id || '').trim() || null,
              judge_status: judgeStatus,
              judge_reason: String(parsed.judge_reason || '').trim() || null,
              next_action: String(parsed.next_action || '').trim() || null,
              human_gate_required: Boolean(parsed.human_gate_required || parsed.judge_status === 'judge_human_gate'),
              model_lane: String(parsed.model_lane || '').trim() || null,
              risk_level: String(parsed.risk_level || '').trim() || null,
              final_owner: 'GPT/KOSAME',
              updated_at: new Date().toISOString(),
            };
            ensureDir(EXECUTOR_DIR);
            fs.writeFileSync(path.join(EXECUTOR_DIR, 'latest-judge.json'), JSON.stringify(judge, null, 2) + '\n');
            const jmd = ['# Final Judge', `judge_status: ${judge.judge_status}`, `ticket_id: ${judge.ticket_id || '—'}`,
              `updated_at: ${judge.updated_at}`, judge.judge_reason ? `judge_reason: ${judge.judge_reason}` : null,
              judge.next_action ? `next_action: ${judge.next_action}` : null,
              `human_gate_required: ${judge.human_gate_required}`, judge.model_lane ? `model_lane: ${judge.model_lane}` : null,
              `final_owner: ${judge.final_owner}`, '',
            ].filter(Boolean).join('\n');
            fs.writeFileSync(path.join(EXECUTOR_DIR, 'latest-judge.md'), jmd);
            _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'KOSAME', msg: `[JUDGE] ${judgeStatus}` });
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify({ ok: true, type: 'judge', status: judgeStatus, ...judge }));
          } catch (err) {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify({ ok: false, reason: String(err.message || err) }));
          }
        });
        return;
      }
      const judgePath = path.join(EXECUTOR_DIR, 'latest-judge.json');
      if (!fs.existsSync(judgePath)) {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, type: 'judge', empty: true, status: 'pending_judge' }));
        return;
      }
      try {
        const jd = JSON.parse(fs.readFileSync(judgePath, 'utf8'));
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, type: 'judge', empty: false, status: jd.judge_status || 'pending_judge', ...jd, path: judgePath }));
      } catch (_) {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, type: 'judge', reason: 'latest-judge.json is malformed' }));
      }
      return;
    }

    // ── Release Gate API (v113.3.120) ───────────────────────────────────────

    if (url.pathname === '/api/executor/release-gate') {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      const blockers = [];
      const warnings = [];
      const requiredHuman = [];
      const forbidden = ['git add -A', 'git add .', 'rm -rf /', 'npm publish without review', 'deploy without gate', 'push without gate', 'Sales DX operation', 'transcriber operation', 'customer data exposure', 'credentials exposure', '.env exposure'];
      let gate = 'open';

      // Check latest status
      const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
      if (fs.existsSync(latestPath)) {
        try {
          const lc = fs.readFileSync(latestPath, 'utf8');
          if (lc.includes('blocked')) { blockers.push('latest.md status is blocked'); gate = 'blocked'; }
        } catch (_) {}
      }

      // Check judge status
      const judgePath = path.join(EXECUTOR_DIR, 'latest-judge.json');
      if (fs.existsSync(judgePath)) {
        try {
          const jd = JSON.parse(fs.readFileSync(judgePath, 'utf8'));
          if (jd.judge_status === 'judge_human_gate') { gate = 'human_gate'; }
          if (jd.human_gate_required && gate !== 'human_gate') { gate = 'human_gate'; }
        } catch (_) {}
      }

      // Check result/action presence
      const resultPath = path.join(EXECUTOR_DIR, 'latest-deepseek-result.json');
      const actionPath = path.join(EXECUTOR_DIR, 'latest-deepseek-action.json');
      if (!fs.existsSync(resultPath)) { warnings.push('no DeepSeek result'); if (gate === 'open') gate = 'caution'; }
      if (!fs.existsSync(actionPath)) { warnings.push('no DeepSeek action'); if (gate === 'open') gate = 'caution'; }

      // Human gate requires
      requiredHuman.push('commit: requires npm run verify PASS');
      requiredHuman.push('tag: requires release gate open');
      requiredHuman.push('push: requires gate !== blocked');
      requiredHuman.push('deploy: requires human gate clear');

      const nextActions = [];
      if (gate === 'blocked') nextActions.push('resolve blockers first');
      if (gate === 'human_gate') nextActions.push('human gate approval required');
      if (gate === 'caution') nextActions.push('resolve warnings for release');
      if (gate === 'open') nextActions.push('npm run verify, then commit/push');

      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({
        ok: true, gate, version: pkg.version,
        reason: gate === 'blocked' ? blockers.join('; ') : gate === 'human_gate' ? 'human gate required' : gate === 'caution' ? 'warnings present' : 'release gate open',
        blockers, warnings, required_human_actions: requiredHuman,
        forbidden_actions: forbidden, next_actions: nextActions,
      }));
      return;
    }

    // ── RC100 Summary API (v113.3.120) ──────────────────────────────────────

    if (url.pathname === '/api/executor/rc100-summary') {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      let readiness = 'ready', judgeStatus = 'pending_judge', releaseGate = 'open';
      try {
        const rp = path.join(EXECUTOR_DIR, 'rc80-summary.md');
        if (fs.existsSync(rp)) {
          const rc = fs.readFileSync(rp, 'utf8');
          if (rc.includes('readiness: blocked')) readiness = 'blocked';
          else if (rc.includes('readiness: caution')) readiness = 'caution';
        }
      } catch (_) {}
      try {
        const jp = path.join(EXECUTOR_DIR, 'latest-judge.json');
        if (fs.existsSync(jp)) {
          const jd = JSON.parse(fs.readFileSync(jp, 'utf8'));
          judgeStatus = jd.judge_status || 'pending_judge';
        }
      } catch (_) {}
      try {
        // Quick release gate check
        const latestPath = path.join(EXECUTOR_DIR, 'latest.md');
        if (fs.existsSync(latestPath)) {
          const lc = fs.readFileSync(latestPath, 'utf8');
          if (lc.includes('blocked')) releaseGate = 'blocked';
          else if (!fs.existsSync(path.join(EXECUTOR_DIR, 'latest-deepseek-result.json'))) releaseGate = 'caution';
        }
      } catch (_) {}

      const rc100 = [
        '# KOSAME Dev Orchestra RC100 Summary',
        `version: ${pkg.version}`,
        `completion_estimate: 100%`,
        `readiness: ${readiness}`,
        `release_gate: ${releaseGate}`,
        `judge_status: ${judgeStatus}`,
        '',
        '## Model Routing Rules',
        '- L0_LOCAL: simple append/replace/create',
        '- L1_DEEPSEEK_V4_FLASH: safe/sanitized + low difficulty',
        '- L2_DEEPSEEK_V4_PRO: safe/sanitized + medium difficulty',
        '- L3_DEEPSEEK_V4_PRO_AUDIT: safe/sanitized + high difficulty',
        '- INTERNAL_ONLY: sensitive (GPT/こさめ)',
        '- BLOCKED: forbidden',
        '',
        '## Human Gate Rules',
        '- commit/tag/push/deploy → human gate required',
        '- IAM/billing/production → human gate required',
        '- Secret/.env/credentials/customer data exposure → blocked',
        '- sales-dx/transcriber → forbidden',
        '- GPT/こさめ final judge required for sensitive tasks',
        '',
        '## Operational Validation Remaining',
        '- P3 UI polish',
        '- tuning difficulty scoring with operational data',
        '- automated smoke residue cleanup',
        '',
        `generated_at: ${new Date().toISOString()}`,
        '',
      ].join('\n');

      ensureDir(EXECUTOR_DIR);
      fs.writeFileSync(path.join(EXECUTOR_DIR, 'rc100-summary.md'), rc100);

      // Generate handoff-latest.md
      const handoff = [
        '# KOSAME Dev Orchestra Handoff Latest',
        `version: ${pkg.version}`,
        `generated_at: ${new Date().toISOString()}`,
        `readiness: ${readiness}`,
        `release_gate: ${releaseGate}`,
        `judge_status: ${judgeStatus}`,
        '',
        '## Model Lane Rules',
        '- L0: local, L1: V4 Flash, L2: V4 Pro, L3: V4 Pro+Audit',
        '- Confidentiality gate before difficulty check',
        '- Sensitive → INTERNAL_ONLY, Forbidden → BLOCKED',
        '',
        '## Forbidden Operations',
        '- git add -A / git add .',
        '- rm -rf / delete operations',
        '- Sales DX / transcriber access',
        '- Secret / .env / credentials exposure',
        '- auto push / auto deploy',
        '',
        '## Human Gate Rules',
        '- commit/push/deploy require human approval',
        '- Codex/Claude prohibited',
        '',
        '## Next Action',
        '- npm run verify',
        '- Check release gate',
        '- Review judge status',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(EXECUTOR_DIR, 'handoff-latest.md'), handoff);

      // Generate recovery-checklist.md
      const recovery = [
        '# KOSAME Dev Orchestra Recovery Checklist',
        `generated_at: ${new Date().toISOString()}`,
        '',
        '## Immediate Recovery',
        '- 1. npm run verify',
        '- 2. npm run dev-os:autopilot (if available)',
        '- 3. git status',
        '- 4. Check public/test.html for smoke residue',
        '',
        '## Generated Files Check',
        '- .kosame-executor/latest.md',
        '- .kosame-executor/latest-deepseek.md',
        '- .kosame-executor/latest-deepseek-result.json',
        '- .kosame-executor/latest-deepseek-action.json',
        '- .kosame-executor/latest-judge.json',
        '- .kosame-executor/history/',
        '',
        '## Pre-Push Checklist',
        '- npm run verify PASS',
        '- Release gate NOT blocked',
        '- No .env or credentials in diff',
        '- No sales-dx/transcriber paths in diff',
        '- Judge_status reviewed',
        '- git add performed individually (not git add -A)',
        '',
        '## Forbidden to Touch',
        '- /home/lavie/repos/transcriber',
        '- /home/lavie/repos/kosame-sales-dx',
        '- .env / credentials / Secret files',
        '- Customer data',
        '- Insurance logic',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(EXECUTOR_DIR, 'recovery-checklist.md'), recovery);

      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({
        ok: true,
        version: pkg.version,
        completion_estimate: '100%',
        readiness,
        release_gate: releaseGate,
        judge_status: judgeStatus,
        handoff_path: path.join(EXECUTOR_DIR, 'handoff-latest.md'),
        recovery_path: path.join(EXECUTOR_DIR, 'recovery-checklist.md'),
        rc_summary: rc100,
      }));
      return;
    }

    // ── Handoff/Recovery APIs (v113.3.120) ─────────────────────────────────

    if (url.pathname === '/api/executor/handoff') {
      const hp = path.join(EXECUTOR_DIR, 'handoff-latest.md');
      if (fs.existsSync(hp)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, content: fs.readFileSync(hp, 'utf8'), path: hp }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, empty: true, reason: 'Call GET /api/executor/rc100-summary to generate' }));
      }
      return;
    }

    if (url.pathname === '/api/executor/recovery') {
      const rp = path.join(EXECUTOR_DIR, 'recovery-checklist.md');
      if (fs.existsSync(rp)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, content: fs.readFileSync(rp, 'utf8'), path: rp }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ ok: true, empty: true, reason: 'Call GET /api/executor/rc100-summary to generate' }));
      }
      return;
    }

    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    // Static file serving from public/ — prevents path traversal and serves correct MIME type
    const _STATIC_MIME = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    const _pubDir = path.join(ROOT, 'public');
    const _reqFile = path.join(_pubDir, url.pathname);
    const _reqResolved = path.resolve(_reqFile);
    const _isInPublic = _reqResolved.startsWith(_pubDir + path.sep) || _reqResolved === _pubDir;
    if (url.pathname !== '/' && _isInPublic && fs.existsSync(_reqResolved) && fs.statSync(_reqResolved).isFile()) {
      const _ext = path.extname(_reqResolved).toLowerCase();
      const _mime = _STATIC_MIME[_ext] || 'application/octet-stream';
      try {
        const _content = fs.readFileSync(_reqResolved);
        res.writeHead(200, {
          'Content-Type': _mime,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(_content);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Error reading static file: ${error.message}`);
      }
      return;
    }

    // Default: serve kosame-live-cockpit.html for / and unknown paths
    try {
      const html = readHtml();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`KOSAME Live Cockpit HTML not found: ${error.message}`);
    }
  });

  return { server, port, host };
}

function main() {
  const _envPath = path.resolve(__dirname, '..', '.env');
  const _keyPresent = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
  const _liveEnabled = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
  console.log(`[SERVER] .env: ${_envPath}`);
  console.log(`[SERVER] KEY_PRESENT=${_keyPresent} LIVE_CALLS_ENABLED=${_liveEnabled}`);
  const { server, port, host } = createLiveCockpitServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER] ポート ${port} は使用中です。既存プロセスを確認してください: lsof -i :${port}`);
      console.error(`[SERVER] 別プロセスを停止してから再起動してください。`);
    } else {
      console.error(`[SERVER] 起動エラー: ${err.message}`);
    }
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`☂️ KOSAME Console v${require('../package.json').version} listening on http://${host}:${port}`);
    _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'SERVER', msg: `起動 KEY_PRESENT=${_keyPresent} LIVE_CALLS_ENABLED=${_liveEnabled}` });
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createLiveCockpitServer,
};
