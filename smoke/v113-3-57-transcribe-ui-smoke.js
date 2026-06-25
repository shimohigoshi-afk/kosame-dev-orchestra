#!/usr/bin/env node
'use strict';

/**
 * v113.3.57 音声議事録UI smoke test
 *
 * - kosame-transcribe.html の存在・必須要素
 * - APIサーバー gdrive_url フィールド受付
 * - プレビューサーバー /api/* ルーティング
 * - parseGdriveFileId ロジック検証
 * - バージョン確認
 */

const assert = require('node:assert/strict');
const fs     = require('node:fs');
const http   = require('node:http');
const path   = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');
const { createServer: createTranscribeServer } = require('../tools/kosame-transcribe-api-server');
const { createPreviewServer } = require('../tools/kosame-fk-omiya-preview-server');

const HTML_PATH = path.join(__dirname, '..', 'public', 'kosame-transcribe.html');
const ROOT = path.resolve(__dirname, '..');

function req(server, urlPath, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const port = server.address().port;
    const r = http.request({
      hostname: '127.0.0.1', port,
      path: urlPath, method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {},
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }); }
        catch { reject(new Error(`JSON parse error: ${raw.slice(0, 80)}`)); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function reqText(server, urlPath) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    http.get({ hostname: '127.0.0.1', port, path: urlPath }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    }).on('error', reject);
  });
}

function withServer(createFn, fn) {
  return new Promise((resolve, reject) => {
    const server = createFn();
    server.listen(0, '127.0.0.1', async () => {
      try { resolve(await fn(server)); }
      catch (e) { reject(e); }
      finally { server.close(); }
    });
    server.once('error', reject);
  });
}

async function main() {
  console.log('=== v113.3.57 transcribe UI smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.57'), `version must be >= 113.3.57 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-57'], 'smoke:v113-3-57 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-57'), 'verify must include smoke:v113-3-57');
  console.log('  PASS: package wiring');

  // ── HTML file exists ────────────────────────────────────────────────────────
  assert.ok(fs.existsSync(HTML_PATH), 'public/kosame-transcribe.html must exist');
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  console.log('  PASS: HTML file exists');

  // ── HTML required elements ──────────────────────────────────────────────────
  const REQUIRED = [
    ['customer-name input',    'id="customer-name"'],
    ['agency-id input',        'id="agency-id"'],
    ['local source btn',       'id="btn-local"'],
    ['gdrive source btn',      'id="btn-gdrive"'],
    ['upload zone',            'id="upload-zone"'],
    ['gdrive-url input',       'id="gdrive-url"'],
    ['artifact: email',        'id="art-email"'],
    ['artifact: minutes',      'id="art-minutes"'],
    ['artifact: temperature',  'id="art-temperature"'],
    ['artifact: compliance',   'id="art-compliance"'],
    ['submit button',          'id="submit-btn"'],
    ['status card',            'id="card-status"'],
    ['results area',           'id="results-area"'],
    ['temp gauge',             'id="temp-gauge"'],
    ['minutes content',        'id="minutes-content"'],
    ['email content',          'id="email-content"'],
    ['compliance content',     'id="compliance-content"'],
    ['POST /api/transcribe',   "'/api/transcribe'"],
    ['polling fetch',          '/api/status/'],
    ['setSource function',     'function setSource'],
    ['startProcessing fn',     'function startProcessing'],
    ['startPolling fn',        'function startPolling'],
    ['showResults fn',         'function showResults'],
    ['renderTemperature fn',   'function renderTemperature'],
    ['renderMinutes fn',       'function renderMinutes'],
    ['renderEmail fn',         'function renderEmail'],
    ['renderCompliance fn',    'function renderCompliance'],
    ['back link',              'href="/fk-omiya-console.html"'],
  ];
  for (const [name, pattern] of REQUIRED) {
    assert.ok(html.includes(pattern), `HTML must contain ${name}: "${pattern}"`);
  }
  console.log(`  PASS: HTML required elements (${REQUIRED.length} checks)`);

  // ── CSS design tokens ───────────────────────────────────────────────────────
  assert.ok(html.includes('--bg-deep: #0d1b2a'), 'HTML must use fk-omiya design tokens --bg-deep');
  assert.ok(html.includes('--gold: #c9a84c'),    'HTML must use --gold color');
  console.log('  PASS: CSS design tokens match fk-omiya');

  // ── API server: gdrive_url field rejected with invalid URL ─────────────────
  const badGdriveRes = await withServer(createTranscribeServer, (server) =>
    req(server, '/api/transcribe', { customer_name: 'test', gdrive_url: 'https://not-gdrive.com/file' })
  );
  assert.equal(badGdriveRes.status, 400, 'invalid gdrive_url domain must return 400');
  assert.ok(badGdriveRes.body.error.includes('gdrive_url'), 'error must mention gdrive_url');
  console.log('  PASS: invalid gdrive_url → 400');

  // ── API server: gdrive_url with valid ID format (download will fail but format is OK) ──
  // parseGdriveFileId is internal; test by sending a valid-format URL
  // The download will fail (no network in test), so we expect a 422
  // Actually since we can't mock the network here, just verify the format check passes
  // by checking that we don't get a 400 "cannot parse file ID" error
  // Note: in CI this will attempt a real download and get an error from Google's servers
  // We accept either 422 (download error) or 500 (network error) as valid responses
  const gdriveFmtRes = await withServer(createTranscribeServer, (server) =>
    req(server, '/api/transcribe', {
      customer_name: 'テスト',
      gdrive_url: 'https://drive.google.com/file/d/TESTFILEID123456789/view?usp=sharing',
    })
  );
  assert.ok(
    gdriveFmtRes.status !== 400 || !gdriveFmtRes.body.error?.includes('cannot parse file ID'),
    'valid gdrive URL format must pass file ID parsing'
  );
  console.log(`  PASS: gdrive_url format parsed (status=${gdriveFmtRes.status})`);

  // ── API server: missing both audio_base64 and gdrive_url ───────────────────
  const noAudioRes = await withServer(createTranscribeServer, (server) =>
    req(server, '/api/transcribe', { customer_name: 'test', agency_id: 'AGT001' })
  );
  assert.equal(noAudioRes.status, 400, 'missing audio must return 400');
  assert.ok(noAudioRes.body.error.includes('audio_base64') || noAudioRes.body.error.includes('gdrive_url'), 'error must indicate missing audio');
  console.log('  PASS: missing audio → 400');

  // ── Preview server: /api/health routed to transcribe API ───────────────────
  const healthRes = await withServer(createPreviewServer, (server) =>
    reqText(server, '/api/health')
  );
  assert.equal(healthRes.status, 200, '/api/health via preview server must return 200');
  const healthBody = JSON.parse(healthRes.body);
  assert.equal(healthBody.ok, true, '/api/health must return ok=true');
  console.log('  PASS: preview server routes /api/* to transcribe API');

  // ── Preview server: /kosame-transcribe.html served ─────────────────────────
  const pageRes = await withServer(createPreviewServer, (server) =>
    reqText(server, '/kosame-transcribe.html')
  );
  assert.equal(pageRes.status, 200, '/kosame-transcribe.html must return 200');
  assert.ok(pageRes.body.includes('音声議事録 AI'), 'page must contain page title');
  console.log('  PASS: /kosame-transcribe.html served by preview server');

  // ── Preview server: status API via preview server ──────────────────────────
  const statusRes = await withServer(createPreviewServer, (server) =>
    reqText(server, '/api/status/TEST-CASE-001')
  );
  assert.equal(statusRes.status, 200, '/api/status via preview server must return 200');
  console.log('  PASS: /api/status/:case_id via preview server');

  console.log('\n✅ v113.3.57 transcribe UI smoke PASSED');
  console.log('   kosame-transcribe.html / gdrive_url / preview-server routing / design tokens');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
