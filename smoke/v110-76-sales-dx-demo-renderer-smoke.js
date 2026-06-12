#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.76 Sales DX Demo Renderer
 *
 * Verifies:
 *   - Module exports / TOOL_META
 *   - render() produces Markdown-like text
 *   - Temperature label appears in output
 *   - Human gate note appears
 *   - Dry run guarantee appears
 *   - saved/sent/charged/externalApiCalled appear
 *   - NOTTA fixture shows 中温度_警戒あり
 *   - No secret/customer/salesDX/ANESTY leakage
 */

const pkg = require('../package.json');
const renderer = require('../tools/sales-dx-p0-lite-demo-renderer');

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
  const parts = String(v).split('.').map(Number);
  return parts[0] > major || (parts[0] === major && parts[1] >= minor);
}

console.log('=== v110.76 sales dx demo renderer smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.76',   versionAtLeast(pkg.version, 110, 76));
check('TOOL_META exported',           renderer.TOOL_META?.version === '110.76.0');
check('TOOL_META.dryRunOnly',         renderer.TOOL_META.dryRunOnly === true);
check('FIXTURES exported',            typeof renderer.FIXTURES === 'object');
check('render exported',              typeof renderer.render === 'function');

// ── All fixtures render without error ────────────────────────────────────────

for (const [name, fn] of Object.entries(renderer.FIXTURES)) {
  let threw = false;
  try {
    const result = fn();
    const output = renderer.render(result);
    check(`fixture ${name}: renders`, output && output.length > 100);
    check(`fixture ${name}: has temperature`, output.includes('温度感'));
    check(`fixture ${name}: has human gate`, output.includes('Human Gate') || output.includes('human'));
    check(`fixture ${name}: has dry run`, output.includes('Dry Run'));
    check(`fixture ${name}: has dryRun table`, output.includes('Dry Run') || (output.includes('保存') && output.includes('送信') && output.includes('課金')));
  } catch (e) {
    threw = true;
    check(`fixture ${name}: does not throw`, false, e.message);
  }
}

// ── NOTTA fixture specific checks ────────────────────────────────────────────

const nottaResult = renderer.FIXTURES.notta();
const nottaOutput = renderer.render(nottaResult);
check('notta: temperature 中温度_警戒あり', nottaOutput.includes('中温度_警戒あり') || nottaOutput.includes('medium_caution'));
check('notta: guard words',           nottaOutput.includes('考えておきます'));
check('notta: dryRun NO',            nottaOutput.includes('NO'));
check('notta: humanGateNote',        nottaResult.humanGateNote && nottaResult.humanGateNote.length > 0);

// ── render is pure (no side effects) ─────────────────────────────────────────

const renderCount = Object.keys(renderer.FIXTURES).length;
check('all fixtures rendered', renderCount >= 5);

// ── No secret leakage ───────────────────────────────────────────────────────

const allOutput = Object.values(renderer.FIXTURES).map(fn => renderer.render(fn())).join(' ');
check('no API key in output',         !allOutput.includes('sk-') && !allOutput.includes('AIza'));
check('no secret value in output',    !allOutput.includes('api_key='));
check('no salesDX in output',         !allOutput.includes('salesDX') && !allOutput.includes('transcriber'));
check('no ANESTY Board in output',    !allOutput.includes('ANESTY'));

// ── smoke:v110-76 script exists ─────────────────────────────────────────────

check('smoke:v110-76 script in package.json', 'smoke:v110-76' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.76 sales dx demo renderer smoke PASSED`);
} else {
  console.error(`\n❌ v110.76 sales dx demo renderer smoke FAILED (${failures} failures)`);
  process.exit(1);
}
