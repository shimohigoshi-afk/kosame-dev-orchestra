/**
 * Smoke Test: Operator Command Foundation Complete
 * v0.7.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkFoundationReady } = require('../tools/operator-command-foundation-complete-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Command Foundation Complete...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-command-foundation-complete-v0.7.0.md',
    'docs/ai-dev-team/operator-next-25-percent-plan-v0.7.0.md',
    'docs/ai-dev-team/operator-console-implementation-entry-v0.7.0.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Foundation Check 動作確認
  const readiness = checkFoundationReady();
  assert.strictEqual(readiness.version, '0.7.0');
  assert.strictEqual(readiness.completedModules.length, 10);

  console.log('Smoke Test: Operator Command Foundation Complete PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Command Foundation Complete FAILED');
  console.error(err);
  process.exit(1);
});
