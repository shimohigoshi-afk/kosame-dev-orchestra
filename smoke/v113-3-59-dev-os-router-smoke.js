#!/usr/bin/env node
'use strict';

/**
 * v113.3.59 Dev OS Router smoke test
 *
 * - ルート分類精度（4カテゴリ）
 * - 営業DX / transcriber セーフティガード
 * - 指示文フォーマット検証
 * - バリデーション・エラー処理
 * - npm run dev:os スクリプト確認
 */

const assert = require('node:assert/strict');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  ROUTES,
  ROUTE_KEYWORDS,
  SALES_DX_BLOCK_KEYWORDS,
  EXTERNAL_AI_ROUTES,
  classifyTask,
  salesDxGuard,
  routeTask,
  generateClaudeCodeInstruction,
  generateGeminiCliInstruction,
  generateDeepSeekGrokTaskPack,
  generateLlamaGroqAuditPack,
} = require('../tools/kosame-dev-os-router');

function pass(label) { console.log(`  PASS: ${label}`); }

async function main() {
  console.log('=== v113.3.59 dev-os-router smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.59'), `version must be >= 113.3.59 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-59'],            'smoke:v113-3-59 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-59'), 'verify must include smoke:v113-3-59');
  assert.ok(pkg.scripts['dev:os'],                     'dev:os npm script must exist');
  pass('package wiring');

  // ── TOOL_META ───────────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(TOOL_META.version, '113.3.59'), `TOOL_META.version must be >= 113.3.59 (got ${TOOL_META.version})`);
  assert.ok(TOOL_META.feature,                'TOOL_META.feature must exist');
  pass('TOOL_META');

  // ── ROUTES structure ────────────────────────────────────────────────────────
  const requiredRoutes = ['claude_code', 'gemini_cli', 'deepseek_grok', 'llama_groq'];
  for (const r of requiredRoutes) {
    assert.ok(ROUTES[r],           `ROUTES.${r} must exist`);
    assert.ok(ROUTES[r].label,     `ROUTES.${r}.label must exist`);
    assert.ok(ROUTES[r].color,     `ROUTES.${r}.color must exist`);
    assert.ok(ROUTES[r].description, `ROUTES.${r}.description must exist`);
  }
  pass('ROUTES structure (4 categories)');

  // ── EXTERNAL_AI_ROUTES ──────────────────────────────────────────────────────
  assert.ok(EXTERNAL_AI_ROUTES.has('deepseek_grok'), 'deepseek_grok must be external AI route');
  assert.ok(EXTERNAL_AI_ROUTES.has('llama_groq'),    'llama_groq must be external AI route');
  assert.ok(!EXTERNAL_AI_ROUTES.has('claude_code'),  'claude_code must NOT be external AI route');
  assert.ok(!EXTERNAL_AI_ROUTES.has('gemini_cli'),   'gemini_cli must NOT be external AI route');
  pass('EXTERNAL_AI_ROUTES');

  // ── classifyTask: 実装系 → claude_code ─────────────────────────────────────
  // v113.3.62: 実装動詞（修正・追加・実装・改善）があれば claude_code を優先
  const implCases = [
    '温度感分析を改善して',
    'バグを修正してください',
    '新機能を実装する',
    'HTMLページを追加して',
    'APIエンドポイントを作成する',
    'smoke追加して',           // 追加(impl verb) → claude_code優先 (v113.3.62)
    'Dockerfileのboilerplate追加', // 追加(impl verb) → claude_code優先 (v113.3.62)
  ];
  for (const task of implCases) {
    const { route } = classifyTask(task);
    assert.equal(route, 'claude_code', `"${task}" should route to claude_code (got ${route})`);
  }
  pass(`classifyTask: 実装系 → claude_code (${implCases.length}ケース)`);

  // ── classifyTask: Google Cloud系 → gemini_cli ───────────────────────────────
  const gcpCases = [
    'Google Cloud Run設定確認',
    'gcloud でデプロイ',
    'Cloud Run の設定を確認してください',
    'GCS バケットを確認して',
    'Firestore のデータを確認',
  ];
  for (const task of gcpCases) {
    const { route } = classifyTask(task);
    assert.equal(route, 'gemini_cli', `"${task}" should route to gemini_cli (got ${route})`);
  }
  pass(`classifyTask: Google Cloud系 → gemini_cli (${gcpCases.length}ケース)`);

  // ── classifyTask: 土木系 → deepseek_grok ────────────────────────────────────
  // 実装動詞なし → deepseek_grok (実装動詞あり → claude_code、v113.3.62参照)
  const civilCases = [
    'smokeテストを書いて',
    'GitHub Actions のワークフローを設定して',
    'CI/CD設定を更新して',
  ];
  for (const task of civilCases) {
    const { route } = classifyTask(task);
    assert.equal(route, 'deepseek_grok', `"${task}" should route to deepseek_grok (got ${route})`);
  }
  pass(`classifyTask: 土木系 → deepseek_grok (${civilCases.length}ケース)`);

  // ── classifyTask: 監査系 → llama_groq ──────────────────────────────────────
  const auditCases = [
    'コードをセキュリティレビューして',
    'diffを監査してください',
    '脆弱性をスキャンして',
    'セキュリティチェックをお願いします',
    'コンプライアンス監査',
  ];
  for (const task of auditCases) {
    const { route } = classifyTask(task);
    assert.equal(route, 'llama_groq', `"${task}" should route to llama_groq (got ${route})`);
  }
  pass(`classifyTask: 監査系 → llama_groq (${auditCases.length}ケース)`);

  // ── salesDxGuard: ブロック確認 ──────────────────────────────────────────────
  const blockCases = [
    { task: 'transcriberのsmoke追加して',        route: 'deepseek_grok' },
    { task: '営業DXのコードをレビューして',      route: 'llama_groq' },
    { task: 'kosame-sales-dxのdiffを監査',       route: 'llama_groq' },
    { task: '顧客情報を含むsmokeテスト追加',     route: 'deepseek_grok' },
  ];
  for (const { task, route } of blockCases) {
    const guard = salesDxGuard(task, route);
    assert.equal(guard.blocked, true, `"${task}" should be blocked on route ${route}`);
    assert.ok(guard.reason,             `block reason must be set for "${task}"`);
    assert.ok(guard.redirectTo,         `redirectTo must be set for "${task}"`);
  }
  pass(`salesDxGuard: ブロック確認 (${blockCases.length}ケース)`);

  // ── salesDxGuard: 許可確認 ─────────────────────────────────────────────────
  const allowCases = [
    { task: 'smokeを追加して',                  route: 'deepseek_grok' },
    { task: 'コードをセキュリティレビュー',      route: 'llama_groq' },
    { task: 'Dockerfileを設定して',             route: 'deepseek_grok' },
  ];
  for (const { task, route } of allowCases) {
    const guard = salesDxGuard(task, route);
    assert.equal(guard.blocked, false, `"${task}" should NOT be blocked on route ${route}`);
  }
  pass(`salesDxGuard: 許可確認 (${allowCases.length}ケース)`);

  // ── salesDxGuard: Claude/Gemini は常にブロックしない ───────────────────────
  const safeRoutes = ['claude_code', 'gemini_cli'];
  for (const route of safeRoutes) {
    const guard = salesDxGuard('transcriber の改修をして', route);
    assert.equal(guard.blocked, false, `${route} should never be blocked by salesDxGuard`);
  }
  pass('salesDxGuard: Claude/Geminiはブロックしない');

  // ── routeTask: 営業DX → 自動リダイレクト ───────────────────────────────────
  // v113.3.62: 実装動詞なしタスクで検証 (impl verbがあると直接claude_codeに分類)
  const result = routeTask('transcriberのsmokeテストを書いて');
  assert.equal(result.blocked, true,         'transcriberタスクはブロックされるべき');
  assert.ok(result.blockReason,              'blockReason must be set');
  assert.equal(result.route, 'claude_code',  'ブロック後はclaude_codeにリダイレクト');
  assert.equal(result.redirectedFrom, 'deepseek_grok', 'redirectedFromはdeepseek_grok');
  pass('routeTask: 営業DX → claude_codeへ自動リダイレクト');

  // ── routeTask: バリデーション ───────────────────────────────────────────────
  assert.throws(() => routeTask(''),    /non-empty string/, 'empty task must throw');
  assert.throws(() => routeTask(null),  /non-empty string/, 'null task must throw');
  assert.throws(() => routeTask('   '), /non-empty string/, 'whitespace task must throw');
  pass('routeTask: バリデーション');

  // ── Instruction generators ──────────────────────────────────────────────────
  const claudeInstr = generateClaudeCodeInstruction('テストタスク');
  assert.ok(claudeInstr.includes('codex exec'), 'Claude instruction must have codex exec command');
  assert.ok(claudeInstr.includes('Safety Stop'), 'Claude instruction must mention Safety Stop');
  assert.ok(claudeInstr.includes('テストタスク'), 'Claude instruction must include task');
  assert.ok(claudeInstr.includes('git add -A禁止'), 'Claude instruction must include git add -A禁止');
  pass('generateClaudeCodeInstruction');

  const geminiInstr = generateGeminiCliInstruction('GCS確認');
  assert.ok(geminiInstr.includes('gemini "'),       'Gemini instruction must start with gemini command');
  assert.ok(geminiInstr.includes('kosame-prod-2026'), 'Gemini instruction must include GCP project');
  assert.ok(geminiInstr.includes('GCS確認'),         'Gemini instruction must include task');
  pass('generateGeminiCliInstruction');

  const taskPack = JSON.parse(generateDeepSeekGrokTaskPack('smoke追加'));
  assert.equal(taskPack.type, 'sanitized_civil_task_pack',  'task pack type must be sanitized_civil_task_pack');
  assert.deepEqual(taskPack.target_ai, ['deepseek', 'grok'], 'task pack target_ai must be deepseek/grok');
  assert.equal(taskPack.restrictions.no_secrets, true,       'task pack must restrict secrets');
  assert.equal(taskPack.restrictions.no_customer_data, true, 'task pack must restrict customer data');
  assert.equal(taskPack.restrictions.no_sales_dx, true,      'task pack must restrict sales DX');
  assert.ok(taskPack.restrictions.blocked_paths.some(p => p.includes('transcriber')), 'blocked_paths must include transcriber');
  assert.ok(taskPack.task.description.includes('smoke追加'),  'task pack must include task description');
  pass('generateDeepSeekGrokTaskPack: JSON構造・制約確認');

  const auditPack = JSON.parse(generateLlamaGroqAuditPack('セキュリティ監査'));
  assert.equal(auditPack.type, 'diff_audit_pack',                 'audit pack type must be diff_audit_pack');
  assert.deepEqual(auditPack.target_ai, ['llama3', 'groq'],       'audit pack target_ai must be llama3/groq');
  assert.equal(auditPack.restrictions.read_only, true,            'audit pack must be read_only');
  assert.ok(auditPack.audit_focus.includes('security_vulnerabilities'), 'audit pack must check security');
  assert.ok(auditPack.audit_focus.includes('owasp_top10'),        'audit pack must check OWASP');
  assert.ok(auditPack.task.description.includes('セキュリティ監査'), 'audit pack must include task');
  pass('generateLlamaGroqAuditPack: JSON構造・監査フォーカス確認');

  // ── routeTask: End-to-end ──────────────────────────────────────────────────
  const e2eCases = [
    { task: '温度感分析を改善して',           expectedRoute: 'claude_code',   expectedFormat: 'bash_script' },
    { task: 'smokeテストを書いて',             expectedRoute: 'deepseek_grok', expectedFormat: 'json_task_pack' },
    { task: 'Google Cloud Run設定確認',       expectedRoute: 'gemini_cli',    expectedFormat: 'bash_script' },
    { task: 'コードをセキュリティレビューして', expectedRoute: 'llama_groq',   expectedFormat: 'json_audit_pack' },
  ];
  for (const { task, expectedRoute, expectedFormat } of e2eCases) {
    const r = routeTask(task);
    assert.equal(r.route,             expectedRoute,  `"${task}" route must be ${expectedRoute} (got ${r.route})`);
    assert.equal(r.instructionFormat, expectedFormat, `"${task}" format must be ${expectedFormat}`);
    assert.ok(r.instruction.length > 50,             `"${task}" instruction must be non-trivial`);
    assert.ok(r.routeMeta.label,                     `"${task}" routeMeta.label must exist`);
  }
  pass(`routeTask: end-to-end (${e2eCases.length}タスク例)`);

  // ── SALES_DX_BLOCK_KEYWORDS completeness ───────────────────────────────────
  const requiredBlocks = ['transcriber', 'kosame-sales-dx', '営業DX', '顧客情報'];
  for (const kw of requiredBlocks) {
    assert.ok(SALES_DX_BLOCK_KEYWORDS.includes(kw) || SALES_DX_BLOCK_KEYWORDS.some(k => k.includes(kw)),
      `SALES_DX_BLOCK_KEYWORDS must include "${kw}"`);
  }
  pass('SALES_DX_BLOCK_KEYWORDS: 必須ブロックキーワード確認');

  // ── File existence ──────────────────────────────────────────────────────────
  const fs = require('node:fs');
  const path = require('node:path');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'tools', 'kosame-dev-os-router.js')), 'router file must exist');
  pass('router file exists');

  console.log('\n✅ v113.3.59 dev-os-router smoke PASSED');
  console.log('   4ルート分類 / salesDxガード / 指示文生成 / end-to-end 4タスク例');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
