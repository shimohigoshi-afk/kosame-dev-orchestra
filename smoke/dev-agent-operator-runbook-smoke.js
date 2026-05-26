/**
 * Smoke Test: Operator Runbook
 * v0.6.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { OperatorRunbook } = require('../tools/operator-runbook-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Runbook...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-runbook-v0.6.0.md',
    'docs/ai-dev-team/operator-daily-flow-v0.6.0.md',
    'docs/ai-dev-team/operator-error-recovery-flow-v0.6.0.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Runbook 動作確認
  const rb = new OperatorRunbook();
  rb.start('RB-001', 'Morning Check');
  rb.completeStep('Check GitHub Actions');
  rb.completeStep('Check Logs');
  const report = rb.finish();

  assert.strictEqual(report.runbookId, 'RB-001');
  assert.strictEqual(report.stepsCompleted.length, 2);
  assert.ok(report.finishedAt);

  console.log('Smoke Test: Operator Runbook PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Runbook FAILED');
  console.error(err);
  process.exit(1);
});
