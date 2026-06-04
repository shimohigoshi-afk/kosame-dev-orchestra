'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-customer-onboarding-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-customer-onboarding-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 74, `pkg version must be >= 74.0.0, got ${pkg.version}`);
console.log('  PASS: package version 74.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-customer-onboarding'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-customer-onboarding'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-customer-onboarding exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-customer-onboarding-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '74.0.0', 'tool version must be 74.0.0');
console.log('  PASS: tool meta version 74.0.0');

const result = tool.buildPilotCustomerOnboarding({ productIdea: 'AI議事録自動化ツール' });

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.pilotCustomerCriteria) && result.pilotCustomerCriteria.length >= 4, 'pilotCustomerCriteria must have 4+ items');
assert.ok(result.pilotCustomerCriteria.some(c => c.includes('Guardian')), 'pilotCustomerCriteria must include Guardian Class requirement');
console.log('  PASS: pilotCustomerCriteria has 4+ items including Guardian Class');

assert.ok(Array.isArray(result.onboardingSteps) && result.onboardingSteps.length >= 4, 'onboardingSteps must have 4+ steps');
const humanOnboardSteps = result.onboardingSteps.filter(s => s.humanRequired);
assert.ok(humanOnboardSteps.length >= 2, 'onboardingSteps must have 2+ human-required steps');
console.log('  PASS: onboardingSteps has 4+ steps (2+ human-required)');

assert.ok(Array.isArray(result.successMetrics) && result.successMetrics.length >= 3, 'successMetrics must have 3+ items');
console.log('  PASS: successMetrics exists');

assert.ok(Array.isArray(result.escalationPath) && result.escalationPath.length >= 2, 'escalationPath must exist');
assert.ok(result.escalationPath.some(e => e.includes('じゅんやさん') || e.includes('Junya')), 'escalationPath must mention じゅんやさん');
console.log('  PASS: escalationPath includes じゅんやさん');

assert.strictEqual(result.guardianClassRequired, true, 'guardianClassRequired must be true');
console.log('  PASS: guardianClassRequired true');

assert.strictEqual(result.realOnboardingExecuted, false, 'realOnboardingExecuted must be false');
console.log('  PASS: realOnboardingExecuted false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real customer data')), 'must deny real customer data import');
assert.ok(denied.some(d => d.includes('real contract')),      'must deny real contract');
assert.ok(denied.some(d => d.includes('real payment')),       'must deny real payment');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-pilot-customer-onboarding-pack smoke PASSED ===');
