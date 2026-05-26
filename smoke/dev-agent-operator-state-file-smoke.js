/**
 * Smoke Test: Operator State File
 * v0.7.1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getOperatorState, generateInitialState } = require('../tools/operator-state-file-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator State File...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-state-file-v0.7.1.md',
    'docs/ai-dev-team/operator-state-schema-v0.7.1.md',
    'docs/ai-dev-team/operator-state-update-policy-v0.7.1.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Initial State 生成確認
  const state = generateInitialState('0.7.1');
  assert.strictEqual(state.state.currentVersion, '0.7.1');
  assert.strictEqual(state.state.workflowStatus, 'Idle');
  assert.ok(state.state.updatedAt);

  // 3. Fixture 確認
  const fixturePath = path.resolve('fixtures/operator-state.sample.json');
  assert.ok(fs.existsSync(fixturePath), 'Missing fixture: fixtures/operator-state.sample.json');
  const loadedState = getOperatorState(fixturePath);
  assert.ok(loadedState, 'Failed to load state from fixture');
  assert.strictEqual(loadedState.state.currentVersion, '0.7.1');

  console.log('Smoke Test: Operator State File PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator State File FAILED');
  console.error(err);
  process.exit(1);
});
