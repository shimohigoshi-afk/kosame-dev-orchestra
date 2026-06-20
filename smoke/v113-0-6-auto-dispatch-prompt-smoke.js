#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const WATCHER_PATH = path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js');

async function main() {
  console.log('=== v113.0.6 auto-dispatch prompt smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.6'), `version must be >= 113.0.6 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-6'], 'smoke:v113-0-6 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-6'), 'verify must include smoke:v113-0-6');
  console.log('  PASS: package wiring');

  delete require.cache[require.resolve(WATCHER_PATH)];
  const watcher = require(WATCHER_PATH);

  assert.ok(typeof watcher.buildDispatchPrompt === 'function', 'watcher must export buildDispatchPrompt');
  console.log('  PASS: buildDispatchPrompt exported');

  // A minimal work order body (no safety keywords — simulates truncated latest.md)
  const minimalWorkOrder = [
    'cd /home/lavie/kosame-dev-orchestra',
    '',
    'テスト作業票: UIボタンのラベルを変更してください。',
    '対象: KOSAME Dev Orchestra',
  ].join('\n');

  const dispatchPrompt = watcher.buildDispatchPrompt(minimalWorkOrder);
  assert.ok(typeof dispatchPrompt === 'string', 'buildDispatchPrompt must return a string');
  assert.ok(dispatchPrompt.length > 0, 'dispatch prompt must not be empty');
  console.log('  PASS: buildDispatchPrompt returns string');

  // Required safety keywords must be in the dispatch prompt
  for (const kw of watcher.REQUIRED_SAFETY_KEYWORDS) {
    assert.ok(dispatchPrompt.includes(kw), `dispatch prompt must include required keyword: "${kw}"`);
  }
  console.log('  PASS: required safety keywords injected by buildDispatchPrompt');

  // safetyPreFlight must pass on the dispatch prompt (even though raw work order lacked keywords)
  const preFlight = watcher.safetyPreFlight(dispatchPrompt);
  assert.equal(preFlight.ok, true, `dispatch prompt must pass safety pre-flight (got: ${preFlight.reason})`);
  console.log('  PASS: safetyPreFlight passes on dispatch prompt');

  // Work order content is preserved in the dispatch prompt
  assert.ok(dispatchPrompt.includes('テスト作業票'), 'dispatch prompt must embed work order content');
  assert.ok(dispatchPrompt.includes('cd /home/lavie/kosame-dev-orchestra'), 'dispatch prompt must embed repo path');
  console.log('  PASS: work order content preserved in dispatch prompt');

  // Result output block must be in the dispatch prompt
  assert.ok(dispatchPrompt.includes('KOSAME_RESULT_BEGIN'), 'dispatch prompt must include KOSAME_RESULT_BEGIN');
  assert.ok(dispatchPrompt.includes('KOSAME_RESULT_END'), 'dispatch prompt must include KOSAME_RESULT_END');
  console.log('  PASS: result block instruction present in dispatch prompt');

  // Force push in the work order content must still be caught
  const workOrderWithForcePush = minimalWorkOrder + '\ngit push --force origin main';
  const badPrompt = watcher.buildDispatchPrompt(workOrderWithForcePush);
  const forceResult = watcher.safetyPreFlight(badPrompt);
  assert.equal(forceResult.ok, false, 'force push in work order must still trigger Safety Stop');
  assert.ok(forceResult.reason.includes('Safety Stop'), 'reason must say Safety Stop');
  console.log('  PASS: force push in work order still blocked after wrapping');

  console.log('✅ v113.0.6 auto-dispatch prompt smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
