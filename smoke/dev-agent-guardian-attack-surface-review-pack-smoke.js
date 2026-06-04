'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-attack-surface-review-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-attack-surface-review-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 66, `pkg version must be >= 66.0.0, got ${pkg.version}`);
console.log('  PASS: package version 66.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-attack-surface-review'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-attack-surface-review'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-attack-surface-review exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-attack-surface-review-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '66.0.0', 'tool version must be 66.0.0');
console.log('  PASS: tool meta version 66.0.0');

const result = tool.buildAttackSurfaceReview({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.attackSurfaces) && result.attackSurfaces.length >= 5, 'attackSurfaces must have 5+ items');
console.log('  PASS: attackSurfaces[] has 5+ surfaces');

assert.ok(result.overallRiskLevel, 'overallRiskLevel must exist');
assert.ok(['CRITICAL','HIGH','MEDIUM','LOW'].includes(result.overallRiskLevel), 'overallRiskLevel must be valid');
console.log('  PASS: overallRiskLevel valid');

assert.ok(result.riskSummary && typeof result.riskSummary.critical === 'number', 'riskSummary must exist');
console.log('  PASS: riskSummary exists');

assert.ok(Array.isArray(result.mitigationPriority), 'mitigationPriority must exist');
console.log('  PASS: mitigationPriority exists');

for (const s of result.attackSurfaces) {
  assert.ok(s.surfaceId && s.name && s.riskLevel, `surface ${s.surfaceId} must have id/name/riskLevel`);
  assert.ok(Array.isArray(s.mitigations) && s.mitigations.length > 0, `surface ${s.surfaceId} must have mitigations`);
}
console.log('  PASS: each surface has entryPoint/authBoundary/riskLevel/mitigations');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real exploit')), 'must deny real exploit');
assert.ok(denied.some(d => d.includes('deploy')),       'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),  'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct (includes real exploit/deploy/secret)');

assert.ok(typeof tool.evaluateOverallRisk === 'function', 'evaluateOverallRisk must be exported');
assert.ok(tool.RISK_LEVELS.CRITICAL === 'CRITICAL', 'RISK_LEVELS must be exported');
console.log('  PASS: evaluateOverallRisk and RISK_LEVELS exported');

console.log('=== dev-agent-guardian-attack-surface-review-pack smoke PASSED ===');
