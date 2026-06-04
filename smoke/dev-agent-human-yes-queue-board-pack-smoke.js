'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-human-yes-queue-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-human-yes-queue-board-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 78, `pkg version must be >= 78.0.0, got ${pkg.version}`);
console.log('  PASS: package version 78.0.0 or later');

assert.ok(pkg.scripts['smoke:human-yes-queue-board'],   'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:human-yes-queue-board'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:human-yes-queue-board exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-human-yes-queue-board-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '78.0.0');
console.log('  PASS: tool meta version 78.0.0');

const result = tool.buildHumanYesQueueBoard({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// pendingApprovals exist
assert.ok(Array.isArray(result.pendingApprovals) && result.pendingApprovals.length >= 5, 'pendingApprovals must have 5+ items');
console.log('  PASS: pendingApprovals exists');

// pendingApprovals include required categories
const titles = result.pendingApprovals.map(a => a.title.toLowerCase());
assert.ok(titles.some(t => t.includes('commit') || t.includes('push') || t.includes('tag')), 'must include commit/push/tag');
assert.ok(titles.some(t => t.includes('deploy')),          'must include deploy');
assert.ok(titles.some(t => t.includes('secret') || t.includes('.env') || t.includes('api key')), 'must include secret/.env/API key');
assert.ok(titles.some(t => t.includes('gmail') || t.includes('email') || t.includes('メール')), 'must include gmail/email');
assert.ok(titles.some(t => t.includes('customer') || t.includes('顧客') || t.includes('個人')), 'must include customer data');
assert.ok(titles.some(t => t.includes('external') || t.includes('外部se') || t.includes('外部')), 'must include external review');
assert.ok(titles.some(t => t.includes('contract') || t.includes('billing') || t.includes('契約') || t.includes('請求')), 'must include contract/billing');
console.log('  PASS: pendingApprovals includes commit/push/tag/deploy/secret/gmail/customer data/external review/contract');

// autoProceedAllowed false
assert.strictEqual(result.autoProceedAllowed, false, 'autoProceedAllowed must be false');
console.log('  PASS: autoProceedAllowed false');

// allowedDecisionOptions include YES/NO/HOLD
assert.ok(result.decisionOptions.includes('YES'),  'must include YES');
assert.ok(result.decisionOptions.includes('NO'),   'must include NO');
assert.ok(result.decisionOptions.includes('HOLD'), 'must include HOLD');
console.log('  PASS: decisionOptions include YES/NO/HOLD');

// each approval has allowedDecisionOptions
for (const a of result.pendingApprovals) {
  assert.ok(Array.isArray(a.allowedDecisionOptions) && a.allowedDecisionOptions.length >= 3,
    `approval ${a.approvalId} must have allowedDecisionOptions`);
}
console.log('  PASS: each approval has allowedDecisionOptions');

assert.ok(result.approvalSummary && typeof result.approvalSummary.total === 'number', 'approvalSummary must exist');
console.log('  PASS: approvalSummary exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real email send')),    'must deny real email send');
assert.ok(denied.some(d => d.includes('real payment')),       'must deny real payment');
assert.ok(denied.some(d => d.includes('real contract')),      'must deny real contract');
assert.ok(denied.some(d => d.includes('real Gmail send')),    'must deny real Gmail send');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-human-yes-queue-board-pack smoke PASSED ===');
