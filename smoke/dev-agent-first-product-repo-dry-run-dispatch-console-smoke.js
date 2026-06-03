'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/first-product-repo-dry-run-dispatch-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-dry-run-dispatch-console smoke ===');

assert.ok(compareVersion(pkg.version, '28.0.0') >= 0, `pkg version must be >= 28.0.0, got ${pkg.version}`);
console.log('  PASS: package version 28.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-dry-run-dispatch-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-dry-run-dispatch-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v28.0.0-release-record.md')), 'v28 release record must exist');
console.log('  PASS: v28 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-dry-run-dispatch-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '28.0.0', 'tool version must be 28.0.0');
console.log('  PASS: tool meta version 28.0.0');

// ---- ready dispatch: all summaries provided ----
const readyDispatch = tool.buildDispatchConsole({
  targetProduct:            'sales_dx',
  workOrderSummary:         '営業DXリード向けメール一括返信機能を src/leads/ に追加する',
  connectionBridgeSummary:  'bridge-123: kosame-sales-dx, dry_run_readonly_bridge_only, ready=true',
  preflightSummary:         'preflight-456: no secrets, allowed zones confirmed',
  executionPromptSummary:   'Claude execution prompt: add bulkEmailReply() to src/leads/'
});

assert.strictEqual(readyDispatch.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(readyDispatch.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(readyDispatch.dryRunDispatchId, 'dryRunDispatchId must be present');
console.log('  PASS: dryRunDispatchId present');

assert.ok(readyDispatch.workOrderSummary, 'workOrderSummary must be present');
console.log('  PASS: workOrderSummary present');

assert.ok(readyDispatch.connectionBridgeSummary, 'connectionBridgeSummary must be present');
console.log('  PASS: connectionBridgeSummary present');

assert.ok(readyDispatch.preflightSummary, 'preflightSummary must be present');
console.log('  PASS: preflightSummary present');

assert.ok(Array.isArray(readyDispatch.dryRunSteps) && readyDispatch.dryRunSteps.length > 0, 'dryRunSteps must be non-empty');
console.log('  PASS: dryRunSteps non-empty');

assert.ok(Array.isArray(readyDispatch.expectedClaudeActions) && readyDispatch.expectedClaudeActions.length > 0, 'expectedClaudeActions must be non-empty');
console.log('  PASS: expectedClaudeActions non-empty');

assert.ok(Array.isArray(readyDispatch.expectedHumanActions) && readyDispatch.expectedHumanActions.length > 0, 'expectedHumanActions must be non-empty');
console.log('  PASS: expectedHumanActions non-empty');

assert.ok(Array.isArray(readyDispatch.allowedActions) && readyDispatch.allowedActions.length > 0, 'allowedActions must be non-empty');
console.log('  PASS: allowedActions non-empty');

assert.ok(Array.isArray(readyDispatch.blockedActions) && readyDispatch.blockedActions.length > 0, 'blockedActions must be non-empty');
assert.ok(readyDispatch.blockedActions.includes('real_git_commit'), 'real_git_commit must be blocked');
assert.ok(readyDispatch.blockedActions.includes('real_deploy'), 'real_deploy must be blocked');
assert.ok(readyDispatch.blockedActions.includes('secret_access'), 'secret_access must be blocked');
console.log('  PASS: blockedActions correct');

assert.ok(readyDispatch.verificationPlan, 'verificationPlan must be present');
assert.ok(readyDispatch.verificationPlan.nodeCheck, 'verificationPlan.nodeCheck must be present');
assert.ok(readyDispatch.verificationPlan.humanReview, 'verificationPlan.humanReview must be present');
console.log('  PASS: verificationPlan complete');

assert.ok(readyDispatch.rollbackPlan, 'rollbackPlan must be present');
assert.ok(readyDispatch.rollbackPlan.forbidden, 'rollbackPlan.forbidden must be present');
console.log('  PASS: rollbackPlan present');

assert.strictEqual(readyDispatch.dispatchDryRunReady, true, 'dispatchDryRunReady must be true when all summaries provided');
console.log('  PASS: dispatchDryRunReady true');

assert.strictEqual(readyDispatch.notReadyReasons.length, 0, 'notReadyReasons must be empty');
console.log('  PASS: notReadyReasons empty');

assert.ok(Array.isArray(readyDispatch.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(readyDispatch.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(readyDispatch.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(readyDispatch.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(readyDispatch.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- missing bridge/preflight ----
const missingDispatch = tool.buildDispatchConsole({
  targetProduct:    'anesty_board',
  workOrderSummary: 'some work'
});
assert.strictEqual(missingDispatch.dispatchDryRunReady, false, 'dispatchDryRunReady must be false when bridge/preflight missing');
assert.ok(missingDispatch.notReadyReasons.some(r => r.includes('connectionBridgeSummary')), 'must mention missing bridge');
assert.ok(missingDispatch.notReadyReasons.some(r => r.includes('preflightSummary')), 'must mention missing preflight');
console.log('  PASS: missing bridge/preflight handled');

// ---- unknown product ----
const unknownDispatch = tool.buildDispatchConsole({ targetProduct: 'unknown_xyz' });
assert.strictEqual(unknownDispatch.dispatchDryRunReady, false, 'dispatchDryRunReady must be false for unknown product');
console.log('  PASS: unknown product handled');

// ---- all 5 products generate dispatch ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const d = tool.buildDispatchConsole({ targetProduct: p });
  assert.ok(d.targetRepoCandidate, `${p} must have targetRepoCandidate`);
  assert.ok(d.dryRunSteps.length > 0, `${p} must have dryRunSteps`);
}
console.log('  PASS: all 5 products generate dispatch console');

console.log('PASS: first-product-repo-dry-run-dispatch-console');
