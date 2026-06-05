'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-product-expansion-roadmap-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-product-expansion-roadmap-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 109, `pkg version must be >= 109.0.0, got ${pkg.version}`);
console.log('  PASS: package version 109.0.0 or later');

assert.ok(pkg.scripts['smoke:product-expansion-roadmap'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-expansion-roadmap'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:product-expansion-roadmap exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-product-expansion-roadmap-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '109.0.0');
console.log('  PASS: tool meta version 109.0.0');

const result = tool.buildProductExpansionRoadmap({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

// 6 products
assert.strictEqual(result.roadmap.length, 6);
assert.strictEqual(result.summary.total, 6);
console.log('  PASS: 6 products in roadmap');

// anesty_board is pilot ready
assert.ok(result.summary.pilotReady.includes('anesty_board'), 'anesty_board must be pilot ready');
console.log('  PASS: anesty_board is pilot ready');

// sales_dx is data sensitive HOLD
assert.ok(result.summary.dataSensitiveHold.includes('sales_dx'), 'sales_dx must be data sensitive HOLD');
console.log('  PASS: sales_dx is data sensitive HOLD');

// kosame_dev_orchestra in pilot ready
assert.ok(result.summary.pilotReady.includes('kosame_dev_orchestra'));
console.log('  PASS: kosame_dev_orchestra in pilot ready');

// PRODUCTS_ROADMAP exists with all 6
const productKeys = Object.keys(tool.PRODUCTS_ROADMAP);
assert.ok(productKeys.includes('anesty_board'));
assert.ok(productKeys.includes('sales_dx'));
assert.ok(productKeys.includes('email_reply_bot'));
assert.ok(productKeys.includes('backoffice_agent'));
assert.ok(productKeys.includes('cloud_run_pm_agent'));
assert.ok(productKeys.includes('kosame_dev_orchestra'));
console.log('  PASS: all 6 products in PRODUCTS_ROADMAP');

// expansion principle
assert.ok(typeof result.expansionPrinciple === 'string' && result.expansionPrinciple.length > 0);
console.log('  PASS: expansionPrinciple exists');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-product-expansion-roadmap-pack smoke PASSED ===');
