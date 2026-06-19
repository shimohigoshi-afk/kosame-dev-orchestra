#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { collectLiveCockpitSnapshot } = require('./kosame-live-cockpit-snapshot');
const { buildConsoleContextSummary } = require('./kosame-cockpit-context');
const { detectConfirmation } = require('./kosame-confirmation-detector');
const { handleChatRequest } = require('./kosame-cockpit-chat-server');
const { approveWorkOrder, APPROVAL_LOG_PATH_ENV } = require('./kosame-work-order-approval-store');
const { appendShellAgentActivityEvent, SHELL_ACTIVITY_LOG_PATH_ENV } = require('./kosame-shell-agent-activity');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function targetRepoToProject(targetRepo) {
  if (targetRepo === '/home/lavie/kosame-dev-orchestra') return 'KOSAME Dev Orchestra';
  if (targetRepo === '/home/lavie/repos/transcriber') return 'Transcriber';
  return 'KOSAME Project';
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
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch { /* ignore */ }
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
              message: `作業票を採用しました。Codexへ貼り付け待ちです。${riskPart}`,
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

    if (url.pathname === '/api/chat') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch { /* ignore */ }
        let contextSummary = '';
        let contextStatus = 'unavailable';
        try {
          const confirmationBridge = detectConfirmation();
          const snapshot = collectLiveCockpitSnapshot({
            activeRepoPath: options.activeRepoPath,
            devRepoPath: options.devRepoPath,
            salesRepoPath: options.salesRepoPath,
            projectRegistryPath: options.projectRegistryPath,
            workOrderApprovalLogPath: options.workOrderApprovalLogPath || process.env[APPROVAL_LOG_PATH_ENV],
            confirmationBridge,
          });
          const consoleContext = buildConsoleContextSummary(snapshot);
          contextSummary = consoleContext.summary;
          contextStatus = consoleContext.status;
        } catch {
          contextSummary = '';
          contextStatus = 'unavailable';
        }

        handleChatRequest({
          ...parsed,
          contextSummary: parsed.contextSummary || contextSummary,
          contextStatus: parsed.contextStatus || contextStatus,
          consoleContextSummary: contextSummary,
          consoleContextStatus: contextStatus,
        }).then((result) => {
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
  const { server, port, host } = createLiveCockpitServer();
  server.listen(port, host, () => {
    console.log(`☂️ KOSAME Console listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createLiveCockpitServer,
};
