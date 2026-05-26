/**
 * Smoke Test: Operator Approval Board
 * v0.7.5
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { categorizeApprovals } = require('../tools/operator-approval-board-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Approval Board...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-approval-board-v0.7.5.md',
    'docs/ai-dev-team/operator-approval-decision-types-v0.7.5.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. 分類ロジック確認
  const approvals = ['Update package.json version', 'Add new tool'];
  
  const lowRiskResults = categorizeApprovals(approvals, 'Low');
  assert.strictEqual(lowRiskResults[0].recommendation, 'approve');

  const highRiskResults = categorizeApprovals(approvals, 'High');
  assert.strictEqual(highRiskResults[0].recommendation, 'send_to_claude');

  const criticalRiskResults = categorizeApprovals(approvals, 'Critical');
  assert.strictEqual(criticalRiskResults[0].recommendation, 'reject');

  console.log('Smoke Test: Operator Approval Board PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Approval Board FAILED');
  console.error(err);
  process.exit(1);
});
