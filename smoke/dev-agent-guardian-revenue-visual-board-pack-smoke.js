'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-revenue-visual-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-revenue-visual-board-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 77, `pkg version must be >= 77.0.0, got ${pkg.version}`);
console.log('  PASS: package version 77.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-revenue-visual-board'],   'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-revenue-visual-board'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-revenue-visual-board exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-revenue-visual-board-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '77.0.0');
console.log('  PASS: tool meta version 77.0.0');

const result = tool.buildGuardianRevenueVisualBoard({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// guardianClassStatus includes v66-v70 keys
const gcs = result.guardianClassStatus;
assert.ok(gcs.attackSurfaceReview,          'guardianClassStatus must have attackSurfaceReview (v66)');
assert.ok(gcs.customerFacingOperationGuard, 'guardianClassStatus must have customerFacingOperationGuard (v67)');
assert.ok(gcs.dataSecretPermissionGate,     'guardianClassStatus must have dataSecretPermissionGate (v68)');
assert.ok(gcs.defensiveRedTeamDryRun,       'guardianClassStatus must have defensiveRedTeamDryRun (v69)');
assert.ok(gcs.guardianClassComplete,        'guardianClassStatus must have guardianClassComplete (v70)');
console.log('  PASS: guardianClassStatus includes v66/v67/v68/v69/v70');

// revenueLaunchStatus includes v71-v75 keys
const rls = result.revenueLaunchStatus;
assert.ok(rls.firstRevenueRoute,        'revenueLaunchStatus must have firstRevenueRoute (v71)');
assert.ok(rls.offerPricingTest,         'revenueLaunchStatus must have offerPricingTest (v72)');
assert.ok(rls.salesMessageOutreach,     'revenueLaunchStatus must have salesMessageOutreach (v73)');
assert.ok(rls.pilotCustomerOnboarding,  'revenueLaunchStatus must have pilotCustomerOnboarding (v74)');
assert.ok(rls.firstRevenueCompleteGate, 'revenueLaunchStatus must have firstRevenueCompleteGate (v75)');
console.log('  PASS: revenueLaunchStatus includes v71/v72/v73/v74/v75');

// Guardian not ready → Revenue not READY
const notReadyGuardian = tool.buildGuardianRevenueVisualBoard({
  guardianClassStatus: {
    attackSurfaceReview:          'PENDING',
    customerFacingOperationGuard: 'PENDING',
    dataSecretPermissionGate:     'PENDING',
    defensiveRedTeamDryRun:       'PENDING',
    guardianClassComplete:        'PENDING'
  }
});
assert.strictEqual(notReadyGuardian.guardianReady, false, 'guardianReady must be false when guardian not ready');
// Revenue should be blocked when guardian not ready
const revenueStatuses = Object.values(notReadyGuardian.revenueLaunchStatus);
assert.ok(revenueStatuses.some(s => s === 'BLOCKED' || s === 'HOLD'), 'revenue must be BLOCKED/HOLD when guardian not ready');
console.log('  PASS: Guardian not ready → Revenue BLOCKED/HOLD (not READY)');

// readyItems and blockedItems exist
assert.ok(Array.isArray(result.readyItems),   'readyItems must exist');
assert.ok(Array.isArray(result.blockedItems), 'blockedItems must exist');
console.log('  PASS: readyItems and blockedItems exist');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('secret read')),      'must deny secret read');
assert.ok(denied.some(d => d.includes('real email send')),  'must deny real email send');
assert.ok(denied.some(d => d.includes('real payment')),     'must deny real payment');
console.log('  PASS: dangerousActionsDenied correct');

assert.ok(typeof tool.isGuardianReady === 'function', 'isGuardianReady must be exported');
console.log('  PASS: isGuardianReady exported');

console.log('=== dev-agent-guardian-revenue-visual-board-pack smoke PASSED ===');
