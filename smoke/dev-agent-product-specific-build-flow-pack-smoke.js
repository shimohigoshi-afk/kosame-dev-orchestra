'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-product-specific-build-flow-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-product-specific-build-flow-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 57, `pkg version must be >= 57.0.0, got ${pkg.version}`);
console.log('  PASS: package version 57.0.0 or later');

assert.ok(pkg.scripts['smoke:product-specific-build-flow'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-specific-build-flow'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:product-specific-build-flow exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-product-specific-build-flow-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '57.0.0', 'tool version must be 57.0.0');
console.log('  PASS: tool meta version 57.0.0');

const result = tool.buildProductSpecificFlows({});

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// all required productType flows present
const flowTypes = result.flows.map(f => f.productType);
const required  = ['discord_ai_board', 'sales_dx_pipeline', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent', 'dev_orchestra_core'];
for (const pt of required) {
  assert.ok(flowTypes.includes(pt), `productType ${pt} must be present`);
}
console.log('  PASS: productType flows include discord_ai_board/sales_dx_pipeline/backoffice_agent/email_reply_bot/cloud_run_pm_agent/dev_orchestra_core');

// each flow has required fields
const reqFields = ['allowedTaskTypes', 'forbiddenTaskTypes', 'recommendedAgents', 'verificationCommands', 'acceptanceCriteria'];
for (const flow of result.flows) {
  for (const f of reqFields) {
    assert.ok(flow[f] !== undefined, `${flow.productType}: flow must have field: ${f}`);
    assert.ok(Array.isArray(flow[f]) && flow[f].length > 0, `${flow.productType}.${f} must be non-empty array`);
  }
  assert.ok(typeof flow.humanApprovalRequired === 'boolean', `${flow.productType}: humanApprovalRequired must exist`);
}
console.log('  PASS: each flow has allowedTaskTypes/forbiddenTaskTypes/recommendedAgents/verificationCommands/acceptanceCriteria');

// externalReviewTriggers exist
for (const flow of result.flows) {
  assert.ok(Array.isArray(flow.externalReviewTriggers) && flow.externalReviewTriggers.length > 0, `${flow.productType}: externalReviewTriggers must exist`);
}
console.log('  PASS: externalReviewTriggers exist');

// productionGateRequired is true for risky types
const riskyTypes = ['discord_ai_board', 'sales_dx_pipeline', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];
for (const pt of riskyTypes) {
  const flow = tool.getFlow(pt);
  assert.ok(flow && flow.productionGateRequired === true, `${pt}: productionGateRequired must be true`);
}
console.log('  PASS: productionGateRequired correct for risky types');

// forbiddenCommands include core prohibited items
for (const flow of result.flows) {
  const fc = flow.forbiddenCommands || [];
  assert.ok(fc.some(c => c.includes('git push')), `${flow.productType}: forbiddenCommands must include git push`);
  assert.ok(fc.some(c => c.includes('deploy')),   `${flow.productType}: forbiddenCommands must include deploy`);
  assert.ok(fc.some(c => c.includes('rm -rf')),   `${flow.productType}: forbiddenCommands must include rm -rf`);
}
console.log('  PASS: forbiddenCommands include git push/deploy/rm -rf');

// dangerousActionsDenied correct
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

// getFlow returns null for unknown
assert.strictEqual(tool.getFlow('unknown_type'), null, 'getFlow must return null for unknown type');
console.log('  PASS: getFlow returns null for unknown productType');

console.log('=== dev-agent-product-specific-build-flow-pack smoke PASSED ===');
