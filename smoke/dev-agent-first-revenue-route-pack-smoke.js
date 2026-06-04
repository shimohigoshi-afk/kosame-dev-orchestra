'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-first-revenue-route-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-first-revenue-route-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 71, `pkg version must be >= 71.0.0, got ${pkg.version}`);
console.log('  PASS: package version 71.0.0 or later');

assert.ok(pkg.scripts['smoke:first-revenue-route'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-revenue-route'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:first-revenue-route exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-first-revenue-route-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '71.0.0', 'tool version must be 71.0.0');
console.log('  PASS: tool meta version 71.0.0');

const result = tool.buildFirstRevenueRoute({ productIdea: 'AI議事録自動化ツール', targetCustomer: '中小企業の営業チーム' });

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.revenueModel,       'revenueModel must exist');
assert.ok(result.pricingHypothesis,  'pricingHypothesis must exist');
assert.ok(result.acquisitionChannel, 'acquisitionChannel must exist');
assert.ok(Array.isArray(result.conversionPath) && result.conversionPath.length >= 3, 'conversionPath must have 3+ steps');
console.log('  PASS: revenueModel/pricingHypothesis/acquisitionChannel/conversionPath exist');

assert.ok(result.firstRevenueTarget, 'firstRevenueTarget must exist');
assert.ok(result.firstRevenueTarget.target, 'firstRevenueTarget.target must exist');
console.log('  PASS: firstRevenueTarget exists');

assert.ok(Array.isArray(result.revenueBlockers) && result.revenueBlockers.length > 0, 'revenueBlockers must exist');
assert.ok(result.revenueBlockers.some(b => b.includes('Guardian')), 'revenueBlockers must mention Guardian Class');
console.log('  PASS: revenueBlockers includes Guardian Class requirement');

assert.strictEqual(result.realRevenueActions, false, 'realRevenueActions must be false');
console.log('  PASS: realRevenueActions false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real payment')),  'must deny real payment');
assert.ok(denied.some(d => d.includes('real contract')), 'must deny real contract');
assert.ok(denied.some(d => d.includes('deploy')),        'must deny deploy');
console.log('  PASS: dangerousActionsDenied correct');

assert.ok(Array.isArray(tool.ACQUISITION_CHANNELS) && tool.ACQUISITION_CHANNELS.length >= 5, 'ACQUISITION_CHANNELS must be exported');
console.log('  PASS: ACQUISITION_CHANNELS exported');

console.log('=== dev-agent-first-revenue-route-pack smoke PASSED ===');
