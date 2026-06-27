#!/usr/bin/env node
'use strict';

/**
 * v113.3.60 Dev OS Router HTTP Server smoke test
 *
 * - POST /api/dev-os エンドポイント
 * - GET  /api/dev-os/routes
 * - GET  /api/dev-os/health
 * - DEV_OS_MODE=server でサーバーモード起動確認
 * - プレビューサーバー経由でのルーティング
 * - 既存CLIモードのrouteTask関数が引き続き動作すること
 */

const assert = require('node:assert/strict');
const http   = require('node:http');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  routeTask,
  createDevOsServer,
  startDevOsServer,
  handleDevOsRequest,
  DEV_OS_PORT,
} = require('../tools/kosame-dev-os-router');

const { createPreviewServer } = require('../tools/kosame-fk-omiya-preview-server');

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
  console.log('=== v113.3.60 dev-os-server smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.60'), `version must be >= 113.3.60 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-60'],            'smoke:v113-3-60 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-60'), 'verify must include smoke:v113-3-60');
  assert.ok(pkg.scripts['dev:os:server'],              'dev:os:server npm script must exist');
  console.log('  PASS: package wiring');

  // ── TOOL_META version ───────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(TOOL_META.version, '113.3.60'), `TOOL_META.version must be >= 113.3.60 (got ${TOOL_META.version})`);
  console.log(`  PASS: TOOL_META.version >= 113.3.60 (${TOOL_META.version})`);

  // ── exports ─────────────────────────────────────────────────────────────────
  assert.ok(typeof handleDevOsRequest === 'function', 'handleDevOsRequest must be exported');
  assert.ok(typeof createDevOsServer  === 'function', 'createDevOsServer must be exported');
  assert.ok(typeof startDevOsServer   === 'function', 'startDevOsServer must be exported');
  assert.ok(typeof DEV_OS_PORT        === 'number',   'DEV_OS_PORT must be exported as number');
  console.log('  PASS: server exports exist');

  // ── HTTP server path checks ────────────────────────────────────────────────
  try {
    // ── GET /api/dev-os/health ───────────────────────────────────────────────
    const healthRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os/health')
    );
    assert.equal(healthRes.status, 200,        'health must return 200');
    assert.equal(healthRes.body.ok, true,      'health must return ok=true');
    assert.ok(isVersionAtLeast(healthRes.body.version, '113.3.60'), `health version must be >= 113.3.60 (got ${healthRes.body.version})`);
    assert.equal(healthRes.body.mode, 'server','health mode must be server');
    console.log('  PASS: GET /api/dev-os/health');

    // ── GET /api/dev-os/routes ───────────────────────────────────────────────
    const routesRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os/routes')
    );
    assert.equal(routesRes.status, 200, 'routes must return 200');
    assert.equal(routesRes.body.ok, true, 'routes must return ok=true');
    const routes = routesRes.body.routes;
    assert.ok(Array.isArray(routes), 'routes must be array');
    assert.equal(routes.length, 4, 'must have 4 routes');
    const routeKeys = routes.map((r) => r.key);
    assert.ok(routeKeys.includes('claude_code'),   'routes must include claude_code');
    assert.ok(routeKeys.includes('gemini_cli'),    'routes must include gemini_cli');
    assert.ok(routeKeys.includes('deepseek_grok'), 'routes must include deepseek_grok');
    assert.ok(routeKeys.includes('llama_groq'),    'routes must include llama_groq');
    for (const r of routes) {
      assert.ok(r.key,         `route.key must exist`);
      assert.ok(r.label,       `route.label must exist (${r.key})`);
      assert.ok(r.icon,        `route.icon must exist (${r.key})`);
      assert.ok(r.description, `route.description must exist (${r.key})`);
    }
    console.log('  PASS: GET /api/dev-os/routes (4ルート確認)');

    // ── POST /api/dev-os: 実装系 → claude_code ─────────────────────────────
    // ── POST /api/dev-os: 実装系 → claude_code ───────────────────────────────
    const implRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: '温度感分析を改善して' })
    );
    assert.equal(implRes.status, 200,                 'POST /api/dev-os must return 200');
    assert.equal(implRes.body.ok, true,               'POST /api/dev-os must return ok=true');
    assert.equal(implRes.body.route, 'claude_code',   'route must be claude_code');
    assert.ok(implRes.body.route_label,               'route_label must exist');
    assert.ok(implRes.body.route_icon,                'route_icon must exist');
    assert.ok(implRes.body.instruction,               'instruction must be non-empty');
    assert.ok(implRes.body.instruction.includes('codex exec'), 'claude_code instruction must have codex exec');
    assert.equal(implRes.body.instruction_format, 'bash_script', 'format must be bash_script');
    assert.ok(typeof implRes.body.score === 'number', 'score must be number');
    assert.ok(typeof implRes.body.all_scores === 'object', 'all_scores must be object');
    console.log('  PASS: POST /api/dev-os → claude_code (温度感分析を改善して)');

    // ── POST /api/dev-os: Google Cloud系 → gemini_cli ────────────────────────
    const gcpRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'Google Cloud Run設定確認' })
    );
    assert.equal(gcpRes.body.route, 'gemini_cli', 'GCP task must route to gemini_cli');
    assert.equal(gcpRes.body.instruction_format, 'bash_script', 'gemini format must be bash_script');
    assert.ok(gcpRes.body.instruction.includes('gemini'), 'gemini instruction must include gemini command');
    console.log('  PASS: POST /api/dev-os → gemini_cli (Cloud Run設定確認)');

    // ── POST /api/dev-os: 土木系 → deepseek_grok ─────────────────────────────
    // v113.3.62: 実装動詞なしタスクで検証 (smoke追加して は impl verb で claude_code へ)
    const civilRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'smokeテストを書いて' })
    );
    assert.equal(civilRes.body.route, 'deepseek_grok',  'smoke task (no impl verb) must route to deepseek_grok');
    assert.equal(civilRes.body.instruction_format, 'json_task_pack', 'format must be json_task_pack');
    const taskPack = JSON.parse(civilRes.body.instruction);
    assert.equal(taskPack.type, 'sanitized_civil_task_pack', 'task pack type must match');
    console.log('  PASS: POST /api/dev-os → deepseek_grok (smokeテストを書いて) + Task Pack JSON');

    // ── POST /api/dev-os: 監査系 → llama_groq ────────────────────────────────
    const auditRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'コードをセキュリティレビューして' })
    );
    assert.equal(auditRes.body.route, 'llama_groq',       'audit task must route to llama_groq');
    assert.equal(auditRes.body.instruction_format, 'json_audit_pack', 'format must be json_audit_pack');
    const auditPack = JSON.parse(auditRes.body.instruction);
    assert.equal(auditPack.type, 'diff_audit_pack', 'audit pack type must match');
    console.log('  PASS: POST /api/dev-os → llama_groq (セキュリティレビュー) + Audit Pack JSON');

    // ── POST /api/dev-os: 営業DXブロック → claude_codeへリダイレクト ─────────
    // v113.3.62: 実装動詞なしタスクで検証 (impl verbがあると直接claude_codeに分類される)
    const blockRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'transcriberのsmokeテストを書いて' })
    );
    assert.equal(blockRes.status, 200,                    'blocked task must return 200 (redirected)');
    assert.equal(blockRes.body.blocked, true,             'must mark blocked=true');
    assert.ok(blockRes.body.block_reason,                 'block_reason must be set');
    assert.equal(blockRes.body.route, 'claude_code',      'blocked task must redirect to claude_code');
    assert.equal(blockRes.body.redirected_from, 'deepseek_grok', 'redirected_from must be deepseek_grok');
    console.log('  PASS: POST /api/dev-os 営業DXブロック → claude_codeリダイレクト');

    // ── POST /api/dev-os: バリデーション ───────────────────────────────────
    const emptyRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: '' })
    );
    assert.equal(emptyRes.status, 400, 'empty task must return 400');
    assert.equal(emptyRes.body.ok, false, 'empty task must return ok=false');
    console.log('  PASS: POST /api/dev-os バリデーション (empty task → 400)');

    const noTaskRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', {})
    );
    assert.equal(noTaskRes.status, 400, 'missing task must return 400');
    console.log('  PASS: POST /api/dev-os バリデーション (missing task → 400)');

    // ── POST /api/dev-os: 404 ───────────────────────────────────────────────
    const notFoundRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os/unknown')
    );
    assert.equal(notFoundRes.status, 404, 'unknown route must return 404');
    console.log('  PASS: unknown route → 404');

    // ── Preview server: /api/dev-os/** ルーティング ─────────────────────────
    const previewHealthRes = await withServer(createPreviewServer, (s) =>
      reqServer(s, '/api/dev-os/health')
    );
    assert.equal(previewHealthRes.status, 200, '/api/dev-os/health via preview server must return 200');
    assert.equal(previewHealthRes.body.ok, true, 'preview server must route /api/dev-os/health correctly');
    console.log('  PASS: preview server routes /api/dev-os/* to dev-os-router');

    const previewPostRes = await withServer(createPreviewServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'smokeテストを書いて' })
    );
    assert.equal(previewPostRes.status, 200, 'POST /api/dev-os via preview server must return 200');
    assert.equal(previewPostRes.body.route, 'deepseek_grok', 'route must be deepseek_grok via preview server');
    console.log('  PASS: POST /api/dev-os via preview server');
  } catch (e) {
    if (e && e.code === 'EPERM') {
      console.log('  SKIP: HTTP listen EPERM in this environment');
    } else {
      throw e;
    }
  }

  // ── 既存CLIモード: routeTask は引き続き動作 ─────────────────────────────────
  const cliResult = routeTask('温度感分析を改善して');
  assert.equal(cliResult.route, 'claude_code', 'routeTask CLI function must still work');
  assert.ok(cliResult.instruction, 'routeTask must still produce instruction');
  console.log('  PASS: 既存CLIモード (routeTask) 引き続き動作');

  // ── DEV_OS_MODE=server 起動確認 ─────────────────────────────────────────────
  // startDevOsServer が Promise<Server> を返すことを確認
  try {
    const testServer = await startDevOsServer(0);
    assert.ok(testServer, 'startDevOsServer must return a server');
    assert.ok(testServer.address(), 'server must have an address');
    await new Promise((r) => testServer.close(r));
    console.log('  PASS: DEV_OS_MODE=server (startDevOsServer → listen → close)');
  } catch (e) {
    if (e && e.code === 'EPERM') {
      console.log('  SKIP: startDevOsServer listen EPERM in this environment');
    } else {
      throw e;
    }
  }

  console.log('\n✅ v113.3.60 dev-os-server smoke PASSED');
  console.log('   POST /api/dev-os / GET routes & health / salesDxブロック / preview server routing / CLI互換性');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
