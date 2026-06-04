'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-defensive-red-team-dry-run-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-defensive-red-team-dry-run-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 69, `pkg version must be >= 69.0.0, got ${pkg.version}`);
console.log('  PASS: package version 69.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-defensive-red-team-dry-run'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-defensive-red-team-dry-run'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-defensive-red-team-dry-run exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-defensive-red-team-dry-run-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '69.0.0', 'tool version must be 69.0.0');
console.log('  PASS: tool meta version 69.0.0');

const result = tool.buildRedTeamDryRun({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.redTeamScenarios) && result.redTeamScenarios.length >= 5, 'redTeamScenarios must have 5+ items');
console.log('  PASS: redTeamScenarios[] has 5+ items');

// No real attacks
for (const s of result.redTeamScenarios) {
  assert.strictEqual(s.realAttack, false, `scenario ${s.scenarioId} realAttack must be false`);
}
assert.strictEqual(result.realAttackExecuted, false, 'realAttackExecuted must be false');
console.log('  PASS: no real attacks executed (realAttack=false for all scenarios)');

// Each scenario has required fields
for (const s of result.redTeamScenarios) {
  assert.ok(s.scenarioId && s.name && s.severity && s.dryRunTest && s.defenseCheck, `scenario ${s.scenarioId} must have required fields`);
}
console.log('  PASS: each scenario has scenarioId/name/severity/dryRunTest/defenseCheck');

// Insurance scenario present
const insScenario = result.redTeamScenarios.find(s => s.scenarioId === 'rt-006' || (s.name && s.name.includes('insurance') || (s.name && s.name.includes('告知'))));
assert.ok(insScenario || result.redTeamScenarios.some(s => s.description && s.description.includes('insurance') || s.defenseCheck && s.defenseCheck.includes('insurance')), 'must include insurance-related scenario');
console.log('  PASS: insurance/disclosure-duty scenario included');

// Failed defense → DEFENSE_FAILED
const failedResult = tool.buildRedTeamDryRun({ overrideStatuses: { 'rt-001': 'defense_failed' } });
assert.ok(['DEFENSE_FAILED', 'PARTIAL_DEFENSE_FAILURE'].includes(failedResult.overallStatus), `defense failure must trigger appropriate status, got ${failedResult.overallStatus}`);
console.log('  PASS: defense_failed scenario sets DEFENSE_FAILED or PARTIAL_DEFENSE_FAILURE');

assert.ok(Array.isArray(result.recommendations) && result.recommendations.length > 0, 'recommendations must exist');
console.log('  PASS: recommendations exist');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real exploit')),    'must deny real exploit');
assert.ok(denied.some(d => d.includes('real penetration')), 'must deny real pentest without authorization');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-guardian-defensive-red-team-dry-run-pack smoke PASSED ===');
