'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-product-feedback-capture-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-product-feedback-capture-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 103, `pkg version must be >= 103.0.0, got ${pkg.version}`);
console.log('  PASS: package version 103.0.0 or later');

assert.ok(pkg.scripts['smoke:product-feedback-capture'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-feedback-capture'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:product-feedback-capture exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-product-feedback-capture-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '103.0.0');
console.log('  PASS: tool meta version 103.0.0');

const result = tool.buildProductFeedbackCapture({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

// feedbackItems sanitized
assert.ok(Array.isArray(result.feedbackItems) && result.feedbackItems.length > 0);
assert.ok(result.feedbackItems.every(i => i.dataFromRealCustomers === false));
console.log('  PASS: all feedback items have dataFromRealCustomers false');

assert.ok(result.feedbackItems.every(i => i.sanitized === true));
console.log('  PASS: all feedback items marked sanitized');

// summary
assert.ok(result.summary && typeof result.summary.totalItems === 'number');
assert.ok(Array.isArray(result.summary.pmfSignals));
assert.ok(Array.isArray(result.summary.revenueSignals));
console.log('  PASS: summary with pmfSignals and revenueSignals');

// dataPolicy
assert.strictEqual(result.dataPolicy.realCustomerDataAllowed, false);
assert.strictEqual(result.dataPolicy.realGmailDataAllowed, false);
assert.strictEqual(result.dataPolicy.realInsuranceDataAllowed, false);
console.log('  PASS: dataPolicy denies all real customer/Gmail/insurance data');

// categories
assert.ok(Array.isArray(result.feedbackCategories) && result.feedbackCategories.length > 0);
assert.ok(result.feedbackCategories.includes('pmf_signal'));
assert.ok(result.feedbackCategories.includes('revenue_signal'));
console.log('  PASS: feedbackCategories includes pmf_signal and revenue_signal');

// multiple feedback items
const multi = tool.buildProductFeedbackCapture({
  feedbackItems: [
    { product: 'anesty_board', category: 'usability', severity: 'high', description: 'test', revisionSuggestion: 'fix' },
    { product: 'email_reply_bot', category: 'reliability', severity: 'medium', description: 'test2', revisionSuggestion: 'fix2' }
  ]
});
assert.strictEqual(multi.summary.totalItems, 2);
console.log('  PASS: multiple feedback items captured correctly');

console.log('=== dev-agent-product-feedback-capture-pack smoke PASSED ===');
