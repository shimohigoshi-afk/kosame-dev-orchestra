/**
 * Smoke Test: Operator Session Record
 * v0.6.1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { OperatorSessionRecord } = require('../tools/operator-session-record-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Session Record...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-session-record-v0.6.1.md',
    'docs/ai-dev-team/session-handoff-template-v0.6.1.md',
    'docs/ai-dev-team/session-completion-record-v0.6.1.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Session Record 動作確認
  const sr = new OperatorSessionRecord();
  sr.startSession({ currentVersion: '0.5.0' });
  sr.addTaskResult('v0.5.1', 'completed');
  sr.addTaskResult('v0.5.2', 'completed');
  const record = sr.completeSession('Implement v0.7.0');

  assert.ok(record.sessionId.startsWith('SES-'));
  assert.strictEqual(record.completedTasks.length, 2);
  assert.strictEqual(record.nextAction, 'Implement v0.7.0');

  console.log('Smoke Test: Operator Session Record PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Session Record FAILED');
  console.error(err);
  process.exit(1);
});
