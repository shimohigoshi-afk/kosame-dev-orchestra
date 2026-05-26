/**
 * Smoke Test: Verify Result Record
 * v0.8.1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { recordVerifyResult } = require('../tools/verify-result-record-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Verify Result Record...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/verify-result-record-v0.8.1.md',
    'docs/ai-dev-team/verify-result-history-policy-v0.8.1.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. 記録ロジック確認 (Pass)
  const passResult = recordVerifyResult('pass');
  assert.strictEqual(passResult.result.status, 'pass');
  assert.strictEqual(passResult.result.commitAllowed, true);
  assert.strictEqual(passResult.result.nextRepairOwner, 'None');

  // 3. 記録ロジック確認 (Fail)
  const failResult = recordVerifyResult('fail', ['smoke/test-a.js'], 'Assertion failed');
  assert.strictEqual(failResult.result.status, 'fail');
  assert.strictEqual(failResult.result.commitAllowed, false);
  assert.strictEqual(failResult.result.nextRepairOwner, 'Claude');
  assert.strictEqual(failResult.result.failedSmokeTests.length, 1);

  // 4. Fixture 確認
  assert.ok(fs.existsSync(path.resolve('fixtures/verify-result.sample.json')), 'Missing fixture');

  console.log('Smoke Test: Verify Result Record PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Verify Result Record FAILED');
  console.error(err);
  process.exit(1);
});
