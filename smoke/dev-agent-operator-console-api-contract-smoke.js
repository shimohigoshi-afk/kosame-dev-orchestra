/**
 * Smoke Test: Operator Console API Contract
 * v0.9.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateApiContract } = require('../tools/operator-console-api-contract-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Console API Contract...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-console-api-contract-v0.9.0.md',
    'docs/ai-dev-team/operator-console-endpoints-v0.9.0.md',
    'docs/ai-dev-team/operator-console-security-boundary-v0.9.0.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. 契約バリデーション確認
  const validData = { workflowStatus: 'Idle', currentVersion: '0.9.0', riskLevel: 'Low' };
  const validation = validateApiContract('/operator/status', validData);
  assert.strictEqual(validation.valid, true);

  const invalidData = { status: 'Idle' };
  const invalidValidation = validateApiContract('/operator/status', invalidData);
  assert.strictEqual(invalidValidation.valid, false);
  assert.ok(invalidValidation.missingFields.includes('workflowStatus'));

  console.log('Smoke Test: Operator Console API Contract PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Console API Contract FAILED');
  console.error(err);
  process.exit(1);
});
