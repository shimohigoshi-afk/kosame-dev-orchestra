#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const {
  HANDOFF_TARGET_REPO,
  createCodexHandoffBridgeServer,
  getLatestPath,
  getQueuePath,
  readLatestHandoffInbox,
  readHandoffQueue,
  saveHandoffInbox,
  sanitizeHandoffPayload,
} = require('../tools/kosame-codex-handoff-bridge-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-codex-handoff-bridge-server.js');
const INBOX_PATH = path.join(ROOT, 'tools', 'kosame-codex-handoff-inbox.js');
const LIVE_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-27-handoff-'));
const SECRET_SENTINEL = 'sk-HANDOFF-LEAK-1234567890';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, pathname, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(raw || '{}'), raw });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (method !== 'GET') req.write(JSON.stringify(body || {}));
    req.end();
  });
}

function assertNoLeak(text, label) {
  assert.ok(typeof text === 'string', `${label} must be text`);
  assert.ok(!text.includes(SECRET_SENTINEL), `${label} must not leak sentinel`);
}

function assertPackageWiring() {
  assert.ok(isVersionAtLeast(pkg.version, '110.84.28'), `package version must be 110.84.28+ compatible (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-27'], 'smoke:v110-84-27 must exist');
  assert.ok(pkg.scripts['handoff:bridge'], 'handoff:bridge must exist');
  assert.ok(pkg.scripts['handoff:latest'], 'handoff:latest must exist');
  assert.ok(pkg.scripts['handoff:list'], 'handoff:list must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-27'), 'verify must include smoke:v110-84-27');
}

function assertStaticWiring() {
  const html = read(HTML_PATH);
  assert.ok(html.includes('Handoff Inboxへ送る'), 'HTML must include handoff inbox send button');
  assert.ok(html.includes('localhost handoff bridge'), 'HTML must mention localhost handoff bridge');
  assert.ok(html.includes('runner:watch') || html.includes('Runner watcher'), 'HTML must reference runner watcher dispatch automation');
  assert.ok(html.includes('handoff-inbox-status'), 'HTML must include handoff inbox status');
  assert.ok(html.includes('handoff-inbox-panel'), 'HTML must include handoff inbox panel');
  assert.ok(html.includes('work-order-handoff-queue'), 'HTML must keep the handoff queue');
  assert.ok(html.includes('work-order-result-decision-panel'), 'HTML must keep the result decision panel');
  assert.ok(!html.includes('tmux send-keys'), 'HTML must not contain tmux send-keys');
  assert.ok(!html.includes('xdotool'), 'HTML must not contain xdotool');
  assert.ok(!html.includes('SendKeys'), 'HTML must not contain SendKeys');
  assertNoLeak(html, 'HTML');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('/api/handoff'), 'bridge server must expose /api/handoff');
  assert.ok(serverSource.includes('saveHandoffInbox'), 'bridge server must save handoff inbox');
  assert.ok(serverSource.includes('readLatestHandoffInbox'), 'bridge server must read latest handoff inbox');
  assert.ok(!/child_process/.test(serverSource), 'bridge server must not spawn shell commands');
  assert.ok(!/exec(File|Sync)?\s*\(/.test(serverSource), 'bridge server must not execute shell commands');
  assert.ok(!/spawn\s*\(/.test(serverSource), 'bridge server must not spawn shell commands');
  assert.ok(!/curl\s*\|\s*bash/i.test(serverSource), 'bridge server must not contain curl|bash automation');
  assert.ok(!/git\s+push/i.test(serverSource), 'bridge server must not contain git push automation');
  assert.ok(!/git\s+tag/i.test(serverSource), 'bridge server must not contain git tag automation');

  const inboxSource = read(INBOX_PATH);
  assert.ok(inboxSource.includes('latestPath'), 'inbox helper must show latestPath');
  assert.ok(inboxSource.includes('queuePath'), 'inbox helper must show queuePath');
  assert.ok(inboxSource.includes('readLatestHandoffInbox'), 'inbox helper must read latest handoff');
  assert.ok(inboxSource.includes('readHandoffQueue'), 'inbox helper must list queue');

  const liveServerSource = read(LIVE_SERVER_PATH);
  assert.ok(liveServerSource.includes('/api/handoff'), 'live server must expose /api/handoff');
  assert.ok(liveServerSource.includes('saveHandoffInbox'), 'live server must use handoff inbox saver');

  const gitignore = read(path.join(ROOT, '.gitignore'));
  assert.ok(gitignore.includes('.kosame-handoff/'), '.gitignore must exclude .kosame-handoff/');
}

function makePayload(overrides = {}) {
  return {
    id: overrides.id || 'handoff-001',
    title: overrides.title || 'Codex Handoff Bridge Lite',
    target_repo: overrides.target_repo || HANDOFF_TARGET_REPO,
    assigned_agent: overrides.assigned_agent || 'Codex',
    risk_level: overrides.risk_level || 'medium',
    human_gate_required: overrides.human_gate_required !== false,
    prompt_text: overrides.prompt_text || [
      'cd /home/lavie/kosame-dev-orchestra',
      '',
      'Codex Handoff Bridge Lite の内容を確認してください。',
      '',
      '安全条件:',
      '- commit/tag/pushは未実行で止める',
      '- git add . / git add -Aは禁止',
      '- 外部APIを呼ばない',
      '- 対象repo以外を触らない',
      '- git status -sb',
    ].join('\n'),
    created_at: overrides.created_at || '2026-06-19T00:00:00.000Z',
    source: overrides.source || 'kosame_console',
  };
}

function assertSavedBundle(result, label, handoffDir) {
  assert.ok(result && result.ok, `${label} must be ok`);
  assert.ok(result.latestPath.endsWith('latest.md'), `${label} latestPath must end with latest.md`);
  assert.ok(result.queuePath.endsWith('queue.jsonl'), `${label} queuePath must end with queue.jsonl`);
  assert.ok(fs.existsSync(result.latestPath), `${label} latest.md must exist`);
  assert.ok(fs.existsSync(result.queuePath), `${label} queue.jsonl must exist`);
  assert.equal(result.handoffDir, handoffDir, `${label} should respect custom handoff dir`);
  const latestMarkdown = read(result.latestPath);
  const queueJsonl = read(result.queuePath);
  assertNoLeak(latestMarkdown, `${label} latest.md`);
  assertNoLeak(queueJsonl, `${label} queue.jsonl`);
  assert.ok(latestMarkdown.includes('Runner watcher') || latestMarkdown.includes('runner:watch'), `${label} latest.md must mention runner watcher dispatch`);
}

async function runHttpCycle() {
  const { server } = createCodexHandoffBridgeServer({ handoffDir: TEMP_ROOT });
  try {
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
        if (error && error.code === 'EPERM') resolve(null);
        else reject(error);
      }
    });

    if (port == null) {
      return { server, port: null, usedFallback: true };
    }

    const body = makePayload({ id: 'handoff-http-001' });
    const response = await requestJson(port, '/api/handoff', body, 'POST');
    assert.equal(response.statusCode, 200, 'POST /api/handoff must return 200');
    assert.equal(response.body.ok, true, 'POST /api/handoff must succeed');
    assert.ok(response.body.message.includes('Runner Queue') || response.body.message.includes('official route'), 'POST /api/handoff message must reference runner queue official route');
    assert.ok(fs.existsSync(response.body.latestPath), 'POST /api/handoff latest.md must exist');
    assert.ok(fs.existsSync(response.body.queuePath), 'POST /api/handoff queue.jsonl must exist');
    return { server, port, usedFallback: false, response };
  } finally {
    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}

function assertGuardRejection(fn, label) {
  assert.throws(fn, (error) => {
    assert.ok(error && error.message, `${label} must throw a useful error`);
    return true;
  }, `${label} must reject unsafe payloads`);
}

async function main() {
  assertPackageWiring();
  assertStaticWiring();

  const safePayload = makePayload();
  const sanitized = sanitizeHandoffPayload(safePayload);
  assert.equal(sanitized.target_repo, HANDOFF_TARGET_REPO, 'safe payload must keep target repo');
  assert.ok(sanitized.prompt_text.includes('Codex Handoff Bridge Lite'), 'safe payload must keep prompt text');

  const saved = saveHandoffInbox(safePayload, { handoffDir: TEMP_ROOT });
  assertSavedBundle(saved, 'direct save', TEMP_ROOT);

  const latest = readLatestHandoffInbox({ handoffDir: TEMP_ROOT });
  assert.ok(latest.latest, 'latest handoff inbox entry must exist');
  assert.equal(latest.count, 1, 'latest handoff inbox count must be 1');
  assert.ok(latest.latest.prompt_text.includes('Codex Handoff Bridge Lite'), 'latest handoff inbox must preserve safe prompt');

  const queue = readHandoffQueue({ handoffDir: TEMP_ROOT });
  assert.equal(queue.count, 1, 'handoff queue count must be 1');
  assert.equal(queue.items[0].id, 'handoff-001', 'queue item id must match');

  const salesDxPayload = makePayload({
    id: 'handoff-sales-001',
    title: '営業DX v0.3.0 の作業票',
    prompt_text: [
      '営業DX v0.3.0 の作業票です。',
      'routing policy の確認をお願いします。',
      'email返信文生成や phone follow-up の概念確認だけを行います。',
    ].join('\n'),
  });
  const salesDxSaved = saveHandoffInbox(salesDxPayload, { handoffDir: TEMP_ROOT });
  assertSavedBundle(salesDxSaved, 'sales dx save', TEMP_ROOT);
  const salesDxLatest = readLatestHandoffInbox({ handoffDir: TEMP_ROOT });
  assert.ok(salesDxLatest.latest.title.includes('営業DX v0.3.0'), 'sales dx latest title must remain visible');
  assert.ok(salesDxLatest.latest.prompt_text.includes('routing policy'), 'policy concept must remain visible');

  const policyConceptSaved = saveHandoffInbox(makePayload({
    id: 'handoff-policy-001',
    title: 'policy concept task',
    prompt_text: [
      'routing policy を確認してください。',
      'security policy の整合を確認してください。',
      'email返信文生成や phone follow-up は概念としてのみ扱ってください。',
    ].join('\n'),
  }), { handoffDir: TEMP_ROOT });
  assertSavedBundle(policyConceptSaved, 'policy concept save', TEMP_ROOT);
  const policyConceptLatest = readLatestHandoffInbox({ handoffDir: TEMP_ROOT });
  assert.ok(policyConceptLatest.latest.prompt_text.includes('routing policy'), 'policy concept prompt must remain visible');

  const httpCycle = await runHttpCycle();
  if (!httpCycle.usedFallback) {
    assert.equal(httpCycle.response.body.latestHandoff.id, 'handoff-http-001', 'HTTP save must echo id');
  }

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-transcriber',
    title: 'transcriber leak',
    prompt_text: '/home/lavie/repos/transcriber で作業してください',
  }), { handoffDir: TEMP_ROOT }), 'transcriber guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-shell',
    prompt_text: 'rm -rf /',
  }), { handoffDir: TEMP_ROOT }), 'shell guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-push',
    prompt_text: 'git push origin main',
  }), { handoffDir: TEMP_ROOT }), 'git push guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-deploy',
    prompt_text: 'deploy to prod',
  }), { handoffDir: TEMP_ROOT }), 'deploy guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-secret',
    prompt_text: 'API_KEY=abcdef123456',
  }), { handoffDir: TEMP_ROOT }), 'secret guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-email',
    prompt_text: 'contact me at person@example.com',
  }), { handoffDir: TEMP_ROOT }), 'email guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-phone',
    prompt_text: 'TEL: 090-1234-5678',
  }), { handoffDir: TEMP_ROOT }), 'phone guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-policy',
    prompt_text: 'policy number: 123456',
  }), { handoffDir: TEMP_ROOT }), 'policy guard');

  assertGuardRejection(() => saveHandoffInbox(makePayload({
    id: 'bad-policy-number',
    prompt_text: '保険証券番号: 1234567890',
  }), { handoffDir: TEMP_ROOT }), 'policy number guard');

  assertGuardRejection(() => sanitizeHandoffPayload({
    id: 'bad-target',
    title: 'bad target',
    target_repo: '/home/lavie/repos/transcriber',
    assigned_agent: 'Codex',
    risk_level: 'medium',
    human_gate_required: true,
    prompt_text: 'safe text',
    created_at: '2026-06-19T00:00:00.000Z',
    source: 'kosame_console',
  }), 'target repo guard');

  const bridgeSource = read(SERVER_PATH);
  assert.ok(!/child_process/.test(bridgeSource), 'bridge server must not spawn shell commands');
  assert.ok(!/exec(File|Sync)?\s*\(/.test(bridgeSource), 'bridge server must not execute shell commands');
  assert.ok(!/spawn\s*\(/.test(bridgeSource), 'bridge server must not spawn shell commands');
  assert.ok(!/tmux\s+send-keys/i.test(bridgeSource), 'bridge server must not use tmux send-keys');

  const liveServerSource = read(LIVE_SERVER_PATH);
  assert.ok(liveServerSource.includes('/api/handoff'), 'live server must wire handoff route');

  console.log('PASS: codex handoff bridge wiring');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
