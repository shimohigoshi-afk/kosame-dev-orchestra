'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-failure-snapshot-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-failure-snapshot-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.2.0', 'package version must be 110.2.0 or later');
console.log('  PASS: package version >= 110.2.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.2.0', 'tool meta version must be 110.2.0');
console.log('  PASS: tool meta version is 110.2.0');

// 3. provider_timeout produces snapshot
const timeoutSnap = tool.buildSnapshot({ failureType: 'provider_timeout', failedStep: 'gemini_bulk' });
assert.strictEqual(timeoutSnap.failureType, 'provider_timeout');
assert.ok(timeoutSnap.handoffTargetSuggestion, 'handoffTargetSuggestion must exist');
assert.strictEqual(timeoutSnap.dryRun, true);
assert.strictEqual(timeoutSnap.realProductActionsExecuted, false);
console.log('  PASS: provider_timeout produces snapshot');

// 4. context_too_large sets shouldReadFullLog:false
const ctxSnap = tool.buildSnapshot({ failureType: 'context_too_large' });
assert.strictEqual(ctxSnap.shouldReadFullLog, false);
assert.ok(ctxSnap.maxContextPolicy.includes('use_failure_snapshot_only'));
console.log('  PASS: context_too_large sets shouldReadFullLog:false');

// 5. touchedFiles and changedFiles are preserved
const withFiles = tool.buildSnapshot({
  failureType: 'smoke_failed',
  touchedFiles: ['tools/foo.js', 'smoke/foo-smoke.js'],
  changedFiles: ['tools/foo.js']
});
assert.deepStrictEqual(withFiles.touchedFiles, ['tools/foo.js', 'smoke/foo-smoke.js']);
assert.deepStrictEqual(withFiles.changedFiles, ['tools/foo.js']);
console.log('  PASS: touchedFiles and changedFiles are preserved');

// 6. nextRecommendedAction exists
const withNext = tool.buildSnapshot({ failureType: 'verification_failed', nextRecommendedAction: 'Fix smoke test assertion' });
assert.strictEqual(withNext.nextRecommendedAction, 'Fix smoke test assertion');
console.log('  PASS: nextRecommendedAction exists');

// 7. dangerous actions are denied
const snap = tool.buildSnapshot({});
assert.ok(Array.isArray(snap.dangerousActionsDenied));
assert.ok(snap.dangerousActionsDenied.some(a => a === 'secret'));
assert.ok(snap.dangerousActionsDenied.some(a => a === 'deploy'));
assert.ok(snap.dangerousActionsDenied.some(a => a === 'git_push'));
console.log('  PASS: dangerous actions are denied in snapshot');

// 8. dryRun:true
assert.strictEqual(snap.dryRun, true);
console.log('  PASS: dryRun is true');

// 9. realProductActionsExecuted:false
assert.strictEqual(snap.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted is false');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-failure-snapshot-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-failure-snapshot-pack');
