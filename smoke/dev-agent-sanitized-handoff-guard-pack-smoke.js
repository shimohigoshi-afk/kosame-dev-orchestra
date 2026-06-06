'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-sanitized-handoff-guard-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-sanitized-handoff-guard-pack smoke ===');

// version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.1.0'), 'package version must be 110.1.0 or later');
console.log('  PASS: package version');

// script exists
assert.ok(pkg.scripts['smoke:sanitized-handoff-guard-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-sanitized-handoff-guard-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// TOOL_META
assert.strictEqual(tool.TOOL_META.version, '110.1.0');
console.log('  PASS: tool meta version');

// deepseek + sanitized:false = BLOCKED
const r1 = tool.evaluateHandoff({ targetProvider: 'deepseek', sanitized: false, contentTypes: [] });
assert.strictEqual(r1.blocked, true);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
assert.strictEqual(r1.dangerousActionsDenied, true);
assert.strictEqual(r1.finalDecisionAllowed, false);
assert.strictEqual(r1.humanApprovalRequired, true);
assert.ok(r1.blockedReasons.length > 0);
console.log('  PASS: deepseek + sanitized:false → blocked');

// kimi + sanitized:false = BLOCKED
const r2 = tool.evaluateHandoff({ targetProvider: 'kimi', sanitized: false, contentTypes: [] });
assert.strictEqual(r2.blocked, true);
console.log('  PASS: kimi + sanitized:false → blocked');

// deepseek + sanitized:true but denied content type = BLOCKED
const r3 = tool.evaluateHandoff({ targetProvider: 'deepseek', sanitized: true, contentTypes: ['apiKey'] });
assert.strictEqual(r3.blocked, true);
assert.ok(r3.blockedReasons.some(reason => reason.includes('apiKey')));
console.log('  PASS: deepseek + apiKey content type → blocked');

// deepseek + sanitized:true + allowed content only = NOT blocked
const r4 = tool.evaluateHandoff({
  targetProvider: 'deepseek',
  sanitized: true,
  contentTypes: ['abstractedErrorSummary', 'anonymizedCodeSnippet']
});
assert.strictEqual(r4.blocked, false);
assert.strictEqual(r4.finalDecisionAllowed, false);  // still cannot make final decisions
assert.strictEqual(r4.humanApprovalRequired, true);
console.log('  PASS: deepseek + sanitized + safe content → not blocked but finalDecisionAllowed:false');

// gpt (non-risk provider) + sanitized:false = NOT blocked
const r5 = tool.evaluateHandoff({ targetProvider: 'gpt', sanitized: false, contentTypes: ['customerData'] });
assert.strictEqual(r5.blocked, false);
assert.strictEqual(r5.humanApprovalRequired, false);
console.log('  PASS: gpt (non-risk provider) not blocked by handoff guard');

// redactedFields and allowedContentTypes are present
assert.ok(Array.isArray(r1.redactedFields) && r1.redactedFields.length > 0);
assert.ok(Array.isArray(r1.allowedContentTypes) && r1.allowedContentTypes.length > 0);
assert.ok(Array.isArray(r1.deniedContentTypes) && r1.deniedContentTypes.length > 0);
console.log('  PASS: redactedFields, allowedContentTypes, deniedContentTypes present');

// denied content type for insurance and health data
const r6 = tool.evaluateHandoff({
  targetProvider: 'deepseek',
  sanitized: true,
  contentTypes: ['insuranceData', 'healthData']
});
assert.strictEqual(r6.blocked, true);
console.log('  PASS: insuranceData and healthData blocked for deepseek');

console.log('PASS: dev-agent-sanitized-handoff-guard-pack');
