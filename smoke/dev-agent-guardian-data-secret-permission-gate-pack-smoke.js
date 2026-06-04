'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-data-secret-permission-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-data-secret-permission-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 68, `pkg version must be >= 68.0.0, got ${pkg.version}`);
console.log('  PASS: package version 68.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-data-secret-permission-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-data-secret-permission-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-data-secret-permission-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-data-secret-permission-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '68.0.0', 'tool version must be 68.0.0');
console.log('  PASS: tool meta version 68.0.0');

const result = tool.buildDataSecretPermissionGate({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.dataAccessGates)      && result.dataAccessGates.length      >= 2, 'dataAccessGates must exist');
assert.ok(Array.isArray(result.secretGates)          && result.secretGates.length          >= 2, 'secretGates must exist');
assert.ok(Array.isArray(result.permissionBoundaries) && result.permissionBoundaries.length >= 2, 'permissionBoundaries must exist');
console.log('  PASS: dataAccessGates/secretGates/permissionBoundaries exist');

assert.ok(result.overallGateStatus, 'overallGateStatus must exist');
console.log('  PASS: overallGateStatus exists');

// OPEN critical gate → GATE_OPEN_CRITICAL
const criticalGate = tool.buildDataSecretPermissionGate({
  overrideStatuses: { 'dag-001': 'OPEN' }
});
assert.ok(['GATE_OPEN_CRITICAL', 'GATE_OPEN'].includes(criticalGate.overallGateStatus), `critical OPEN gate should trigger gate open status, got ${criticalGate.overallGateStatus}`);
console.log('  PASS: open critical gate detected');

assert.ok(typeof result.externalReviewRequired === 'boolean', 'externalReviewRequired must exist');
console.log('  PASS: externalReviewRequired exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('secret read')), 'must deny secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'must deny .env read');
assert.ok(denied.some(d => d.includes('deploy')),      'must deny deploy');
console.log('  PASS: dangerousActionsDenied correct');

assert.ok(tool.GATE_STATUS.OPEN === 'OPEN', 'GATE_STATUS must be exported');
console.log('  PASS: GATE_STATUS exported');

console.log('=== dev-agent-guardian-data-secret-permission-gate-pack smoke PASSED ===');
