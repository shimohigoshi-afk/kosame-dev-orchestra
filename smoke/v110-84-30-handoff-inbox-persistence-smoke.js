#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');
const {
  HANDOFF_TARGET_REPO,
  createCodexHandoffBridgeServer,
  getLatestPath,
  getQueuePath,
  readLatestHandoffInbox,
  readHandoffQueue,
  sanitizeHandoffPayload,
} = require('../tools/kosame-codex-handoff-bridge-server');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const BRIDGE_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-codex-handoff-bridge-server.js');
const LIVE_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-30-handoff-'));
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
        headers: method === 'GET'
          ? {}
          : { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: JSON.parse(raw || '{}'),
              raw,
            });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (method !== 'GET') req.write(JSON.stringify(body || {}));
    req.end();
  });
}

function requestOptions(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method: 'OPTIONS',
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            raw,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function assertNoLeak(text, label, options = {}) {
  assert.ok(typeof text === 'string', `${label} must be text`);
  assert.ok(!text.includes(SECRET_SENTINEL), `${label} must not leak sentinel`);
  if (options.forbidRawSensitiveWords) {
    assert.ok(!text.includes('.env'), `${label} must not leak .env`);
  }
}

function makeAdoptedPayload() {
  return {
    id: 'handoff-110-84-30',
    title: 'KOSAME Dev Orchestra Handoff Inbox Persistence',
    target_repo: HANDOFF_TARGET_REPO,
    assigned_agent: 'Codex',
    agent: 'Codex',
    risk_level: 'medium',
    human_gate_required: true,
    prompt_text: [
      'cd /home/lavie/kosame-dev-orchestra',
      '',
      'Handoff Inbox persistence smoke を確認してください。',
      '',
      '安全条件:',
      '- commit/tag/pushは未実行で止める',
      '- git add . / git add -Aは禁止',
      '- 外部APIを呼ばない',
      '- 対象repo以外を触らない',
      '- git status -sb',
    ].join('\n'),
    body: [
      'cd /home/lavie/kosame-dev-orchestra',
      '',
      'Handoff Inbox persistence smoke を確認してください。',
    ].join('\n'),
    originalRequest: 'Console上で採用した KOSAME Dev Orchestra 作業票を inbox に保存する',
    original_request: 'Console上で採用した KOSAME Dev Orchestra 作業票を inbox に保存する',
    selectedProjectId: 'kosame-dev-orchestra',
    selected_project_id: 'kosame-dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selected_project_path: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    selected_project_label: 'KOSAME Dev Orchestra',
    safetyConditions: [
      '対象repo以外を触らない',
      'Secret/.env/credentials/API keyを読まない',
      'git add -Aは禁止',
    ],
    safety_conditions: [
      '対象repo以外を触らない',
      'Secret/.env/credentials/API keyを読まない',
      'git add -Aは禁止',
    ],
    reportItems: [
      'latest.md を作成する',
      'queue.jsonl に 1 件追記する',
    ],
    report_items: [
      'latest.md を作成する',
      'queue.jsonl に 1 件追記する',
    ],
    target: {
      id: 'kosame-dev-orchestra',
      label: 'KOSAME Dev Orchestra',
      path: HANDOFF_TARGET_REPO,
    },
    created_at: '2026-06-20T00:00:00.000Z',
    source: 'kosame_console',
  };
}

function maskExpectedText(value) {
  return String(value || '')
    .replace(/\bSecret\b/gi, '[secret]')
    .replace(/\.env\b/gi, '[env]')
    .replace(/\bcredentials?\b/gi, '[credentials]')
    .replace(/\btoken\b/gi, '[token]')
    .replace(/\bpassword\b/gi, '[password]')
    .replace(/\bauthorization\b/gi, '[authorization]')
    .replace(/\bbearer\b/gi, '[bearer]')
    .replace(/\bAPI[_-]?KEY\b/gi, 'API_KEY');
}

function compactExpectedText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMaskedText(value) {
  return String(value || '').replace(/\[\[([^\]]+)\]\]/g, '[$1]');
}

async function runServerCycle(serverFactory, handoffDir, options = {}) {
  const { expectCorsOptions = true } = options;
  const { server } = serverFactory;
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
    if (port == null) return { port: null, skipped: true };

    if (expectCorsOptions) {
      const optionsResponse = await requestOptions(port, '/api/handoff');
      assert.equal(optionsResponse.statusCode, 204, 'OPTIONS /api/handoff must return 204');
      assert.equal(optionsResponse.headers['access-control-allow-origin'], '*', 'CORS allow origin must be wildcard');
    }

    const payload = makeAdoptedPayload();
    const sanitized = sanitizeHandoffPayload(payload);
    assert.equal(sanitized.target_repo, HANDOFF_TARGET_REPO, 'payload target must stay Dev Orchestra');
    assert.equal(sanitized.agent, 'Codex', 'payload agent must be preserved');
    assert.equal(sanitized.target.path, HANDOFF_TARGET_REPO, 'payload target.path must preserve Dev Orchestra');
    assert.equal(sanitized.originalRequest, payload.originalRequest, 'payload originalRequest must be preserved');
    assert.deepEqual(
      sanitized.safetyConditions,
      payload.safetyConditions.map(maskExpectedText),
      'payload safetyConditions must be preserved with safety masking',
    );
    assert.deepEqual(sanitized.reportItems, payload.reportItems, 'payload reportItems must be preserved');

    const response = await requestJson(port, '/api/handoff', payload, 'POST');
    assert.equal(response.statusCode, 200, 'POST /api/handoff must return 200');
    assert.equal(response.body.ok, true, 'POST /api/handoff must succeed');
    assert.equal(response.body.handoffDir, handoffDir, 'POST /api/handoff must return the handoff dir');
    assert.ok(fs.existsSync(response.body.latestPath), 'latest.md must exist after save');
    assert.ok(fs.existsSync(response.body.queuePath), 'queue.jsonl must exist after save');
    assert.equal(path.dirname(response.body.latestPath), handoffDir, 'latest.md must live under handoff dir');
    assert.equal(path.dirname(response.body.queuePath), handoffDir, 'queue.jsonl must live under handoff dir');

    const latestMarkdown = read(response.body.latestPath);
    const queueJsonl = read(response.body.queuePath);
    assertNoLeak(latestMarkdown, 'latest.md', { forbidRawSensitiveWords: true });
    assertNoLeak(queueJsonl, 'queue.jsonl', { forbidRawSensitiveWords: true });
    assert.ok(latestMarkdown.includes('originalRequest:'), 'latest.md must keep originalRequest');
    assert.ok(latestMarkdown.includes('target_path:'), 'latest.md must keep target_path');
    assert.ok(latestMarkdown.includes('agent:'), 'latest.md must keep agent');
    assert.ok(latestMarkdown.includes('report_items'), 'latest.md must keep report_items');

    const latest = readLatestHandoffInbox({ handoffDir });
    assert.equal(latest.count, 1, 'readLatestHandoffInbox count must be 1');
    assert.equal(latest.latestPath, getLatestPath({ handoffDir }), 'latestPath must match helper');
    assert.equal(latest.queuePath, getQueuePath({ handoffDir }), 'queuePath must match helper');
    assert.ok(latest.latest, 'latest inbox record must exist');
    assert.equal(latest.latest.target_repo, HANDOFF_TARGET_REPO, 'latest inbox record must keep target repo');
    assert.equal(latest.latest.originalRequest, payload.originalRequest, 'latest inbox record must keep originalRequest');
    assert.equal(latest.latest.body, compactExpectedText(payload.body), 'latest inbox record must keep body');
    assert.equal(latest.latest.agent, 'Codex', 'latest inbox record must keep agent');
    assert.equal(latest.latest.target.path, HANDOFF_TARGET_REPO, 'latest inbox record must keep target path');
    assert.deepEqual(
      latest.latest.safetyConditions.map(normalizeMaskedText),
      payload.safetyConditions.map(maskExpectedText).map(normalizeMaskedText),
      'latest inbox record must keep masked safetyConditions',
    );
    assert.deepEqual(
      latest.latest.reportItems.map(normalizeMaskedText),
      payload.reportItems.map(maskExpectedText).map(normalizeMaskedText),
      'latest inbox record must keep masked reportItems',
    );

    const queue = readHandoffQueue({ handoffDir });
    assert.equal(queue.count, 1, 'readHandoffQueue count must be 1');
    assert.equal(queue.items.length, 1, 'readHandoffQueue must return one item');
    assert.equal(queue.items[0].target_repo, HANDOFF_TARGET_REPO, 'queue item must keep target repo');
    assert.equal(queue.items[0].originalRequest, payload.originalRequest, 'queue item must keep originalRequest');
    assert.equal(queue.items[0].body, compactExpectedText(payload.body), 'queue item must keep body');
    assert.equal(queue.items[0].target.path, HANDOFF_TARGET_REPO, 'queue item must keep target path');
    assert.deepEqual(
      queue.items[0].safetyConditions.map(normalizeMaskedText),
      payload.safetyConditions.map(maskExpectedText).map(normalizeMaskedText),
      'queue item must keep masked safetyConditions',
    );
    assert.deepEqual(
      queue.items[0].reportItems.map(normalizeMaskedText),
      payload.reportItems.map(maskExpectedText).map(normalizeMaskedText),
      'queue item must keep masked reportItems',
    );

    return { port, response, latest, queue };
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

async function main() {
  console.log('=== v110.84.30 handoff inbox persistence smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.30'), `package version must be >= 110.84.30 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-30'], 'smoke:v110-84-30 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-30'), 'verify must include smoke:v110-84-30');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('buildHandoffInboxBridgeUrl'), 'HTML must use bridge URL helper');
  assert.ok(html.includes('localhost handoff bridge'), 'HTML must keep bridge label');
  assert.ok(html.includes('Handoff Inboxへ送る'), 'HTML must keep send button');
  assert.ok(html.includes('最終保存先'), 'HTML must show final save destination');
  assert.ok(html.includes('最終保存ファイル'), 'HTML must show final save file');
  assert.ok(html.includes('最終エラー'), 'HTML must show final error');
  assert.ok(html.includes('18345'), 'HTML must default to the handoff bridge port');
  assert.ok(html.includes('/api/handoff'), 'HTML must call the handoff API');
  assert.ok(!html.includes('tmux send-keys'), 'HTML must not contain tmux send-keys');
  assert.ok(!html.includes('xdotool'), 'HTML must not contain xdotool');
  assertNoLeak(html, 'HTML');
  console.log('  PASS: HTML bridge wiring');

  const bridgeSource = read(BRIDGE_SERVER_PATH);
  assert.ok(bridgeSource.includes('Access-Control-Allow-Origin'), 'bridge server must set CORS headers');
  assert.ok(bridgeSource.includes('handoffDir: result.handoffDir'), 'bridge server must return handoffDir');
  assert.ok(bridgeSource.includes('saveHandoffInbox'), 'bridge server must save inbox records');
  assert.ok(bridgeSource.includes('readLatestHandoffInbox'), 'bridge server must read inbox records');
  console.log('  PASS: bridge server source wiring');

  const liveServerSource = read(LIVE_SERVER_PATH);
  assert.ok(liveServerSource.includes('handoffDir: result.handoffDir'), 'live server must return handoffDir');
  assert.ok(liveServerSource.includes('saveHandoffInbox'), 'live server must save inbox records');
  console.log('  PASS: live server source wiring');

  const bridgeCycle = await runServerCycle(
    { server: createCodexHandoffBridgeServer({ handoffDir: TEMP_ROOT }).server },
    TEMP_ROOT,
  );
  if (bridgeCycle.skipped) {
    console.log('  PASS: bridge runtime checks skipped — listen EPERM in this environment');
  } else {
    console.log('  PASS: bridge POST saved latest.md and queue.jsonl');
  }

  const liveTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-30-live-'));
  const liveServerCycle = await runServerCycle(
    { server: createLiveCockpitServer({ handoffDir: liveTempRoot }).server },
    liveTempRoot,
    { expectCorsOptions: false },
  );
  if (liveServerCycle.skipped) {
    console.log('  PASS: live cockpit runtime checks skipped — listen EPERM in this environment');
  } else {
    console.log('  PASS: live cockpit /api/handoff saved latest.md and queue.jsonl');
  }

  console.log('✅ v110.84.30 handoff inbox persistence smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
