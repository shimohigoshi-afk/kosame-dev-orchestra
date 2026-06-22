#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
// Load .env before any module reads process.env at init time
try {
  const _el = require('node:fs').readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8').split('\n');
  for (const _l of _el) { const _m = _l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (_m && !(_m[1] in process.env)) process.env[_m[1]] = _m[2].trim(); }
} catch (_) { /* .env is optional */ }
const http = require('node:http');
const { spawn } = require('node:child_process');
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
const { appendPipelineStageEvent } = require('./kosame-pipeline-telemetry');

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
  const messages = {
    ready_for_commit: `[ready_for_commit] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / 承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount} / retryCount: ${retryCount}`,
    ready_for_review: `[ready_for_review] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / 承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount} / retryCount: ${retryCount}`,
    request_fix: `[request_fix] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / 承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount} / retryCount: ${retryCount}`,
    stop_and_investigate: `[stop_and_investigate] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / 承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount} / retryCount: ${retryCount}`,
    wait_for_result: `[wait_for_result] ${safeTitle} / executor: ${executor} / route: ${route} / resultPOST: ${resultPost} / 承認要求回数: ${approvalCount} / 手動貼付回数: ${manualPasteCount} / 待機要求回数: ${waitCount} / 自動YES回数: ${autoApprovedCount} / 自動遮断回数: ${autoBlockedCount} / retryCount: ${retryCount}`,
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

function createLiveCockpitServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8080);
  const host = options.host || '0.0.0.0';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/snapshot') {
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
            message: 'Inboxに保存しました。codex:watch 起動中なら自動実行されます。',
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
      parseJsonBody(req, (parsed) => {
        try {
          const ticketId = `chat-${Date.now()}`;
          const promptText = String(parsed.prompt_text || parsed.message || '').trim();
          const title = String(parsed.title || promptText || 'KOSAME Chat Dispatch').slice(0, 80);
          const targetRepo = String(parsed.target_repo || '').trim() || ROOT;
          appendPipelineStageEvent({
            stage: 'runner.dispatch.started',
            status: 'running',
            workOrderId: ticketId,
            attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0,
            attachmentIds: Array.isArray(parsed.attachments) ? parsed.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
            manifestPath: String(parsed.attachmentManifestPath || parsed.attachment_manifest_path || ''),
            route: 'zero-confirm',
            timestamp: new Date().toISOString(),
            message: `Runner dispatch を開始します: ${title}`,
          }, { agent: 'RUNNER', task: 'runner.dispatch.started' });
          const payload = {
            id: ticketId,
            title,
            prompt_text: promptText,
            target_repo: targetRepo,
            assigned_agent: String(parsed.assigned_agent || 'Codex').trim(),
            risk_level: String(parsed.risk_level || 'low').trim(),
            human_gate_required: false,
            source: 'kosame-chat-dispatch',
            created_at: new Date().toISOString(),
          };
          saveHandoffInbox(payload, { handoffDir: options.handoffDir });
          _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: `[dispatch] ${ticketId} — ${title}` });
          const child = spawn(process.execPath, [path.join(__dirname, 'kosame-runner-queue.js')], {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
          });
          child.stdout.on('data', (chunk) => {
            String(chunk).split('\n').filter(Boolean).forEach(line => {
              _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: line });
            });
          });
          child.stderr.on('data', (chunk) => {
            String(chunk).split('\n').filter(Boolean).forEach(line => {
              _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'RUNNER', msg: line });
            });
          });
          child.on('close', (code) => {
            appendPipelineStageEvent({
              stage: 'runner.dispatch.completed',
              status: code === 0 ? 'success' : 'failed',
              workOrderId: ticketId,
              attachmentCount: Array.isArray(parsed.attachments) ? parsed.attachments.length : 0,
              attachmentIds: Array.isArray(parsed.attachments) ? parsed.attachments.map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean) : [],
              manifestPath: String(parsed.attachmentManifestPath || parsed.attachment_manifest_path || ''),
              route: 'zero-confirm',
              timestamp: new Date().toISOString(),
              message: code === 0 ? `Runner dispatch completed for ${ticketId}` : `Runner dispatch failed with exitCode=${code}`,
            }, { agent: 'RUNNER', task: 'runner.dispatch.completed' });
            _emitRunnerSSE('done', { ts: new Date().toISOString(), exitCode: code, ticketId, title });
          });
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

    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

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
  server.listen(port, host, () => {
    console.log(`☂️ KOSAME Console listening on http://${host}:${port}`);
    _emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'SERVER', msg: `起動 KEY_PRESENT=${_keyPresent} LIVE_CALLS_ENABLED=${_liveEnabled}` });
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createLiveCockpitServer,
};
