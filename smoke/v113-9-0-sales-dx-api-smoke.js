#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v113.9.0 Sales DX API
 *
 * Verifies kosame-sales-dx-api.js:
 *   - Module loads without error
 *   - TOOL_META version correct
 *   - checkAuth allows open access when KOSAME_API_KEY not set
 *   - checkAuth blocks when key mismatch
 *   - /health response shape
 *   - POST /api/sales-dx/analyze (in-process, no real server)
 *     - normal input → ok: true, temperature, alertWords, compliance, followupDraft
 *     - empty text   → ok: false, EMPTY_INPUT
 *     - forbidden    → ok: false, FORBIDDEN_CONTENT
 *   - humanGateRequired always true on success
 *   - saved/sent/charged/externalApiCalled always false
 */

const http   = require('http');
const pkg    = require('../package.json');

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
  } else {
    failures++;
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function versionAtLeast(v, major, minor) {
  const [ma, mi] = String(v).split('.').map(Number);
  return ma > major || (ma === major && mi >= minor);
}

console.log('=== v113.9.0 sales-dx-api smoke ===');

// ── Package version ───────────────────────────────────────────────────────────

check('package.json version >= 113.9', versionAtLeast(pkg.version, 113, 9));

// ── Module load ───────────────────────────────────────────────────────────────

let api;
try {
  api = require('../tools/kosame-sales-dx-api');
  check('module loads without error', true);
} catch (e) {
  check('module loads without error', false, e.message);
  process.exit(1);
}

// ── TOOL_META ─────────────────────────────────────────────────────────────────

const { TOOL_META, checkAuth } = api;
check('TOOL_META.version is 113.9.0', TOOL_META.version === '113.9.0');
check('TOOL_META.dryRunOnly is true',  TOOL_META.dryRunOnly === true);

// ── checkAuth ─────────────────────────────────────────────────────────────────

const origKey = process.env.KOSAME_API_KEY;
delete process.env.KOSAME_API_KEY;
check('checkAuth: open (no key set)', checkAuth({ headers: {} }));

process.env.KOSAME_API_KEY = 'test-secret';
check('checkAuth: valid Bearer token',  checkAuth({ headers: { authorization: 'Bearer test-secret' } }));
check('checkAuth: valid X-API-Key',     checkAuth({ headers: { 'x-api-key': 'test-secret' } }));
check('checkAuth: wrong key blocked',   !checkAuth({ headers: { authorization: 'Bearer wrong' } }));
if (origKey !== undefined) process.env.KOSAME_API_KEY = origKey;
else delete process.env.KOSAME_API_KEY;

// ── analyzeText integration (via real server, in-process) ─────────────────────

const { analyzeText } = require('../tools/sales-dx-p0-lite-analyze-text');

// Normal input
const r1 = analyzeText({ text: '具体的な数字を教えてください。申し込みを検討しています。', caseName: 'テスト案件' });
check('normal: ok true',                    r1.ok === true);
check('normal: humanGateRequired true',     r1.humanGateRequired === true);
check('normal: saved false',               r1.saved === false);
check('normal: sent false',                r1.sent === false);
check('normal: charged false',             r1.charged === false);
check('normal: externalApiCalled false',   r1.externalApiCalled === false);
check('normal: temperature present',       !!r1.temperature && typeof r1.temperature.level === 'string');
check('normal: alertWords present',        !!r1.alertWords);
check('normal: compliance present',        !!r1.compliance);
check('normal: followupDraft present',     typeof r1.followupDraft === 'string' && r1.followupDraft.length > 0);
check('normal: transcript summary present', typeof r1.transcript?.summary === 'string');
check('normal: caseName preserved',        r1.caseName === 'テスト案件');

// Empty input
const r2 = analyzeText({ text: '' });
check('empty: ok false',       r2.ok === false);
check('empty: code EMPTY_INPUT', r2.code === 'EMPTY_INPUT');
check('empty: saved false',    r2.saved === false);
check('empty: sent false',     r2.sent === false);
check('empty: charged false',  r2.charged === false);

// Forbidden content
const r3 = analyzeText({ text: 'これは営業DXシステムのテストです' });
check('forbidden: ok false',              r3.ok === false);
check('forbidden: code FORBIDDEN_CONTENT', r3.code === 'FORBIDDEN_CONTENT');
check('forbidden: humanGateRequired true', r3.humanGateRequired === true);
check('forbidden: saved false',           r3.saved === false);

// Low temperature (guard keywords)
const r4 = analyzeText({ text: '一旦持ち帰ります。主人に相談してみます。今は時期じゃないかもしれない。' });
check('guard: ok true',         r4.ok === true);
check('guard: temperature level is guard or low or medium_caution', ['guard','low','medium_caution','high_caution'].includes(r4.temperature.level));
check('guard: alertWords.guard not empty', r4.alertWords.guard.length > 0);

// Compliance warning
const r5 = analyzeText({ text: '必ず得する商品です。絶対に損しません。' });
check('compliance: ok true',             r5.ok === true);
check('compliance: warnings not empty',  r5.compliance.warnings.length > 0);

// ── HTTP server smoke (start, request, close) ─────────────────────────────────

const { startServer } = api;

let serverOk = false;
const testPort = 18083;

const server = startServer(testPort);
server.on('listening', () => {
  const req = http.request({
    hostname: '127.0.0.1',
    port:     testPort,
    path:     '/health',
    method:   'GET',
  }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (_) { parsed = {}; }
      check('server /health: status 200',       res.statusCode === 200);
      check('server /health: ok true',          parsed.ok === true);
      check('server /health: version present',  typeof parsed.version === 'string');
      check('server /health: dryRunOnly true',  parsed.dryRunOnly === true);

      // POST /api/sales-dx/analyze
      const postBody = JSON.stringify({ text: '申し込みを検討しています。', caseName: 'HTTPテスト' });
      const post = http.request({
        hostname: '127.0.0.1',
        port:     testPort,
        path:     '/api/sales-dx/analyze',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody) },
      }, (postRes) => {
        let postBodyStr = '';
        postRes.on('data', d => postBodyStr += d);
        postRes.on('end', () => {
          let postParsed;
          try { postParsed = JSON.parse(postBodyStr); } catch (_) { postParsed = {}; }
          check('server analyze: status 200',          postRes.statusCode === 200);
          check('server analyze: ok true',             postParsed.ok === true);
          check('server analyze: temperature present', !!postParsed.temperature);
          check('server analyze: followupDraft present', typeof postParsed.followupDraft === 'string');
          check('server analyze: saved false',         postParsed.saved === false);

          // POST empty → 400
          const emptyBody = JSON.stringify({ text: '' });
          const post2 = http.request({
            hostname: '127.0.0.1',
            port:     testPort,
            path:     '/api/sales-dx/analyze',
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(emptyBody) },
          }, (res2) => {
            let b2 = '';
            res2.on('data', d => b2 += d);
            res2.on('end', () => {
              let p2;
              try { p2 = JSON.parse(b2); } catch (_) { p2 = {}; }
              check('server empty text: status 400', res2.statusCode === 400);
              check('server empty text: ok false',   p2.ok === false);

              server.close();
              done();
            });
          });
          post2.on('error', () => { check('server empty text request', false, 'connection error'); server.close(); done(); });
          post2.write(emptyBody);
          post2.end();
        });
      });
      post.on('error', () => { check('server analyze request', false, 'connection error'); server.close(); done(); });
      post.write(postBody);
      post.end();
    });
  });
  req.on('error', () => { check('server /health request', false, 'connection error'); server.close(); done(); });
  req.end();
});

function done() {
  console.log('');
  if (failures === 0) {
    console.log(`✓ v113.9.0 sales-dx-api smoke: ALL PASS`);
    process.exit(0);
  } else {
    console.log(`✗ v113.9.0 sales-dx-api smoke: ${failures} FAIL(s)`);
    process.exit(1);
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`  SKIP: port ${testPort} in use — skipping HTTP server smoke`);
    done();
  } else {
    check('server starts', false, err.message);
    done();
  }
});
