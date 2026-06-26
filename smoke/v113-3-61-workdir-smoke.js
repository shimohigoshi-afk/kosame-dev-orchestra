#!/usr/bin/env node
'use strict';

/**
 * v113.3.61 workdir param smoke test
 *
 * - POST /api/dev-os に workdir / repo を渡すと【作業ディレクトリ】に反映される
 * - workdir 未指定時は /home/lavie/kosame-dev-orchestra がデフォルト
 * - repo 指定時は /home/lavie/repos/{repo} に解決される
 * - resolveWorkdir() の全パターンを検証
 */

const assert = require('node:assert/strict');
const http   = require('node:http');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  routeTask,
  createDevOsServer,
  DEFAULT_WORKDIR,
} = require('../tools/kosame-dev-os-router');

// ── HTTP helper ────────────────────────────────────────────────────────────────

function reqServer(server, urlPath, body, method) {
  method = method || (body ? 'POST' : 'GET');
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

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== v113.3.61 workdir-param smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.61'), `version must be >= 113.3.61 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-61'],            'smoke:v113-3-61 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-61'), 'verify must include smoke:v113-3-61');
  console.log('  PASS: package wiring');

  // ── TOOL_META version ───────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(TOOL_META.version, '113.3.61'), `TOOL_META.version must be >= 113.3.61 (got ${TOOL_META.version})`);
  assert.strictEqual(TOOL_META.feature, 'v113-3-61-workdir-param', 'feature slug must match');
  console.log(`  PASS: TOOL_META.version >= 113.3.61 (${TOOL_META.version})`);

  // ── DEFAULT_WORKDIR export ──────────────────────────────────────────────────
  assert.strictEqual(DEFAULT_WORKDIR, '/home/lavie/kosame-dev-orchestra', 'DEFAULT_WORKDIR must be correct');
  console.log('  PASS: DEFAULT_WORKDIR exported correctly');

  // ── resolveWorkdir via routeTask (unit-level) ───────────────────────────────

  // workdir未指定 → DEFAULT_WORKDIR
  const r0 = routeTask('バグを修正して');
  assert.strictEqual(r0.workdir, DEFAULT_WORKDIR, `no opts → workdir must be DEFAULT_WORKDIR (got ${r0.workdir})`);
  assert.ok(r0.instruction.includes(DEFAULT_WORKDIR), 'instruction must contain DEFAULT_WORKDIR');
  console.log('  PASS: workdir未指定 → DEFAULT_WORKDIR');

  // workdir 明示指定
  const r1 = routeTask('バグを修正して', { workdir: '/home/lavie/repos/transcriber' });
  assert.strictEqual(r1.workdir, '/home/lavie/repos/transcriber', `explicit workdir not reflected (got ${r1.workdir})`);
  assert.ok(r1.instruction.includes('/home/lavie/repos/transcriber'), 'instruction must contain explicit workdir');
  console.log('  PASS: workdir明示指定 → /home/lavie/repos/transcriber');

  // repo=transcriber → /home/lavie/repos/transcriber
  const r2 = routeTask('バグを修正して', { repo: 'transcriber' });
  assert.strictEqual(r2.workdir, '/home/lavie/repos/transcriber', `repo=transcriber → wrong workdir (got ${r2.workdir})`);
  assert.ok(r2.instruction.includes('/home/lavie/repos/transcriber'), 'instruction must contain resolved repo path');
  console.log('  PASS: repo=transcriber → /home/lavie/repos/transcriber');

  // repo=kosame-dev-orchestra → DEFAULT_WORKDIR
  const r3 = routeTask('バグを修正して', { repo: 'kosame-dev-orchestra' });
  assert.strictEqual(r3.workdir, DEFAULT_WORKDIR, `repo=kosame-dev-orchestra → wrong workdir (got ${r3.workdir})`);
  console.log('  PASS: repo=kosame-dev-orchestra → DEFAULT_WORKDIR');

  // workdir優先: workdir + repo 同時指定 → workdir が優先
  const r4 = routeTask('バグを修正して', { workdir: '/custom/path', repo: 'transcriber' });
  assert.strictEqual(r4.workdir, '/custom/path', `workdir+repo: workdir must win (got ${r4.workdir})`);
  console.log('  PASS: workdir+repo同時指定 → workdir優先');

  // repo 絶対パス → そのまま使用
  const r5 = routeTask('バグを修正して', { repo: '/abs/repo/path' });
  assert.strictEqual(r5.workdir, '/abs/repo/path', `repo absolute path: wrong result (got ${r5.workdir})`);
  console.log('  PASS: repo絶対パス → そのまま使用');

  // ── POST /api/dev-os workdir param via HTTP ─────────────────────────────────

  const apiRes = await withServer(createDevOsServer, (s) =>
    reqServer(s, '/api/dev-os', { task: 'バグを修正して', workdir: '/home/lavie/repos/transcriber' })
  );
  assert.strictEqual(apiRes.status, 200, `POST /api/dev-os workdir: expected 200, got ${apiRes.status}`);
  assert.strictEqual(apiRes.body.ok, true, 'ok must be true');
  assert.strictEqual(apiRes.body.workdir, '/home/lavie/repos/transcriber',
    `response.workdir must be /home/lavie/repos/transcriber (got ${apiRes.body.workdir})`);
  assert.ok(apiRes.body.instruction.includes('/home/lavie/repos/transcriber'),
    'instruction must contain the specified workdir');
  console.log('  PASS: POST /api/dev-os workdir param → response.workdir + instruction反映');

  // repo param via HTTP
  const apiRes2 = await withServer(createDevOsServer, (s) =>
    reqServer(s, '/api/dev-os', { task: 'バグを修正して', repo: 'transcriber' })
  );
  assert.strictEqual(apiRes2.status, 200);
  assert.strictEqual(apiRes2.body.workdir, '/home/lavie/repos/transcriber',
    `repo param: response.workdir wrong (got ${apiRes2.body.workdir})`);
  console.log('  PASS: POST /api/dev-os repo param → workdir解決');

  // workdir未指定 via HTTP → DEFAULT_WORKDIR
  const apiRes3 = await withServer(createDevOsServer, (s) =>
    reqServer(s, '/api/dev-os', { task: 'バグを修正して' })
  );
  assert.strictEqual(apiRes3.status, 200);
  assert.strictEqual(apiRes3.body.workdir, DEFAULT_WORKDIR,
    `no workdir/repo: response.workdir must be DEFAULT_WORKDIR (got ${apiRes3.body.workdir})`);
  console.log('  PASS: POST /api/dev-os workdir未指定 → DEFAULT_WORKDIR');

  console.log('\n✅ v113.3.61 workdir-param smoke PASSED');
  console.log('   resolveWorkdir全パターン / HTTP workdir+repo param / instruction反映確認');
}

main().catch((e) => {
  console.error(`\n✗ FAILED: ${e.message}`);
  process.exit(1);
});
