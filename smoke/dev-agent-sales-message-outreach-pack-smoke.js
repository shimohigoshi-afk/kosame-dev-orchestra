'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-sales-message-outreach-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-sales-message-outreach-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 73, `pkg version must be >= 73.0.0, got ${pkg.version}`);
console.log('  PASS: package version 73.0.0 or later');

assert.ok(pkg.scripts['smoke:sales-message-outreach'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:sales-message-outreach'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:sales-message-outreach exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-sales-message-outreach-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '73.0.0', 'tool version must be 73.0.0');
console.log('  PASS: tool meta version 73.0.0');

const result = tool.buildSalesMessageOutreach({ productIdea: 'AI議事録自動化ツール' });

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.salesMessages) && result.salesMessages.length >= 2, 'salesMessages must have 2+ items');
for (const m of result.salesMessages) {
  assert.ok(m.messageId && m.channel && m.bodyTemplate, `message ${m.messageId} must have required fields`);
  assert.strictEqual(m.dryRunOnly, true,        `message ${m.messageId} dryRunOnly must be true`);
  assert.strictEqual(m.realSendExecuted, false, `message ${m.messageId} realSendExecuted must be false`);
}
console.log('  PASS: salesMessages[] has 2+ items (dryRunOnly=true, realSendExecuted=false)');

assert.ok(Array.isArray(result.outreachSequence) && result.outreachSequence.length >= 4, 'outreachSequence must have 4+ steps');
const humanSteps = result.outreachSequence.filter(s => s.humanRequired === true);
assert.ok(humanSteps.length >= 2, 'outreachSequence must have 2+ human-required steps');
console.log('  PASS: outreachSequence has 4+ steps including human-required steps');

assert.ok(result.personalization, 'personalization must exist');
assert.ok(Array.isArray(result.safetyNotes) && result.safetyNotes.length > 0, 'safetyNotes must exist');
assert.ok(result.safetyNotes.some(n => n.includes('人間承認') || n.includes('human')), 'safetyNotes must mention human approval');
console.log('  PASS: personalization and safetyNotes exist');

assert.strictEqual(result.realOutreachExecuted, false, 'realOutreachExecuted must be false');
console.log('  PASS: realOutreachExecuted false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real email send')),    'must deny real email send');
assert.ok(denied.some(d => d.includes('real SNS post')),      'must deny real SNS post');
assert.ok(denied.some(d => d.includes('real customer contact')), 'must deny real customer contact');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-sales-message-outreach-pack smoke PASSED ===');
