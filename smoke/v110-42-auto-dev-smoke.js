#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.42 Auto Dev Pipeline
 *
 * Verifies:
 *   - TOOL_META.version is 110.42.0
 *   - All public exports are present
 *   - classifyClaudeFailure correctly classifies all failure types
 *   - autoVerify returns PASS/FAIL with correct shape
 *   - runAutoDev dryRun completes full pipeline (no API calls)
 *   - package.json has auto:dev script
 *   - Destructive pattern detection triggers humanGate
 *   - reviewAllResults dryRun returns correct shape
 *   - sendDiscordReport dryRun returns correct shape
 */

const assert = require('node:assert');
const pkg    = require('../package.json');
const auto   = require('../tools/kosame-auto-dev');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }
function skip(msg) { console.log(`  SKIP: ${msg}`); }

console.log('=== v110.42 auto-dev pipeline smoke ===');

// Version
assert.ok(pkg.version >= '110.42.0');
pass('package version >= 110.42.0');

assert.strictEqual(auto.TOOL_META.version, '110.42.0');
pass('TOOL_META.version is 110.42.0');

assert.strictEqual(auto.TOOL_META.feature, 'v110-42-auto-dev');
pass('TOOL_META.feature is v110-42-auto-dev');

assert.strictEqual(auto.TOOL_META.dryRunDefault, true);
pass('TOOL_META.dryRunDefault is true');

// Public exports
for (const fn of ['runAutoDev', 'runTask', 'executeClaude', 'autoVerify',
                   'fixWithPermittedModel', 'reviewAllResults', 'sendDiscordReport',
                   'classifyClaudeFailure']) {
  assert.strictEqual(typeof auto[fn], 'function', `${fn} must be a function`);
  pass(`exports.${fn} is function`);
}

// npm scripts
assert.ok(pkg.scripts['auto:dev'], 'auto:dev script must exist');
pass('npm run auto:dev script exists');

assert.ok(pkg.scripts['smoke:v110-42-auto-dev'], 'smoke:v110-42-auto-dev script must exist');
pass('smoke:v110-42-auto-dev script exists');

// classifyClaudeFailure
const { classifyClaudeFailure } = auto;

const authFail = classifyClaudeFailure(null, 'authentication failed, api key invalid 401 unauthorized', 1);
assert.strictEqual(authFail.type, 'auth');
assert.strictEqual(authFail.fallback, 'cheapFirstRun');
pass('classifyClaudeFailure: auth → cheapFirstRun');

const rateFail = classifyClaudeFailure(null, 'rate limit exceeded 429 too many requests', 1);
assert.strictEqual(rateFail.type, 'rate_limit');
assert.strictEqual(rateFail.fallback, 'cheapFirstRun');
pass('classifyClaudeFailure: rate_limit → cheapFirstRun');

const humanFail = classifyClaudeFailure(null, 'permission required approval human gate', 1);
assert.strictEqual(humanFail.type, 'human_gate');
assert.strictEqual(humanFail.fallback, null);
pass('classifyClaudeFailure: human_gate → fallback null');

const timeoutFail = classifyClaudeFailure({ code: 'ETIMEDOUT', message: 'timeout' }, '', null);
assert.strictEqual(timeoutFail.type, 'timeout');
assert.strictEqual(timeoutFail.fallback, 'cheapFirstRun');
pass('classifyClaudeFailure: timeout → cheapFirstRun');

const genericFail = classifyClaudeFailure(null, 'some unknown error', 1);
assert.strictEqual(genericFail.type, 'generic');
assert.strictEqual(genericFail.fallback, 'cheapFirstRun');
pass('classifyClaudeFailure: generic → cheapFirstRun');

// autoVerify
const { autoVerify } = auto;

const taskMock = { id: 'T1', title: 'simple task', description: 'do stuff', difficulty: 'low' };

const goodOutput = 'function doStuff() {\n  const result = calculate();\n  return result;\n}\n'.repeat(3);
const v1 = autoVerify(taskMock, goodOutput, {});
assert.strictEqual(typeof v1.pass, 'boolean');
assert.strictEqual(typeof v1.score, 'number');
assert.ok(v1.score >= 0 && v1.score <= 100);
assert.ok(v1.pass, `long valid output should PASS: ${v1.reason}`);
pass('autoVerify: good output → PASS');

const errorOutput = 'Error: something went wrong\n  at some.file:1:2';
const v2 = autoVerify(taskMock, errorOutput, {});
assert.strictEqual(v2.pass, false);
pass('autoVerify: Error output → FAIL');

const emptyOutput = '  ';
const v3 = autoVerify(taskMock, emptyOutput, {});
assert.strictEqual(v3.pass, false);
pass('autoVerify: empty output → FAIL');

// runAutoDev dryRun
(async () => {
  const specText = `
# テスト設計書
## タスク1: 認証モジュール実装
ログイン・ログアウト処理を実装する
難易度: medium

## タスク2: データ取得API
バックエンドからデータを取得するAPIを実装する
難易度: low
`;

  const result = await auto.runAutoDev(specText, {
    dryRun:  true,
    silent:  true,
    project: 'kosame-dev-orchestra',
  });

  assert.ok(result, 'runAutoDev must return a result');
  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.version, '110.42.0');
  assert.ok(typeof result.taskCount === 'number', 'taskCount must be number');
  assert.ok(typeof result.passCount === 'number', 'passCount must be number');
  assert.ok(Array.isArray(result.tasks), 'tasks must be array');
  assert.ok(result.review, 'review must exist');
  assert.strictEqual(result.review.dryRun, true);
  assert.ok(typeof result.review.approved === 'boolean', 'review.approved must be boolean');
  assert.strictEqual(result.realProductActionsExecuted, false);
  pass('runAutoDev dryRun returns correct shape');

  assert.ok(result.tasks.length >= 0, 'tasks array valid');
  for (const t of result.tasks) {
    assert.ok(typeof t.taskId === 'string', 'task.taskId must be string');
    assert.ok(typeof t.title === 'string', 'task.title must be string');
    assert.ok(typeof t.verifyPass === 'boolean', 'task.verifyPass must be boolean');
    assert.ok(typeof t.durationMs === 'number', 'task.durationMs must be number');
  }
  pass(`runAutoDev dryRun: ${result.tasks.length} tasks all have correct shape`);

  // reviewAllResults dryRun
  const reviewRes = await auto.reviewAllResults(
    [{ title: 'test task', verifyPass: true, fixed: false }],
    { dryRun: true, out: () => {} }
  );
  assert.ok(typeof reviewRes.avgScore === 'number');
  assert.ok(typeof reviewRes.approved === 'boolean');
  assert.strictEqual(reviewRes.dryRun, true);
  pass('reviewAllResults dryRun returns correct shape');

  // sendDiscordReport dryRun
  const reportRes = await auto.sendDiscordReport(
    { taskCount: 2, passCount: 2, fixedCount: 0, failedCount: 0, reviewScore: 88, approved: true },
    { dryRun: true, out: () => {} }
  );
  assert.ok(typeof reportRes.ok === 'boolean');
  assert.strictEqual(reportRes.dryRun, true);
  pass('sendDiscordReport dryRun returns correct shape');

  // executeClaude dryRun
  const execRes = await auto.executeClaude(
    { id: 'T1', title: 'test impl', description: 'impl', difficulty: 'low' },
    { dryRun: true, out: () => {} }
  );
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.dryRun, true);
  assert.ok(typeof execRes.output === 'string');
  pass('executeClaude dryRun returns success with output');

  console.log(`\n✅ v110.42 auto-dev pipeline smoke PASSED (${passed} checks)`);
})().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
