#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.75 Sales DX P0 Lite
 *
 * 5ケース:
 *   1. 高温度ケース
 *   2. 警戒ケース
 *   3. 競合比較ケース
 *   4. コンプラ危険語ケース
 *   5. 空入力BLOCKED
 *
 * 全smoke共通確認:
 *   - dryRun === true
 *   - humanGateRequired === true
 *   - saved === false
 *   - sent === false
 *   - charged === false
 *   - externalApiCalled === false
 */

const pkg = require('../package.json');
const analyzer = require('../tools/sales-dx-p0-lite-analyze-text');
const rules    = require('../tools/sales-dx-p0-lite-rules');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(v, major, minor) {
  const [m = 0, n = 0] = String(v).split('.').map(Number);
  return m > major || (m === major && n >= minor);
}

const COMMON_CHECKS = (r, label) => {
  check(`${label}: dryRun === true`,           r.dryRun === true);
  check(`${label}: humanGateRequired === true`, r.humanGateRequired === true);
  check(`${label}: saved === false`,           r.saved === false);
  check(`${label}: sent === false`,            r.sent === false);
  check(`${label}: charged === false`,         r.charged === false);
  check(`${label}: externalApiCalled === false`, r.externalApiCalled === false);
};

console.log('=== v110.75 sales dx p0 lite smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.75.0', versionAtLeast(pkg.version, 110, 75));
check('rules TOOL_META exported',     rules.TOOL_META?.version === '110.75.0');
check('analyzer TOOL_META exported',  analyzer.TOOL_META?.version === '110.75.0');
check('analyzeText exported',         typeof analyzer.analyzeText === 'function');
check('calcTemperature exported',     typeof rules.calcTemperature === 'function');
check('detectAlertWords exported',    typeof rules.detectAlertWords === 'function');
check('detectCompliance exported',    typeof rules.detectCompliance === 'function');

// ── Smoke 1: High temperature ───────────────────────────────────────────────

const r1 = analyzer.analyzeText({
  text: '鈴木さん。いつまでに決めればいいですか？具体的な数字を教えてください。申し込み手続きを教えてください。',
  caseName: '鈴木さん 保険見直し',
});
check('r1: ok === true',              r1.ok === true);
check('r1: temperature high',         r1.temperature.level === 'high');
check('r1: caseName set',             r1.caseName.includes('鈴木さん'));
check('r1: transcript summary',       r1.transcript.summary && r1.transcript.summary.length > 20);
check('r1: followupDraft',            r1.followupDraft && r1.followupDraft.length > 20);
check('r1: alertWords positive',      r1.alertWords.positive.length > 0);
COMMON_CHECKS(r1, 'r1');

// ── Smoke 2: Guard / Low temperature ────────────────────────────────────────

const r2 = analyzer.analyzeText({
  text: '田中さん。考えておきます。また連絡します。他にも聞いてます。保険は間に合ってます。わかりました。わかりました。わかりました。わかりました。わかりました。',
  caseName: '田中さん 年金相談',
});
check('r2: ok === true',              r2.ok === true);
check('r2: temperature guard or low', ['guard', 'low'].includes(r2.temperature.level));
check('r2: alertWords guard >= 2',    r2.alertWords.guard.length >= 2);
check('r2: wakamamaCount >= 5',       r2.alertWords.wakamamaCount >= 5);
COMMON_CHECKS(r2, 'r2');

// ── Smoke 3: Comparing ───────────────────────────────────────────────────────

const r3 = analyzer.analyzeText({
  text: '佐藤さん。A社とB社の違いがわからなくて。家族と話してみます。他にも聞いてます。',
  caseName: '佐藤さん 学資保険',
});
check('r3: ok === true',              r3.ok === true);
check('r3: temperature comparing/medium', ['comparing', 'medium'].includes(r3.temperature.level));
check('r3: alertWords hesitate',      r3.alertWords.hesitate.length > 0);
check('r3: pendingItems',             r3.transcript.pendingItems.length > 0);
COMMON_CHECKS(r3, 'r3');

// ── Smoke 4: Compliance dangerous words ─────────────────────────────────────

const r4 = analyzer.analyzeText({
  text: 'この商品は絶対にお得です。必ず入った方がいいです。一番人気です。損しないです。',
  caseName: 'テスト',
});
check('r4: ok === true',              r4.ok === true);
check('r4: compliance warnings >= 3', r4.compliance.warnings.length >= 3);
check('r4: has 断定表現',              r4.compliance.warnings.some(w => w.category === '断定表現'));
check('r4: has 誇大表現',              r4.compliance.warnings.some(w => w.category === '誇大表現'));
check('r4: has 保証表現 or 誘導表現',   r4.compliance.warnings.some(w => w.category === '保証表現' || w.category === '誘導表現'));
COMMON_CHECKS(r4, 'r4');

// ── Smoke 5: Empty input BLOCKED ────────────────────────────────────────────

const r5 = analyzer.analyzeText({ text: '' });
check('r5: ok === false',             r5.ok === false);
check('r5: error message',            r5.error && r5.error.includes('required'));
check('r5: dryRun === true',          r5.dryRun === true);
check('r5: saved === false',          r5.saved === false);
check('r5: sent === false',           r5.sent === false);
check('r5: charged === false',        r5.charged === false);
check('r5: externalApiCalled === false', r5.externalApiCalled === false);

// ── Forbidden content detection ─────────────────────────────────────────────

const rForbidden = analyzer.analyzeText({ text: 'api_key=sk-test' });
check('forbidden: ok === false',      rForbidden.ok === false);
check('forbidden: error code',        rForbidden.code === 'FORBIDDEN_CONTENT');

const rSafe = analyzer.analyzeText({ text: '普通の面談メモです' });
check('safe text: ok === true',       rSafe.ok === true);

// ── No secret leakage ───────────────────────────────────────────────────────

const allJson = JSON.stringify([r1, r2, r3, r4]);
check('no API key in output',         !allJson.includes('sk-') && !allJson.includes('AIza'));
check('no secret value in output',    !allJson.includes('api_key='));
check('no salesDX in output',         !allJson.includes('salesDX') && !allJson.includes('transcriber'));
check('no ANESTY Board in output',    !allJson.includes('ANESTY'));

// ── smoke:v110-75 script exists ─────────────────────────────────────────────

check('smoke:v110-75 script in package.json', 'smoke:v110-75' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.75 sales dx p0 lite smoke PASSED`);
} else {
  console.error(`\n❌ v110.75 sales dx p0 lite smoke FAILED (${failures} failures)`);
  process.exit(1);
}
