#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const ACTIVITY_PATH = path.join(ROOT, 'tools', 'kosame-shell-agent-activity.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-22-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(raw || '{}') });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== v110.84.22 work order approval activity feed smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.22'), `package version must be >= 110.84.22 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-22'], 'smoke:v110-84-22 must exist in scripts');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-22'), 'verify must include smoke:v110-84-22');
  console.log('  PASS: package wiring');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('appendShellAgentActivityEvent'), 'server must call appendShellAgentActivityEvent on approve');
  assert.ok(serverSource.includes('activityLogged'), 'server must include activityLogged in response');
  assert.ok(serverSource.includes('SHELL_ACTIVITY_LOG_PATH_ENV'), 'server must import SHELL_ACTIVITY_LOG_PATH_ENV for override');
  assert.ok(serverSource.includes('targetRepoToProject'), 'server must have project name helper');
  assert.ok(serverSource.includes("status: 'human_gate'"), 'server must set activity status to human_gate');
  assert.ok(serverSource.includes('作業票を採用しました'), 'server must include approval message in activity');
  console.log('  PASS: server activity bridge wiring');

  const activitySource = read(ACTIVITY_PATH);
  assert.ok(activitySource.includes('SHELL_ACTIVITY_LOG_PATH_ENV'), 'activity module must define env key');
  assert.ok(activitySource.includes("module.exports"), 'activity module must export');
  assert.ok(activitySource.includes('SHELL_ACTIVITY_LOG_PATH_ENV'), 'activity module must export SHELL_ACTIVITY_LOG_PATH_ENV');
  console.log('  PASS: activity module exports');

  const previousApproval = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  const previousActivity = process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = APPROVAL_LOG_PATH;
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = ACTIVITY_LOG_PATH;

  const { server } = createLiveCockpitServer({
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(server.address().port);
      });
    } catch (error) {
      server.off('error', onError);
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    }
  });

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime checks skipped — listen EPERM in this environment');
    } else {
      const chat = await requestJson(port, '/api/chat', {
        message: 'KOSAME Consoleの通知音UIを改善する作業票を作って',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.22; changed=3; verify=PASS',
      });
      assert.equal(chat.statusCode, 200, 'chat request must return 200');
      assert.equal(chat.body.ok, true, 'chat request must be ok');
      assert.ok(chat.body.work_order, 'chat request must include work_order');
      const workOrder = chat.body.work_order;
      console.log('  PASS: work order drafted');

      // v113.3.28+: pipeline telemetry writes chat.received events to the
      // activity log during chat processing, so we no longer assert it's empty
      // before approval — the meaningful check is that the approval event is
      // correctly recorded after approval (asserted below).
      console.log('  PASS: activity log pre-approve check: skipped (pipeline telemetry now writes during chat)');

      const approve = await requestJson(port, '/api/work-orders/approve', {
        work_order: workOrder,
      });
      assert.equal(approve.statusCode, 200, 'approval must return 200');
      assert.equal(approve.body.ok, true, 'approval must be ok');
      assert.equal(approve.body.approval.status, 'approved', 'approval status must be approved');
      assert.equal(approve.body.activityLogged, true, 'activityLogged must be true in response');
      console.log('  PASS: work order approved with activityLogged=true');

      assert.ok(fs.existsSync(ACTIVITY_LOG_PATH), 'activity log must exist after approve');
      const activityRaw = read(ACTIVITY_LOG_PATH);
      const activityLines = activityRaw.trim().split(/\r?\n/).filter(Boolean);
      assert.ok(activityLines.length >= 1, 'activity log must contain at least one entry');
      const event = JSON.parse(activityLines[activityLines.length - 1]);
      assert.equal(event.agent, 'KOSAME', 'activity event agent must be KOSAME');
      assert.equal(event.project, 'KOSAME Dev Orchestra', 'activity event project must match target_repo');
      assert.equal(event.status, 'human_gate', 'activity event status must be human_gate');
      assert.ok(event.task && event.task.length > 0, 'activity event task must be non-empty (work order title)');
      assert.ok(event.message.includes('作業票を採用しました'), 'activity event message must include approval text');
      assert.ok(event.timestamp && event.timestamp.length > 0, 'activity event must have timestamp');
      console.log('  PASS: activity event recorded correctly');

      assert.ok(!activityRaw.includes('sk-'), 'activity log must not contain API key patterns');
      assert.ok(!activityRaw.includes('password'), 'activity log must not contain password');
      assert.ok(!activityRaw.includes('.env'), 'activity log must not contain .env reference');
      console.log('  PASS: activity log safety checks');

      const failApprove = await requestJson(port, '/api/work-orders/approve', {
        work_order: {
          title: 'bad',
          agent: 'Codex',
          target_repo: '/home/lavie/kosame-dev-orchestra',
          risk_level: 'low',
          prompt: 'sk-fake-secret-1234567890abcdef',
          requires_human_confirmation: true,
        },
      });
      assert.ok(failApprove.statusCode >= 400, 'secret-like payload must be rejected');
      const activityAfterFail = read(ACTIVITY_LOG_PATH).trim().split(/\r?\n/).filter(Boolean);
      assert.equal(activityAfterFail.length, activityLines.length, 'activity log must not grow when approval fails');
      console.log('  PASS: activity not written when approval fails');
    }
  } finally {
    await new Promise((resolve) => {
      try { server.close(resolve); } catch { resolve(); }
    });
    if (typeof previousApproval === 'string') {
      process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = previousApproval;
    } else {
      delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
    }
    if (typeof previousActivity === 'string') {
      process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = previousActivity;
    } else {
      delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    }
  }

  console.log('✅ v110.84.22 work order approval activity feed smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
