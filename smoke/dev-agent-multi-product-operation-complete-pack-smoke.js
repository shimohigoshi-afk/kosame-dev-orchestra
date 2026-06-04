'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-multi-product-operation-complete-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-multi-product-operation-complete-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 60, `pkg version must be >= 60.0.0, got ${pkg.version}`);
console.log('  PASS: package version 60.0.0 or later');

assert.ok(pkg.scripts['smoke:multi-product-operation-complete'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:multi-product-operation-complete'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:multi-product-operation-complete exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-multi-product-operation-complete-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '60.0.0', 'tool version must be 60.0.0');
console.log('  PASS: tool meta version 60.0.0');

const pack = tool.buildMultiProductComplete({});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// v56 portfolioOperationBoard
assert.ok(pack.portfolioOperationBoard && Array.isArray(pack.portfolioOperationBoard.products), 'portfolioOperationBoard must exist');
assert.ok(pack.portfolioOperationBoard.products.length >= 5, 'portfolio board must have 5+ products');
console.log('  PASS: includes v56 portfolioOperationBoard with 5+ products');

// v57 productSpecificBuildFlows
assert.ok(pack.productSpecificBuildFlows && Array.isArray(pack.productSpecificBuildFlows.flows), 'productSpecificBuildFlows must exist');
assert.ok(pack.productSpecificBuildFlows.flows.length >= 5, 'productSpecificBuildFlows must have 5+ flows');
console.log('  PASS: includes v57 productSpecificBuildFlows');

// v58 crossProductRiskRouter
assert.ok(pack.crossProductRiskRouter && pack.crossProductRiskRouter.assignedRoute, 'crossProductRiskRouter must exist');
console.log('  PASS: includes v58 crossProductRiskRouter');

// v59 releaseTrainPlanner
assert.ok(pack.releaseTrainPlanner && pack.releaseTrainPlanner.releaseLanes, 'releaseTrainPlanner must exist');
const lanes = pack.releaseTrainPlanner.releaseLanes;
assert.ok(lanes.hasOwnProperty('now'),             'release train must have now lane');
assert.ok(lanes.hasOwnProperty('next'),            'release train must have next lane');
assert.ok(lanes.hasOwnProperty('hold'),            'release train must have hold lane');
assert.ok(lanes.hasOwnProperty('external_review'), 'release train must have external_review lane');
assert.ok(lanes.hasOwnProperty('production_gate'), 'release train must have production_gate lane');
console.log('  PASS: includes v59 releaseTrainPlanner with now/next/hold/external_review/production_gate lanes');

// humanApprovalPacket exists
assert.ok(pack.humanApprovalPacket && pack.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// externalReviewPolicy exists
assert.ok(pack.externalReviewPolicy && pack.externalReviewPolicy.scope, 'externalReviewPolicy must exist');
console.log('  PASS: externalReviewPolicy exists');

// completeCriteria all present
assert.ok(Array.isArray(pack.completeCriteria) && pack.completeCriteria.length >= 5, 'completeCriteria must have 5+ items');
console.log('  PASS: completeCriteria all present');

// completePackReady true when no blockers
assert.strictEqual(pack.completePackReady, true, 'completePackReady must be true when no blockers');
console.log('  PASS: completePackReady true when no blockers');

// blocked scenario
const blocked = tool.buildMultiProductComplete({ blockers: ['sales_dx data boundary not defined'] });
assert.strictEqual(blocked.completePackReady, false, 'completePackReady must be false when blockers exist');
assert.ok(blocked.blockers.length > 0, 'blockers must be populated');
console.log('  PASS: completePackReady false when blockers present');

// no deploy/secret/customer data side effects
assert.ok(!pack.crossProductRiskRouter.assignedRoute.includes('secret'), 'no secret side effects');
assert.ok(pack.dryRun === true, 'dryRun must always be true');
console.log('  PASS: no deploy/secret/customer data side effects');

// dangerousActionsDenied correct
const denied = pack.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// OPERATING_POLICY_STATEMENTS
assert.ok(Array.isArray(tool.OPERATING_POLICY_STATEMENTS) && tool.OPERATING_POLICY_STATEMENTS.length >= 5, 'OPERATING_POLICY_STATEMENTS must be exported');
assert.ok(tool.OPERATING_POLICY_STATEMENTS.some(p => p.includes('ANESTY Board専用ではない')), 'policy must mention multi-product');
console.log('  PASS: OPERATING_POLICY_STATEMENTS exported with multi-product statement');

// orchestraVersion
assert.ok(pack.orchestraVersion === '60.0.0', 'orchestraVersion must be 60.0.0');
console.log('  PASS: orchestraVersion 60.0.0');

console.log('=== dev-agent-multi-product-operation-complete-pack smoke PASSED ===');
