'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-multi-product-progress-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-multi-product-progress-board-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 79, `pkg version must be >= 79.0.0, got ${pkg.version}`);
console.log('  PASS: package version 79.0.0 or later');

assert.ok(pkg.scripts['smoke:multi-product-progress-board'],   'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:multi-product-progress-board'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:multi-product-progress-board exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-multi-product-progress-board-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '79.0.0');
console.log('  PASS: tool meta version 79.0.0');

const result = tool.buildMultiProductProgressBoard({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// products[] has 5+ products
assert.ok(Array.isArray(result.products) && result.products.length >= 5, 'products[] must have 5+ products');
console.log('  PASS: products[] has 5+ products');

// includes required product IDs
const productIds = result.products.map(p => p.productId);
assert.ok(productIds.includes('anesty_board'),        'must include anesty_board');
assert.ok(productIds.includes('sales_dx'),            'must include sales_dx');
assert.ok(productIds.includes('backoffice_agent'),    'must include backoffice_agent');
assert.ok(productIds.includes('email_reply_bot'),     'must include email_reply_bot');
assert.ok(productIds.includes('cloud_run_pm_agent'),  'must include cloud_run_pm_agent');
assert.ok(productIds.includes('kosame_dev_orchestra'),'must include kosame_dev_orchestra');
console.log('  PASS: includes anesty_board/sales_dx/backoffice_agent/email_reply_bot/cloud_run_pm_agent/kosame_dev_orchestra');

// each product has required fields
for (const p of result.products) {
  assert.ok(p.productId && p.productName && p.currentPhase && p.status && p.nextAction && p.assignedAgent,
    `product ${p.productId} must have required fields`);
  assert.ok(typeof p.humanYesRequired === 'boolean', `product ${p.productId} must have humanYesRequired`);
}
console.log('  PASS: each product has required fields');

// all 6 lanes exist
assert.ok(Array.isArray(result.nowLane),          'nowLane must exist');
assert.ok(Array.isArray(result.nextLane),         'nextLane must exist');
assert.ok(Array.isArray(result.holdLane),         'holdLane must exist');
assert.ok(Array.isArray(result.guardianLane),     'guardianLane must exist');
assert.ok(Array.isArray(result.revenueLane),      'revenueLane must exist');
assert.ok(Array.isArray(result.externalReviewLane), 'externalReviewLane must exist');
console.log('  PASS: now/next/hold/guardian/revenue/externalReview lanes exist');

// no real repo read — repoPathNote
assert.ok(result.repoPathNote && result.repoPathNote.includes('string reference only'), 'repoPathNote must mention no real repo read');
console.log('  PASS: no real repo read (repoPathNote confirms string reference only)');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real external repo')), 'must deny real external repo read');
assert.ok(denied.some(d => d.includes('real repo mutation')), 'must deny real repo mutation');
assert.ok(denied.some(d => d.includes('secret read')),        'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-multi-product-progress-board-pack smoke PASSED ===');
