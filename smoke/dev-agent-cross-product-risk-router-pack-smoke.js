'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-cross-product-risk-router-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-cross-product-risk-router-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 58, `pkg version must be >= 58.0.0, got ${pkg.version}`);
console.log('  PASS: package version 58.0.0 or later');

assert.ok(pkg.scripts['smoke:cross-product-risk-router'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:cross-product-risk-router'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:cross-product-risk-router exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-cross-product-risk-router-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '58.0.0', 'tool version must be 58.0.0');
console.log('  PASS: tool meta version 58.0.0');

const R = tool.ROUTES;

// docs/smoke only → CLAUDE_CODE
const docsResult = tool.routeRequest({ taskType: 'docs_update' });
assert.strictEqual(docsResult.assignedRoute, R.CLAUDE_CODE, `docs_update must route to CLAUDE_CODE, got ${docsResult.assignedRoute}`);
console.log('  PASS: docs_update routes to CLAUDE_CODE');

const smokeResult = tool.routeRequest({ taskType: 'smoke_addition' });
assert.strictEqual(smokeResult.assignedRoute, R.CLAUDE_CODE, `smoke_addition must route to CLAUDE_CODE, got ${smokeResult.assignedRoute}`);
console.log('  PASS: smoke_addition routes to CLAUDE_CODE');

// long text review → GEMINI_REVIEW
const geminiResult = tool.routeRequest({ taskType: 'long_text_review' });
assert.strictEqual(geminiResult.assignedRoute, R.GEMINI_REVIEW, `long_text_review must route to GEMINI_REVIEW, got ${geminiResult.assignedRoute}`);
console.log('  PASS: long_text_review routes to GEMINI_REVIEW');

// breakthrough proposal → GROK_REVIEW
const grokResult = tool.routeRequest({ taskType: 'breakthrough_proposal' });
assert.strictEqual(grokResult.assignedRoute, R.GROK_REVIEW, `breakthrough_proposal must route to GROK_REVIEW, got ${grokResult.assignedRoute}`);
console.log('  PASS: breakthrough_proposal routes to GROK_REVIEW');

// secret access → HUMAN_APPROVAL or HOLD
const secretResult = tool.routeRequest({ secretAccess: true });
assert.ok([R.HUMAN_APPROVAL, R.HOLD].includes(secretResult.assignedRoute), `secretAccess must route to HUMAN_APPROVAL or HOLD, got ${secretResult.assignedRoute}`);
console.log('  PASS: secretAccess routes to HUMAN_APPROVAL or HOLD');

// deploy required → HUMAN_APPROVAL or EXTERNAL_SE_REVIEW
const deployResult = tool.routeRequest({ deployRequired: true });
assert.ok([R.HUMAN_APPROVAL, R.EXTERNAL_SE_REVIEW].includes(deployResult.assignedRoute), `deployRequired must route to HUMAN_APPROVAL or EXTERNAL_SE_REVIEW, got ${deployResult.assignedRoute}`);
console.log('  PASS: deployRequired routes to HUMAN_APPROVAL or EXTERNAL_SE_REVIEW');

// customer data → HUMAN_APPROVAL
const customerResult = tool.routeRequest({ customerDataAccess: true });
assert.ok([R.HUMAN_APPROVAL, R.KOSAME_PM, R.HOLD].includes(customerResult.assignedRoute), `customerDataAccess must route to HUMAN_APPROVAL/KOSAME_PM/HOLD, got ${customerResult.assignedRoute}`);
assert.ok(customerResult.requiredApprovals && customerResult.requiredApprovals.some(a => a.includes('Junya') || a.includes('Human')), 'customerDataAccess must require Human approval');
console.log('  PASS: customerDataAccess requires Human approval');

// insurance data → HUMAN_APPROVAL + possible EXTERNAL_SE_REVIEW
const insuranceResult = tool.routeRequest({ insuranceDataAccess: true });
assert.ok([R.HUMAN_APPROVAL, R.EXTERNAL_SE_REVIEW, R.KOSAME_PM, R.HOLD].includes(insuranceResult.assignedRoute), `insuranceDataAccess must route to gate, got ${insuranceResult.assignedRoute}`);
assert.ok(insuranceResult.requiredApprovals && insuranceResult.requiredApprovals.length > 0, 'insuranceDataAccess must require approvals');
console.log('  PASS: insuranceDataAccess requires HUMAN_APPROVAL and possible EXTERNAL_SE_REVIEW');

// low confidence + high risk → HOLD
const holdResult = tool.routeRequest({ confidence: 'low', dataSensitivity: 'critical' });
assert.ok([R.HOLD, R.HUMAN_APPROVAL].includes(holdResult.assignedRoute), `low confidence + critical risk must route to HOLD/HUMAN_APPROVAL, got ${holdResult.assignedRoute}`);
console.log('  PASS: low confidence + high risk routes to HOLD');

// dryRun and humanApprovalRequired
const full = tool.buildRiskRouter({ request: { taskType: 'docs_update' } });
assert.strictEqual(full.dryRun, true, 'dryRun must be true');
assert.strictEqual(full.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: dryRun true / humanApprovalRequired true');

// dangerousActionsDenied correct
const denied = full.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
console.log('  PASS: dangerousActionsDenied correct');

// ROUTES constants exported
assert.ok(R.CLAUDE_CODE && R.GEMINI_REVIEW && R.GROK_REVIEW && R.HUMAN_APPROVAL && R.EXTERNAL_SE_REVIEW && R.HOLD, 'all ROUTES must be exported');
console.log('  PASS: ROUTES constants exported');

console.log('=== dev-agent-cross-product-risk-router-pack smoke PASSED ===');
