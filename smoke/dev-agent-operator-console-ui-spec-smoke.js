/**
 * Smoke Test: Operator Console UI Spec
 * v0.9.1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getUiMetadata } = require('../tools/operator-console-ui-spec-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Console UI Spec...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-console-ui-spec-v0.9.1.md',
    'docs/ai-dev-team/operator-console-screen-layout-v0.9.1.md',
    'docs/ai-dev-team/operator-console-user-flow-v0.9.1.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Metadata 取得確認
  const metadata = getUiMetadata();
  assert.strictEqual(metadata.theme, 'Dark');
  assert.ok(metadata.screens.includes('Dashboard'));

  console.log('Smoke Test: Operator Console UI Spec PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Console UI Spec FAILED');
  console.error(err);
  process.exit(1);
});
