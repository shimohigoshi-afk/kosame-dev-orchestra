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
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-21-approval-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');

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

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method: 'GET',
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
    req.end();
  });
}

async function main() {
  console.log('=== v110.84.21 kosame chat work order approval bridge lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.21'), `package version must be >= 110.84.21 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-21'], 'smoke:v110-84-21 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-21'), 'verify must include smoke:v110-84-21');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:cloud-run-launch-pack-max'), 'verify must keep cloud run launch pack smoke');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('この作業票を採用'), 'HTML must include approval button');
  assert.ok(html.includes('採用済み / dispatch待ち'), 'HTML must include approved dispatch status');
  assert.ok(html.includes('work-order-approval-status'), 'HTML must include approval summary area');
  assert.ok(html.includes('kosame.cockpit.notificationMode'), 'HTML must keep notification mode localStorage key');
  assert.ok(html.includes('kosame.cockpit.notificationSoundEnabled'), 'HTML must keep notification sound localStorage key');
  assert.ok(html.includes("localStorage.setItem(NOTIFICATION_STORAGE_KEY, enabled ? 'true' : 'false');"), 'HTML must persist notificationSoundEnabled as true/false');
  assert.ok(html.includes("localStorage.setItem(NOTIFICATION_MODE_KEY, mode);"), 'HTML must persist notificationMode separately');
  assert.ok(html.includes('通知音をONにする'), 'HTML must show notification ON button');
  assert.ok(html.includes('通知音をOFFにする'), 'HTML must show notification OFF button');
  assert.ok(html.includes('stateNode.textContent = enabledLabel;'), 'HTML must update visible notification state from one source');
  assert.ok(html.includes('summaryNode.textContent = enabledLabel;'), 'HTML must keep summary state in sync');
  assert.ok(html.includes('soundBadge.textContent = `Sound: ${enabledLabel}`;'), 'HTML must keep badge state in sync');
  assert.ok(!html.includes('通知音 OFF'), 'HTML must not keep ambiguous notification OFF wording');
  assert.ok(!html.includes('Sound: OFF'), 'HTML must not keep old Sound OFF wording');
  assert.ok(!html.includes('sound-hint-legacy'), 'HTML must not keep legacy notification hint');
  assert.ok(html.includes('通知音の状態は上の表示に集約しています。'), 'HTML must explain that state is centralized');
  assert.ok(html.includes('こさめが呼んでます'), 'HTML must keep call pill text');
  console.log('  PASS: HTML approval UI wiring');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('/api/work-orders/approve'), 'server must expose approve API');
  assert.ok(serverSource.includes('approveWorkOrder'), 'server must use approval helper');
  console.log('  PASS: server approval route wiring');

  const previousEnv = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = APPROVAL_LOG_PATH;

  const { server } = createLiveCockpitServer({});
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') {
        resolve(null);
      } else {
        reject(error);
      }
    };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(server.address().port);
      });
    } catch (error) {
      server.off('error', onError);
      if (error && error.code === 'EPERM') {
        resolve(null);
      } else {
        reject(error);
      }
    }
  });

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime checks skipped — listen EPERM in this environment');
    } else {
      const chat = await requestJson(port, '/api/chat', {
        message: 'KOSAME Consoleの作業票を作って',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.21; changed=2; verify=PASS',
      });
      assert.equal(chat.statusCode, 200, 'chat request must return 200');
      assert.equal(chat.body.ok, true, 'chat request must be ok');
      assert.ok(chat.body.work_order, 'chat request must include work_order');
      assert.equal(chat.body.work_order.target_repo, '/home/lavie/kosame-dev-orchestra', 'work order must route to kosame-dev-orchestra');
      console.log('  PASS: chat work order draft');

      const rejectEmpty = await requestJson(port, '/api/work-orders/approve', {});
      assert.ok(rejectEmpty.statusCode >= 400, 'empty approval payload must be rejected');
      assert.equal(rejectEmpty.body.ok, false, 'empty approval payload must set ok=false');
      console.log('  PASS: empty approval rejected');

      const rejectSecret = await requestJson(port, '/api/work-orders/approve', {
        work_order: {
          title: 'test',
          agent: 'Codex',
          target_repo: '/home/lavie/kosame-dev-orchestra',
          risk_level: 'low',
          prompt: 'sk-test-1234567890abcdef',
          requires_human_confirmation: true,
        },
      });
      assert.ok(rejectSecret.statusCode >= 400, 'secret-like approval payload must be rejected');
      assert.equal(rejectSecret.body.ok, false, 'secret-like approval payload must set ok=false');
      console.log('  PASS: secret-like approval rejected');

      const approve = await requestJson(port, '/api/work-orders/approve', {
        work_order: chat.body.work_order,
      });
      assert.equal(approve.statusCode, 200, 'approval request must return 200');
      assert.equal(approve.body.ok, true, 'approval request must be ok');
      assert.equal(approve.body.approval.status, 'approved', 'approval status must be approved');
      assert.equal(approve.body.approval.target_repo, '/home/lavie/kosame-dev-orchestra', 'approval target repo must be preserved');
      assert.ok(fs.existsSync(APPROVAL_LOG_PATH), 'approval log must be written to temp path');
      const logLines = read(APPROVAL_LOG_PATH).trim().split(/\r?\n/).filter(Boolean);
      assert.ok(logLines.length >= 1, 'approval log must contain at least one line');
      assert.ok(!read(APPROVAL_LOG_PATH).includes('sk-test-1234567890abcdef'), 'approval log must not store secret-like text');
      console.log('  PASS: approval persisted safely');

      const snapshot = await getJson(port, '/api/snapshot');
      assert.equal(snapshot.statusCode, 200, 'snapshot endpoint must return 200');
      assert.ok(snapshot.body.latestApprovedWorkOrder, 'snapshot must include latestApprovedWorkOrder');
      assert.equal(snapshot.body.latestApprovedWorkOrder.target_repo, '/home/lavie/kosame-dev-orchestra', 'snapshot latest approved work order must match');
      assert.equal(snapshot.body.latestApprovedWorkOrder.status, 'approved', 'snapshot latest approved work order must be approved');
      console.log('  PASS: snapshot includes latest approved work order');
    }
  } finally {
    await new Promise((resolve) => {
      try {
        server.close(resolve);
      } catch {
        resolve();
      }
    });
    if (typeof previousEnv === 'string') {
      process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = previousEnv;
    } else {
      delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
    }
  }

  console.log('✅ v110.84.21 kosame chat work order approval bridge lite smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
