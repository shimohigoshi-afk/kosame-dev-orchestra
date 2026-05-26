/**
 * Smoke Test: GitHub Actions Record
 * v0.8.2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { recordGhaStatus } = require('../tools/github-actions-record-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: GitHub Actions Record...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/github-actions-record-v0.8.2.md',
    'docs/ai-dev-team/github-actions-status-policy-v0.8.2.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. 記録ロジック確認 (Success)
  const successRecord = recordGhaStatus('verify.yml', '12345', 'completed', 'success', 'http://example.com');
  assert.strictEqual(successRecord.workflow.isSuccess, true);
  assert.strictEqual(successRecord.workflow.isFinal, true);

  // 3. 記録ロジック確認 (Running)
  const runningRecord = recordGhaStatus('verify.yml', '12346', 'in_progress');
  assert.strictEqual(runningRecord.workflow.isSuccess, false);
  assert.strictEqual(runningRecord.workflow.isFinal, false);

  // 4. Fixture 確認
  assert.ok(fs.existsSync(path.resolve('fixtures/github-actions.sample.json')), 'Missing fixture');

  console.log('Smoke Test: GitHub Actions Record PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: GitHub Actions Record FAILED');
  console.error(err);
  process.exit(1);
});
