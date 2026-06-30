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
