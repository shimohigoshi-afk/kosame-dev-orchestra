'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-redaction-test-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-redaction-test-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.3.0', 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. API key in content fails
const r1 = tool.runRedactionTest({ targetProvider: 'deepseek', content: 'api_key=sk-abc123secret', sanitized: false });
assert.strictEqual(r1.redactionPassed, false);
assert.ok(r1.detectedSensitiveTypes.length > 0);
assert.ok(r1.blockedReasons.length > 0);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: API key content fails redaction');

// 4. .env-style line fails
const r2 = tool.runRedactionTest({ targetProvider: 'kimi', content: 'SECRET_KEY=verysecret', sanitized: false });
assert.strictEqual(r2.redactionPassed, false);
console.log('  PASS: .env content fails redaction');

// 5. customer/insurance/health data declared type fails
const r3 = tool.runRedactionTest({
  targetProvider: 'deepseek',
  contentTypes: ['customer_data', 'insurance_data'],
  sanitized: false
});
assert.strictEqual(r3.redactionPassed, false);
assert.ok(r3.detectedSensitiveTypes.includes('customer_data'));
assert.ok(r3.detectedSensitiveTypes.includes('insurance_data'));
console.log('  PASS: customer/insurance data declared type fails');

// 6. safe anonymized architecture question passes for deepseek (with sanitized:true, no denied types)
const r4 = tool.runRedactionTest({
  targetProvider: 'deepseek',
  content: 'How should I structure a retry loop in a Node.js service?',
  contentTypes: ['generic_architecture_question'],
  sanitized: true
});
assert.strictEqual(r4.redactionPassed, true);
console.log('  PASS: safe anonymized architecture question passes');

// 7. DeepSeek finalDecisionAllowed:false always
assert.strictEqual(r1.finalDecisionAllowed, false);
assert.strictEqual(r4.finalDecisionAllowed, false);
console.log('  PASS: DeepSeek finalDecisionAllowed is always false');

// 8. detectedSensitiveTypes present when content has sensitive data
assert.ok(Array.isArray(r1.detectedSensitiveTypes));
assert.ok(r1.detectedSensitiveTypes.length > 0);
console.log('  PASS: detectedSensitiveTypes array populated');

// 9. dryRun / realProductActionsExecuted
assert.strictEqual(r4.dryRun, true);
assert.strictEqual(r4.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-redaction-test-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-redaction-test-pack');
