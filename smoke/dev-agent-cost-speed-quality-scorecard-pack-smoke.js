'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-cost-speed-quality-scorecard-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-cost-speed-quality-scorecard-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 108, `pkg version must be >= 108.0.0, got ${pkg.version}`);
console.log('  PASS: package version 108.0.0 or later');

assert.ok(pkg.scripts['smoke:cost-speed-quality-scorecard'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:cost-speed-quality-scorecard'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:cost-speed-quality-scorecard exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-cost-speed-quality-scorecard-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '108.0.0');
console.log('  PASS: tool meta version 108.0.0');

const result = tool.buildCostSpeedQualityScorecard({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

// 6 routes
assert.strictEqual(result.routes.length, 6);
console.log('  PASS: 6 routes defined');

// all route names present
const routeNames = result.routes.map(r => r.route);
assert.ok(routeNames.includes('ClaudeCode_implementation'));
assert.ok(routeNames.includes('GPTAgent_PM'));
assert.ok(routeNames.includes('Gemini_bulk'));
assert.ok(routeNames.includes('Grok_adversarial'));
assert.ok(routeNames.includes('LightweightModel'));
assert.ok(routeNames.includes('Human_approval_only'));
console.log('  PASS: all 6 route types present');

// Human_approval_only is for irreversible
const humanRoute = result.routes.find(r => r.route === 'Human_approval_only');
assert.ok(humanRoute.bestFor.includes('irreversible'));
console.log('  PASS: Human_approval_only route is for irreversible actions');

// operating principle
assert.ok(typeof result.operatingPrinciple === 'string' && result.operatingPrinciple.includes('irreversible'));
console.log('  PASS: operatingPrinciple exists and mentions irreversible');

// scoredRoutes
assert.strictEqual(result.scoredRoutes.length, 6);
assert.ok(result.recommendedRoute, 'recommendedRoute must exist');
console.log('  PASS: scoredRoutes and recommendedRoute exist');

// routingGuidance
assert.ok(result.routingGuidance.defaultImplementation === 'ClaudeCode_implementation');
assert.ok(result.routingGuidance.irreversibleActions === 'Human_approval_only');
console.log('  PASS: routingGuidance correct');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-cost-speed-quality-scorecard-pack smoke PASSED ===');
