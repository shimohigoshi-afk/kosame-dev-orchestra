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
const tool   = require('../tools/productization-readiness-review-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== productization-readiness-review-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '19.5.0') >= 0, `pkg version must be >= 19.5.0, got ${pkg.version}`);
console.log('  PASS: package version 19.5.0 or later');

assert.ok(pkg.scripts['smoke:productization-readiness-review-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:productization-readiness-review-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v19.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/productization-readiness-review-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '19.5.0', 'tool version must be 19.5.0');
console.log('  PASS: tool meta version 19.5.0');

// all-passed case
const resultPass = tool.buildReadinessReview({ productType: 'all', checks: {} });

assert.strictEqual(resultPass.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(resultPass.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(resultPass.readinessReviewId, 'readinessReviewId must be present');
console.log('  PASS: readinessReviewId present');

assert.ok(Array.isArray(resultPass.productizationChecklist) && resultPass.productizationChecklist.length > 0, 'checklist must be non-empty');
console.log('  PASS: productizationChecklist non-empty');

assert.ok(Array.isArray(resultPass.missingItems), 'missingItems must be array');
console.log('  PASS: missingItems array');

assert.ok(Array.isArray(resultPass.blockerItems), 'blockerItems must be array');
console.log('  PASS: blockerItems array');

assert.ok(typeof resultPass.safeToPrototype === 'boolean', 'safeToPrototype must be boolean');
console.log('  PASS: safeToPrototype boolean');

assert.ok(Array.isArray(resultPass.notReadyReasons), 'notReadyReasons must be array');
console.log('  PASS: notReadyReasons array');

assert.ok(Array.isArray(resultPass.nextActions) && resultPass.nextActions.length > 0, 'nextActions must be non-empty');
console.log('  PASS: nextActions non-empty');

assert.ok(tool.FINAL_DECISION_OPTIONS.includes(resultPass.finalDecision), 'finalDecision must be valid');
console.log(`  PASS: finalDecision valid (${resultPass.finalDecision})`);

assert.ok(Array.isArray(resultPass.finalDecisionOptions), 'finalDecisionOptions must be array');
assert.ok(resultPass.finalDecisionOptions.includes('approve'), 'must include approve');
assert.ok(resultPass.finalDecisionOptions.includes('revise'),  'must include revise');
assert.ok(resultPass.finalDecisionOptions.includes('reject'),  'must include reject');
assert.ok(resultPass.finalDecisionOptions.includes('hold'),    'must include hold');
console.log('  PASS: finalDecisionOptions includes approve/revise/reject/hold');

// blockers case
const resultBlocked = tool.buildReadinessReview({
  productType: 'all',
  checks: {
    intake_process_defined:         false,
    human_approval_gate_present:    false,
    dry_run_mode_enforced:          false
  }
});
assert.ok(resultBlocked.blockerItems.length > 0, 'blockerItems must be non-empty when blockers present');
assert.strictEqual(resultBlocked.safeToPrototype, false, 'safeToPrototype must be false when blockers present');
assert.strictEqual(resultBlocked.finalDecision, 'hold', 'finalDecision must be hold when blockers present');
console.log('  PASS: blocker case handled correctly');

assert.ok(tool.READINESS_CHECKLIST_SPEC.length >= 14, 'checklist spec must have >= 14 items');
console.log('  PASS: checklist spec has >= 14 items');

assert.strictEqual(resultPass.noRealExecution, true, 'noRealExecution must be true');
console.log('  PASS: noRealExecution true');

console.log('PASS: productization-readiness-review-console-pack');
