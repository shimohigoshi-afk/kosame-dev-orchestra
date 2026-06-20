#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/chat',
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
  console.log('=== v110.84.20 kosame chat work order draft lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.20'), `package version must be >= 110.84.20 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-20'], 'smoke:v110-84-20 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-20'), 'verify must include smoke:v110-84-20');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('work_order'), 'HTML must preserve work_order payload support');
  assert.ok(html.includes('renderWorkOrderCard'), 'HTML must render work order cards');
  assert.ok(html.includes('chat-work-order-card'), 'HTML must include work order card markup');
  assert.ok(html.includes('chat-work-order-prompt'), 'HTML must include prompt textarea for copy area');
  assert.ok(html.includes('コピー用'), 'HTML must include copy label');
  assert.ok(html.includes('human gate required'), 'HTML must show human gate status for work orders');
  assert.ok(html.includes('work_order: data.work_order || null'), 'HTML must keep work order pass-through from API response');
  console.log('  PASS: HTML work order UI wiring');

  const chatSource = read(CHAT_SERVER_PATH);
  assert.ok(chatSource.includes('buildWorkOrderReply'), 'chat server must include work order reply builder');
  assert.ok(chatSource.includes('detectWorkOrderIntent'), 'chat server must detect work order intent');
  assert.ok(chatSource.includes('resolveWorkOrderTarget'), 'chat server must resolve target repo');
  assert.ok(chatSource.includes('git status -sb'), 'work order prompt must mention git status -sb');
  assert.ok(chatSource.includes('git add . / git add -Aは禁止'), 'work order prompt must deny git add . / git add -A');
  assert.ok(chatSource.includes('機密情報・環境変数ファイル・認証情報・APIキーは読まない'), 'work order prompt must deny secret reads');
  assert.ok(chatSource.includes('外部APIを呼ばない'), 'work order prompt must deny external API calls');
  console.log('  PASS: chat server work order safety wiring');

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
      const sales = await requestJson(port, {
        message: 'Sales DX v0.3.1の作業票を作って',
        project: 'Sales DX',
        context: 'currentVersion=110.84.20; changed=11; verify=PASS',
      });
      assert.equal(sales.statusCode, 200, 'sales dx work order request must return 200');
      assert.equal(sales.body.ok, true, 'sales dx work order request must be ok');
      assert.equal(sales.body.human_gate_required, true, 'sales dx work order must require human gate');
      assert.ok(sales.body.work_order, 'sales dx work order must be included');
      assert.equal(sales.body.work_order.agent, 'Codex', 'work order agent must be Codex');
      assert.equal(sales.body.work_order.target_repo, '/home/lavie/repos/kosame-sales-dx', 'sales dx must route to kosame-sales-dx repo');
      assert.equal(sales.body.work_order.requires_human_confirmation, true, 'work order must require human confirmation');
      assert.ok(/Sales DX|v0\.3\.1/.test(sales.body.work_order.title), 'work order title must reflect the request');
      assert.ok(sales.body.work_order.prompt.includes('cd /home/lavie/repos/kosame-sales-dx'), 'prompt must start from target repo');
      assert.ok(sales.body.work_order.prompt.includes('commit/tag/pushは未実行で止める'), 'prompt must include stop condition');
      assert.ok(sales.body.work_order.prompt.includes('git add . / git add -Aは禁止'), 'prompt must include git add restriction');
      assert.ok(sales.body.work_order.prompt.includes('機密情報・環境変数ファイル・認証情報・APIキーは読まない'), 'prompt must include secret restriction');
      assert.ok(sales.body.work_order.prompt.includes('外部APIを呼ばない'), 'prompt must include external API restriction');
      assert.ok(sales.body.work_order.prompt.includes('対象repo以外を触らない'), 'prompt must include repo boundary restriction');
      assert.ok(sales.body.work_order.prompt.includes('git status -sb'), 'prompt must include git status -sb');
      assert.ok(/codex:watch|自動でディスパッチ/.test(sales.body.reply), 'reply must reference codex:watch dispatch');
      console.log('  PASS: Sales DX work order routing');

      const kosame = await requestJson(port, {
        message: 'KOSAME Consoleの作業票を作って',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.20; changed=2; verify=PASS',
      });
      assert.equal(kosame.statusCode, 200, 'kosame console work order request must return 200');
      assert.equal(kosame.body.ok, true, 'kosame console work order request must be ok');
      assert.ok(kosame.body.work_order, 'kosame console work order must be included');
      assert.equal(kosame.body.work_order.target_repo, '/home/lavie/kosame-dev-orchestra', 'kosame console must route to kosame-dev-orchestra repo');
      assert.equal(kosame.body.work_order.agent, 'Codex', 'work order agent must be Codex');
      assert.ok(kosame.body.work_order.prompt.includes('cd /home/lavie/kosame-dev-orchestra'), 'prompt must target kosame-dev-orchestra repo');
      console.log('  PASS: KOSAME Console work order routing');

      const ambiguous = await requestJson(port, {
        message: '作業票作って',
        project: '',
        context: 'currentVersion=110.84.20; verify=PASS',
      });
      assert.equal(ambiguous.statusCode, 200, 'ambiguous work order request must still respond');
      assert.equal(ambiguous.body.ok, true, 'ambiguous request must stay ok');
      assert.equal(ambiguous.body.work_order, undefined, 'ambiguous request must not guess a repo');
      assert.ok(/Sales DX|KOSAME Console/.test(ambiguous.body.reply), 'ambiguous request must ask for target project');
      console.log('  PASS: ambiguous work order request asks for confirmation');

      const status = await requestJson(port, {
        message: '今の状況を教えて',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.20; changed=11; verify=PASS',
      });
      assert.equal(status.statusCode, 200, 'status request must return 200');
      assert.equal(status.body.ok, true, 'status request must be ok');
      assert.ok(!status.body.work_order, 'status request must not include work order');
      assert.ok(!status.body.reply.includes('currentVersion='), 'status reply must stay natural');
      assert.ok(/確認中|変更|verify/.test(status.body.reply), 'status reply must stay natural');
      console.log('  PASS: natural status reply preserved');

      const nextAction = await requestJson(port, {
        message: '次なにする？',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.20; changed=2; verify=PASS',
      });
      assert.equal(nextAction.statusCode, 200, 'next action request must return 200');
      assert.equal(nextAction.body.ok, true, 'next action request must be ok');
      assert.ok(!nextAction.body.work_order, 'next action request must not include work order');
      assert.ok(/次の一手|正本化|進める/.test(nextAction.body.reply), 'next action reply must stay natural');
      console.log('  PASS: natural next action reply preserved');
    }
  } finally {
    await new Promise((resolve) => {
      try {
        server.close(resolve);
      } catch {
        resolve();
      }
    });
  }

  console.log('✅ v110.84.20 kosame chat work order draft lite smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
