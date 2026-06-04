'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-class-complete-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-class-complete-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 70, `pkg version must be >= 70.0.0, got ${pkg.version}`);
console.log('  PASS: package version 70.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-class-complete'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-class-complete'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-class-complete exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-class-complete-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '70.0.0', 'tool version must be 70.0.0');
console.log('  PASS: tool meta version 70.0.0');

const result = tool.buildGuardianClassComplete({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.attackSurfaceReview && result.attackSurfaceReview.reviewId, 'attackSurfaceReview must exist (v66)');
console.log('  PASS: includes v66 attackSurfaceReview');

assert.ok(result.customerFacingGuard && result.customerFacingGuard.guardId, 'customerFacingGuard must exist (v67)');
assert.ok(result.customerFacingGuard.insuranceSalesRiskNotes, 'customerFacingGuard must have insuranceSalesRiskNotes');
console.log('  PASS: includes v67 customerFacingGuard with insuranceSalesRiskNotes');

assert.ok(result.dataSecretPermissionGate && result.dataSecretPermissionGate.gateId, 'dataSecretPermissionGate must exist (v68)');
console.log('  PASS: includes v68 dataSecretPermissionGate');

assert.ok(result.defensiveRedTeamDryRun && result.defensiveRedTeamDryRun.runId, 'defensiveRedTeamDryRun must exist (v69)');
assert.strictEqual(result.defensiveRedTeamDryRun.realAttackExecuted, false, 'realAttackExecuted must be false');
console.log('  PASS: includes v69 defensiveRedTeamDryRun (no real attacks)');

assert.ok(result.guardianReadiness && result.guardianReadiness.status, 'guardianReadiness must exist');
assert.ok(['READY','NEEDS_REMEDIATION','BLOCKED'].includes(result.guardianReadiness.status), 'guardianReadiness.status must be valid');
console.log('  PASS: guardianReadiness.status valid');

assert.strictEqual(result.completePackReady, true, 'completePackReady must be true when no blockers');
console.log('  PASS: completePackReady true when no blockers');

const blocked = tool.buildGuardianClassComplete({ blockers: ['IAM review pending'] });
assert.strictEqual(blocked.completePackReady, false, 'completePackReady must be false with blockers');
console.log('  PASS: completePackReady false with blockers');

assert.ok(Array.isArray(result.completeCriteria) && result.completeCriteria.length >= 4, 'completeCriteria must exist');
console.log('  PASS: completeCriteria exists');

assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real exploit')),     'must deny real exploit');
assert.ok(denied.some(d => d.includes('real email send')),  'must deny real email send');
assert.ok(denied.some(d => d.includes('secret read')),      'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-guardian-class-complete-pack smoke PASSED ===');
