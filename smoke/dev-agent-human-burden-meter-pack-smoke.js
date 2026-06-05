'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-human-burden-meter-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-human-burden-meter-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.3.0', 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. no danger gate → shouldAskUser:false
const r1 = tool.measureBurden({ dangerGateActive: false });
assert.strictEqual(r1.shouldAskUser, false);
assert.strictEqual(r1.shouldProceedAutomatically, true);
assert.strictEqual(r1.humanApprovalRequired, false);
assert.strictEqual(r1.burdenBand, tool.BURDEN_BANDS.LOW);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: no danger gate → shouldAskUser:false, auto-proceed');

// 4. many confirmations/copy-paste/chat → HIGH or TOO_MUCH
const r2 = tool.measureBurden({
  preferenceQuestions: 4,
  repeatedConfirmations: 3,
  chatConsultations: 3,
  dangerGateActive: false
});
assert.ok(
  r2.burdenBand === tool.BURDEN_BANDS.HIGH || r2.burdenBand === tool.BURDEN_BANDS.TOO_MUCH,
  `expected HIGH or TOO_MUCH, got ${r2.burdenBand}`
);
assert.ok(r2.detectedBurdenSources.length > 0);
console.log(`  PASS: heavy asks → burden ${r2.burdenBand}`);

// 5. excessive asks → TOO_MUCH
const r3 = tool.measureBurden({
  preferenceQuestions: 5,
  repeatedConfirmations: 5,
  chatConsultations: 5,
  unnecessaryDetours: 3,
  copyPasteActions: 4,
  dangerGateActive: false
});
assert.strictEqual(r3.burdenBand, tool.BURDEN_BANDS.TOO_MUCH);
assert.ok(r3.recommendedReductionActions.length > 0);
assert.ok(r3.recommendedReductionActions.some(a => a.includes('compress_confirmations')));
assert.ok(r3.recommendedReductionActions.some(a => a.includes('use_failure_snapshot')));
console.log('  PASS: excessive asks → TOO_MUCH with reduction actions');

// 6. danger gate → humanApprovalRequired:true, shouldAskUser:true
const r4 = tool.measureBurden({ dangerGateActive: true });
assert.strictEqual(r4.shouldAskUser, true);
assert.strictEqual(r4.humanApprovalRequired, true);
console.log('  PASS: danger gate → humanApprovalRequired, shouldAskUser:true');

// 7. HIGH burden includes compress and snapshot recommendations
const r5 = tool.measureBurden({
  preferenceQuestions: 3,
  repeatedConfirmations: 3,
  dangerGateActive: false
});
if (r5.burdenBand === tool.BURDEN_BANDS.HIGH || r5.burdenBand === tool.BURDEN_BANDS.TOO_MUCH) {
  assert.ok(r5.recommendedReductionActions.some(a => a.includes('compress_confirmations')));
  assert.ok(r5.recommendedReductionActions.some(a => a.includes('use_failure_snapshot')));
}
console.log('  PASS: burden reduction includes compress confirmations and failure snapshot');

// 8. dryRun / realProductActionsExecuted
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-human-burden-meter-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-human-burden-meter-pack');
