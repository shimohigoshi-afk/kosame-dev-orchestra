'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-backoffice-agent-mvp-launch-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-backoffice-agent-mvp-launch-plan-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 93, `pkg version must be >= 93.0.0, got ${pkg.version}`);
console.log('  PASS: package version 93.0.0 or later');

assert.ok(pkg.scripts['smoke:backoffice-agent-mvp-launch-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:backoffice-agent-mvp-launch-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:backoffice-agent-mvp-launch-plan exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-backoffice-agent-mvp-launch-plan-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '93.0.0');
console.log('  PASS: tool meta version 93.0.0');

const result = tool.buildBackofficeAgentMvpLaunchPlan({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.allowedOperations) && result.allowedOperations.length > 0, 'allowedOperations must exist');
console.log('  PASS: allowedOperations exists');

// forbiddenOperations include tax/legal/labor judgment
assert.ok(Array.isArray(result.forbiddenOperations) && result.forbiddenOperations.length >= 5, 'forbiddenOperations must exist');
const fStr = result.forbiddenOperations.join(' ').toLowerCase();
assert.ok(fStr.includes('税務') || fStr.includes('tax'),   'forbiddenOperations must include tax judgment');
assert.ok(fStr.includes('法務') || fStr.includes('legal'), 'forbiddenOperations must include legal judgment');
assert.ok(fStr.includes('労務') || fStr.includes('labor'), 'forbiddenOperations must include labor judgment');
console.log('  PASS: forbiddenOperations include tax/legal/labor judgment');

assert.ok(Array.isArray(result.humanApprovalOperations) && result.humanApprovalOperations.length > 0, 'humanApprovalOperations must exist');
console.log('  PASS: humanApprovalOperations exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real send') || d.includes('real contract')), 'must deny real send/contract');
assert.ok(denied.some(d => d.includes('real billing') || d.includes('real legal')), 'must deny real billing/legal');
assert.ok(denied.some(d => d.includes('deploy')), 'must deny deploy');
console.log('  PASS: no real send/contract/billing (dangerousActionsDenied correct)');

console.log('=== dev-agent-backoffice-agent-mvp-launch-plan-pack smoke PASSED ===');
