'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-product-portfolio-operation-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-product-portfolio-operation-board-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 56, `pkg version must be >= 56.0.0, got ${pkg.version}`);
console.log('  PASS: package version 56.0.0 or later');

assert.ok(pkg.scripts['smoke:product-portfolio-operation-board'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-portfolio-operation-board'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:product-portfolio-operation-board exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-product-portfolio-operation-board-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '56.0.0', 'tool version must be 56.0.0');
console.log('  PASS: tool meta version 56.0.0');

const board = tool.buildPortfolioBoard({});

assert.strictEqual(board.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(board.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// products[] has 5+ products
assert.ok(Array.isArray(board.products) && board.products.length >= 5, 'products[] must have 5+ products');
console.log('  PASS: products[] has 5+ products');

// includes required product IDs
const productIds = board.products.map(p => p.productId);
assert.ok(productIds.includes('anesty_board'),        'must include anesty_board');
assert.ok(productIds.includes('sales_dx'),            'must include sales_dx');
assert.ok(productIds.includes('backoffice_agent'),    'must include backoffice_agent');
assert.ok(productIds.includes('email_reply_bot'),     'must include email_reply_bot');
assert.ok(productIds.includes('cloud_run_pm_agent'),  'must include cloud_run_pm_agent');
assert.ok(productIds.includes('kosame_dev_orchestra'),'must include kosame_dev_orchestra');
console.log('  PASS: includes anesty_board/sales_dx/backoffice_agent/email_reply_bot/cloud_run_pm_agent/kosame_dev_orchestra');

// each product has required fields
for (const p of board.products) {
  assert.ok(p.readinessStatus, `${p.productId}: readinessStatus must exist`);
  assert.ok(p.nextAction,      `${p.productId}: nextAction must exist`);
  assert.ok(p.recommendedAgent, `${p.productId}: recommendedAgent must exist`);
  assert.ok(p.dangerGates,     `${p.productId}: dangerGates must exist`);
  assert.ok(p.humanApprovalRequired === true, `${p.productId}: humanApprovalRequired must be true`);
}
console.log('  PASS: each product has readinessStatus/nextAction/recommendedAgent/dangerGates');

// blockedProducts and readyProducts exist
assert.ok(Array.isArray(board.blockedProducts), 'blockedProducts must exist');
assert.ok(Array.isArray(board.readyProducts),   'readyProducts must exist');
console.log('  PASS: blockedProducts and readyProducts exist');

// globalSummary exists
assert.ok(board.globalSummary && board.globalSummary.totalProducts >= 5, 'globalSummary.totalProducts must be 5+');
console.log('  PASS: globalSummary exists');

// no real repo read — repoPath is only a string, not accessed
for (const p of board.products) {
  assert.ok(typeof p.repoPath === 'string', `${p.productId}: repoPath must be a string (not accessed)`);
}
console.log('  PASS: no real repo read (repoPath is string reference only)');

// dangerousActionsDenied correct
const denied = board.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-product-portfolio-operation-board-pack smoke PASSED ===');
