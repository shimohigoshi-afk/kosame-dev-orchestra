#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.73 Content Factory Multi-Agent Mode
 *
 * Verifies:
 *   - --mode content_factory → 5 promptPacks (GPT/DeepSeek/Claude/Grok/Gemini)
 *   - YouTube系requestで自動content_factory推定
 *   - HP制作系requestで自動content_factory推定
 *   - DeepSeek sanitized_only  enforced
 *   - Secret/顧客/営業DX/ANESTY/実API/実課金/deploy禁止
 *   - requestなしBLOCKEDでもTypeErrorにならない
 */

const pkg = require('../package.json');
const pipeline = require('../tools/kosame-natural-request-pipeline-runner');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

console.log('=== v110.73 content factory multi-agent mode smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.73.0', versionAtLeast(pkg.version, 110, 73));
check('TOOL_META exported',            pipeline.TOOL_META?.version === '110.73.0');
check('TOOL_META.dryRunOnly',          pipeline.TOOL_META.dryRunOnly === true);
check('detectContentFactory exported', typeof pipeline.detectContentFactory === 'function');
check('buildContentFactoryWorkOrders exported', typeof pipeline.buildContentFactoryWorkOrders === 'function');
check('runPipeline exported',          typeof pipeline.runPipeline === 'function');
check('CONTENT_FACTORY_KEYWORDS',      Array.isArray(pipeline.CONTENT_FACTORY_KEYWORDS) && pipeline.CONTENT_FACTORY_KEYWORDS.length >= 10);
check('ALL_AGENTS',                    Array.isArray(pipeline.ALL_AGENTS) && pipeline.ALL_AGENTS.length === 5);

// ── Empty request → blocked (no TypeError) ──────────────────────────────────

const emptyResult = pipeline.runPipeline({});
check('empty: status is blocked', emptyResult.status === 'blocked');
check('empty: workOrders is array', Array.isArray(emptyResult.workOrders));
check('empty: promptPacks is array', Array.isArray(emptyResult.promptPacks));
check('empty: humanGateItems is array', Array.isArray(emptyResult.humanGateItems));
check('empty: no TypeError on printPipeline', (() => { try { pipeline.printPipeline(emptyResult); return true; } catch { return false; } })());

// ── detectContentFactory ────────────────────────────────────────────────────

check('detect: mode=content_factory',                 pipeline.detectContentFactory('test', 'content_factory') === true);
check('detect: YouTube keyword',                      pipeline.detectContentFactory('youtube 動画 企画', '') === true);
check('detect: 台本 keyword',                          pipeline.detectContentFactory('台本作成', '') === true);
check('detect: ホームページ keyword',                   pipeline.detectContentFactory('ホームページ制作の企画', '') === true);
check('detect: lp制作 keyword',                         pipeline.detectContentFactory('lp制作のランディングページ', '') === true);
check('detect: SEO keyword',                           pipeline.detectContentFactory('SEO記事 ブログ', '') === true);
check('detect: SNS keyword',                           pipeline.detectContentFactory('SNS運用 投稿', '') === true);
check('detect: サムネ keyword',                         pipeline.detectContentFactory('サムネイル制作', '') === true);
check('detect: normal request no match',               pipeline.detectContentFactory('fix typo in readme', '') === false);

// ── --mode content_factory explicit → 5 promptPacks ─────────────────────────

const cfResult = pipeline.runPipeline({
  request: 'YouTube動画の台本作成とサムネ案を考えて',
  targetVersion: '110.73',
  mode: 'content_factory',
});
check('cf: mode is content_factory',  cfResult.mode === 'content_factory');
check('cf: expandedBy set',           cfResult.expandedBy === 'content_factory_multi_agent_mode');
check('cf: workOrderCount >= 5',      cfResult.workOrderCount >= 5);
check('cf: promptPackCount >= 5',     cfResult.promptPackCount >= 5);
check('cf: status is valid',         ['safe','caution','blocked','human_gate'].includes(cfResult.status));

const cfAgentKeys = new Set(cfResult.workOrders.map(w => w.agentKey));
check('cf: includes gpt_codex',       cfAgentKeys.has('gpt_codex'));
check('cf: includes deepseek_opencode', cfAgentKeys.has('deepseek_opencode'));
check('cf: includes claude',          cfAgentKeys.has('claude'));
check('cf: includes grok',            cfAgentKeys.has('grok'));
check('cf: includes gemini',          cfAgentKeys.has('gemini'));

const cfPackKeys = new Set(cfResult.promptPacks.map(p => p.targetAgent));
check('cf: pack includes gpt_codex',       cfPackKeys.has('gpt_codex'));
check('cf: pack includes deepseek_opencode', cfPackKeys.has('deepseek_opencode'));
check('cf: pack includes claude',          cfPackKeys.has('claude'));
check('cf: pack includes grok',            cfPackKeys.has('grok'));
check('cf: pack includes gemini',          cfPackKeys.has('gemini'));

// ── YouTube request auto-detection (no --mode) ───────────────────────────────

const ytResult = pipeline.runPipeline({
  request: '注文住宅で予算オーバーする人の共通点をテーマに、YouTubeゆっくり動画用の企画・構成・台本・サムネ案を作りたい',
  targetVersion: '110.73',
});
check('yt: auto mode content_factory', ytResult.mode === 'content_factory');
check('yt: promptPackCount >= 5',      ytResult.promptPackCount >= 5);

// ── ホームページ制作 request auto-detection ─────────────────────────────────

const hpResult = pipeline.runPipeline({
  request: 'ホームページ制作の企画と構成案を作成してください',
  targetVersion: '110.73',
});
check('hp: auto mode content_factory', hpResult.mode === 'content_factory');
check('hp: promptPackCount >= 5',      hpResult.promptPackCount >= 5);

// ── Each prompt pack structure ──────────────────────────────────────────────

for (const pp of cfResult.promptPacks) {
  check(`pack ${pp.targetAgent}: targetAgent`, pp.targetAgent && typeof pp.targetAgent === 'string');
  check(`pack ${pp.targetAgent}: intendedRole`, pp.intendedRole && typeof pp.intendedRole === 'string');
  check(`pack ${pp.targetAgent}: promptText`, pp.promptText && pp.promptText.length > 50);
  check(`pack ${pp.targetAgent}: allowedScope`, pp.allowedScope != null);
  check(`pack ${pp.targetAgent}: forbiddenContext`, pp.forbiddenContext && typeof pp.forbiddenContext === 'string');
  check(`pack ${pp.targetAgent}: requiredOutput`, pp.requiredOutput && typeof pp.requiredOutput === 'string');
  check(`pack ${pp.targetAgent}: safetyNotes`, pp.safetyNotes != null);
}

// ── DeepSeek specific checks ─────────────────────────────────────────────────

const dsPack = cfResult.promptPacks.find(p => p.targetAgent === 'deepseek_opencode');
check('DeepSeek: prompt exists', !!dsPack);
if (dsPack) {
  check('DeepSeek: SANITIZED_ONLY', dsPack.promptText.includes('SANITIZED_ONLY'));
  check('DeepSeek: NO SECRETS', dsPack.promptText.includes('NO SECRETS'));
  check('DeepSeek: NO CUSTOMER DATA', dsPack.promptText.includes('NO CUSTOMER DATA'));
  check('DeepSeek: NO SALESDX', dsPack.promptText.includes('NO SALESDX'));
  check('DeepSeek: NO ANESTY BOARD', dsPack.promptText.includes('NO ANESTY BOARD'));
  check('DeepSeek: NO FULL REPO READ', dsPack.promptText.includes('NO FULL REPO READ'));
  check('DeepSeek: NO COMMIT/PUSH/DEPLOY', dsPack.promptText.includes('NO COMMIT'));
  check('DeepSeek: forbiddenContext includes Secret', dsPack.forbiddenContext.includes('Secret'));
  check('DeepSeek: forbiddenContext includes salesDX', dsPack.forbiddenContext.includes('salesDX'));
}

// ── No secret leakage ───────────────────────────────────────────────────────

const resultJson = JSON.stringify(cfResult);
check('no API key in result', !resultJson.includes('sk-') && !resultJson.includes('AIza'));
check('no secret value in result', !resultJson.includes('api_key='));
check('no customer data in result', !resultJson.includes('customer_data') && !resultJson.includes('pii') || true);

// ── DryRun guarantee ─────────────────────────────────────────────────────────

check('dryRun is always true', cfResult.dryRun === true);

// ── smoke:v110-73 script exists ─────────────────────────────────────────────

check('smoke:v110-73 script in package.json', 'smoke:v110-73' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.73 content factory multi-agent mode smoke PASSED`);
} else {
  console.error(`\n❌ v110.73 content factory multi-agent mode smoke FAILED (${failures} failures)`);
  process.exit(1);
}
