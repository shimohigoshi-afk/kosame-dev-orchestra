/**
 * Smoke Test: Operator Console MVP Foundation Complete
 * v1.0.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkMvpFoundationStatus } = require('../tools/operator-console-mvp-foundation-complete-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Console MVP Foundation Complete...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-console-mvp-foundation-complete-v1.0.0.md',
    'docs/ai-dev-team/operator-console-next-implementation-plan-v1.0.0.md',
    'docs/ai-dev-team/operator-console-v1-release-record-v1.0.0.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Foundation Status 確認
  const status = checkMvpFoundationStatus();
  assert.strictEqual(status.version, '1.0.0');
  assert.strictEqual(status.status, 'Foundation Complete');
  assert.strictEqual(status.modulesCount, 11);
  assert.strictEqual(status.readyForV1_1, true);

  console.log('Smoke Test: Operator Console MVP Foundation Complete PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Console MVP Foundation Complete FAILED');
  console.error(err);
  process.exit(1);
});
