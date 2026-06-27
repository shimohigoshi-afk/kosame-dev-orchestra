#!/usr/bin/env node
'use strict';

/**
 * v113.3.62 impl-verb-priority smoke test
 *
 * 実装動詞（修正・追加・実装・改善）があれば claude_code を優先するロジックを検証する。
 *
 * 検証項目:
 *   - IMPL_VERBS / hasImplVerb のエクスポート確認
 *   - 実装動詞を含むタスク → claude_code
 *   - 実装動詞なしの土木系タスク → deepseek_grok
 *   - 実装動詞なしのGCP系タスク → gemini_cli
 *   - 実装動詞なしの監査系タスク → llama_groq
 *   - HTTP POST /api/dev-os での動作確認
 */

const assert = require('node:assert/strict');
const http   = require('node:http');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  IMPL_VERBS,
  hasImplVerb,
  classifyTask,
  routeTask,
  createDevOsServer,
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
  console.log('=== v113.3.62 impl-verb-priority smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.62'), `version must be >= 113.3.62 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-62'],            'smoke:v113-3-62 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-62'), 'verify must include smoke:v113-3-62');
  console.log('  PASS: package wiring');

  // ── TOOL_META version ───────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(TOOL_META.version, '113.3.63'), `TOOL_META.version must be >= 113.3.63 (got ${TOOL_META.version})`);
  assert.strictEqual(TOOL_META.feature, 'v113-3-63-codex-exec-instruction', 'feature slug must match');
  console.log(`  PASS: TOOL_META.version >= 113.3.63 (${TOOL_META.version})`);

  // ── IMPL_VERBS export ───────────────────────────────────────────────────────
  assert.ok(Array.isArray(IMPL_VERBS),          'IMPL_VERBS must be an array');
  assert.ok(IMPL_VERBS.includes('修正'),         'IMPL_VERBS must include 修正');
  assert.ok(IMPL_VERBS.includes('追加'),         'IMPL_VERBS must include 追加');
  assert.ok(IMPL_VERBS.includes('実装'),         'IMPL_VERBS must include 実装');
  assert.ok(IMPL_VERBS.includes('改善'),         'IMPL_VERBS must include 改善');
  console.log(`  PASS: IMPL_VERBS exported correctly (${IMPL_VERBS.join(', ')})`);

  // ── hasImplVerb ─────────────────────────────────────────────────────────────
  assert.strictEqual(hasImplVerb('バグを修正してください'), true,  'hasImplVerb: 修正');
  assert.strictEqual(hasImplVerb('smoke追加して'),          true,  'hasImplVerb: 追加');
  assert.strictEqual(hasImplVerb('機能を実装する'),          true,  'hasImplVerb: 実装');
  assert.strictEqual(hasImplVerb('温度感分析を改善して'),    true,  'hasImplVerb: 改善');
  assert.strictEqual(hasImplVerb('smokeテストを書いて'),     false, 'hasImplVerb: false case');
  assert.strictEqual(hasImplVerb('Cloud Run設定確認'),       false, 'hasImplVerb: false case (GCP)');
  assert.strictEqual(hasImplVerb('コードをレビューして'),    false, 'hasImplVerb: false case (audit)');
  console.log('  PASS: hasImplVerb 正常動作');

  // ── classifyTask: 実装動詞あり → claude_code ────────────────────────────────
  const implVerbCases = [
    { task: 'smoke追加して',              verb: '追加' },
    { task: 'Dockerfileのboilerplate追加', verb: '追加' },
    { task: 'バグを修正してください',      verb: '修正' },
    { task: '温度感分析を改善して',        verb: '改善' },
    { task: '新機能を実装する',            verb: '実装' },
    { task: 'smokeを追加してテストを書く',  verb: '追加' },
  ];
  for (const { task, verb } of implVerbCases) {
    const { route } = classifyTask(task);
    assert.equal(route, 'claude_code',
      `"${task}" (impl verb: ${verb}) should route to claude_code (got ${route})`);
  }
  console.log(`  PASS: classifyTask 実装動詞あり → claude_code (${implVerbCases.length}ケース)`);

  // ── classifyTask: 実装動詞なし → 他のルート ────────────────────────────────
  const noImplVerbCases = [
    { task: 'smokeテストを書いて',                          expected: 'deepseek_grok' },
    { task: 'GitHub Actions のワークフローを設定して',      expected: 'deepseek_grok' },
    { task: 'CI/CD設定を更新して',                          expected: 'deepseek_grok' },
    { task: 'Google Cloud Run設定確認',                     expected: 'gemini_cli' },
    { task: 'gcloud でデプロイ',                            expected: 'gemini_cli' },
    { task: 'コードをセキュリティレビューして',              expected: 'llama_groq' },
    { task: 'diffを監査してください',                       expected: 'llama_groq' },
  ];
  for (const { task, expected } of noImplVerbCases) {
    const { route } = classifyTask(task);
    assert.equal(route, expected, `"${task}" (no impl verb) should route to ${expected} (got ${route})`);
  }
  console.log(`  PASS: classifyTask 実装動詞なし → 各専門ルート (${noImplVerbCases.length}ケース)`);

  // ── routeTask: 実装動詞あり → claude_code + bash_script ────────────────────
  const routeResult = routeTask('smoke追加して');
  assert.equal(routeResult.route, 'claude_code',   'routeTask: smoke追加して → claude_code');
  assert.equal(routeResult.instructionFormat, 'bash_script', 'claude_code format must be bash_script');
  assert.ok(routeResult.instruction.includes('codex exec'),   'claude_code instruction must include codex exec');
  console.log('  PASS: routeTask smoke追加して → claude_code + bash_script');

  // ── HTTP POST /api/dev-os: 実装動詞あり → claude_code ──────────────────────
  try {
    const httpImplRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'smoke追加して' })
    );
    assert.equal(httpImplRes.status, 200,               'POST /api/dev-os must return 200');
    assert.equal(httpImplRes.body.ok, true,             'ok must be true');
    assert.equal(httpImplRes.body.route, 'claude_code', 'smoke追加して → claude_code via HTTP');
    assert.equal(httpImplRes.body.instruction_format, 'bash_script', 'format must be bash_script');
    console.log('  PASS: POST /api/dev-os smoke追加して → claude_code');

    // ── HTTP POST /api/dev-os: 実装動詞なし → deepseek_grok ──────────────────
    const httpCivilRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: 'smokeテストを書いて' })
    );
    assert.equal(httpCivilRes.status, 200,                  'POST /api/dev-os must return 200');
    assert.equal(httpCivilRes.body.route, 'deepseek_grok',  'smokeテストを書いて → deepseek_grok via HTTP');
    assert.equal(httpCivilRes.body.instruction_format, 'json_task_pack', 'format must be json_task_pack');
    console.log('  PASS: POST /api/dev-os smokeテストを書いて → deepseek_grok');
  } catch (e) {
    if (e && e.code === 'EPERM') {
      console.log('  SKIP: HTTP listen EPERM in this environment');
    } else {
      throw e;
    }
  }

  console.log('\n✅ v113.3.62 impl-verb-priority smoke PASSED');
  console.log('   実装動詞(修正/追加/実装/改善)あり → claude_code優先');
  console.log('   実装動詞なし → 専門ルート維持 (deepseek/gemini/llama)');
}

main().catch((e) => {
  console.error(`\n✗ FAILED: ${e.message}`);
  process.exit(1);
});
