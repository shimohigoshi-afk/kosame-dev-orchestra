'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-first-revenue-complete-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-first-revenue-complete-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 75, `pkg version must be >= 75.0.0, got ${pkg.version}`);
console.log('  PASS: package version 75.0.0 or later');

assert.ok(pkg.scripts['smoke:first-revenue-complete-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-revenue-complete-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:first-revenue-complete-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-first-revenue-complete-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '75.0.0', 'tool version must be 75.0.0');
console.log('  PASS: tool meta version 75.0.0');

const D = tool.GATE_DECISIONS;

// default clean run
const result = tool.buildFirstRevenueCompleteGate({
  productIdea:                   'AI議事録自動化ツール',
  customerFacingGuardConfirmed:  true,
  dataSecretPermissionConfirmed: true
});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// includes v70
assert.ok(result.guardianClassComplete && result.guardianClassComplete.completePackId, 'guardianClassComplete (v70) must exist');
console.log('  PASS: includes v70 guardianClassComplete');

// includes v71-v74
assert.ok(result.firstRevenueRoute       && result.firstRevenueRoute.routeId,        'firstRevenueRoute (v71) must exist');
assert.ok(result.offerPricingTest        && result.offerPricingTest.testId,          'offerPricingTest (v72) must exist');
assert.ok(result.salesMessageOutreach    && result.salesMessageOutreach.outreachId,  'salesMessageOutreach (v73) must exist');
assert.ok(result.pilotCustomerOnboarding && result.pilotCustomerOnboarding.onboardingId, 'pilotCustomerOnboarding (v74) must exist');
console.log('  PASS: includes v71 firstRevenueRoute / v72 offerPricingTest / v73 salesMessageOutreach / v74 pilotCustomerOnboarding');

// Decision options
assert.ok(result.decisionOptions.includes('READY_TO_PILOT'), 'decisionOptions must include READY_TO_PILOT');
assert.ok(result.decisionOptions.includes('HOLD'),           'decisionOptions must include HOLD');
assert.ok(result.decisionOptions.includes('BLOCKED'),        'decisionOptions must include BLOCKED');
console.log('  PASS: decisionOptions include READY_TO_PILOT/HOLD/BLOCKED');

// Clean → READY_TO_PILOT
assert.strictEqual(result.decision, D.READY_TO_PILOT, `Clean run should be READY_TO_PILOT, got ${result.decision}`);
assert.strictEqual(result.completePackReady, true, 'completePackReady must be true for clean run');
console.log('  PASS: clean run → READY_TO_PILOT');

// Guardian Class not ready → HOLD
const noGuardian = tool.buildFirstRevenueCompleteGate({ productIdea: 'test', blockers: ['Guardian not complete'] });
assert.ok([D.HOLD, D.BLOCKED].includes(noGuardian.decision), `Guardian not ready should HOLD/BLOCKED, got ${noGuardian.decision}`);
console.log('  PASS: Guardian not ready → HOLD or BLOCKED');

// customerFacingGuard not confirmed → HOLD
const noCfg = tool.buildFirstRevenueCompleteGate({
  productIdea:                  'test',
  customerFacingGuardConfirmed: false
});
assert.ok([D.HOLD, D.BLOCKED].includes(noCfg.decision), `customerFacingGuard not confirmed should HOLD, got ${noCfg.decision}`);
console.log('  PASS: customerFacingGuard not confirmed → HOLD');

// guardianReadiness
assert.ok(result.guardianReadiness && result.guardianReadiness.status, 'guardianReadiness must exist');
console.log('  PASS: guardianReadiness exists');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// READY_TO_PILOT criteria includes Guardian Class
assert.ok(Array.isArray(result.readyToPilotCriteria) && result.readyToPilotCriteria.some(c => c.includes('Guardian')), 'readyToPilotCriteria must mention Guardian Class');
console.log('  PASS: readyToPilotCriteria mentions Guardian Class');

// real actions blocked
assert.strictEqual(result.realRevenueActionsExecuted, false, 'realRevenueActionsExecuted must be false');
console.log('  PASS: realRevenueActionsExecuted false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real payment')),        'must deny real payment');
assert.ok(denied.some(d => d.includes('real contract')),       'must deny real contract');
assert.ok(denied.some(d => d.includes('real email send')),     'must deny real email send');
assert.ok(denied.some(d => d.includes('deploy')),              'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),         'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-first-revenue-complete-gate-pack smoke PASSED ===');
