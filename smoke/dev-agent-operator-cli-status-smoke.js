/**
 * Smoke Test: Operator CLI Status
 * v0.7.3
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getStatusSummary, getNextActionSummary } = require('../tools/operator-cli-status');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator CLI Status...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-cli-status-v0.7.3.md',
    'docs/ai-dev-team/operator-cli-command-map-v0.7.3.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Summary 出力確認
  const mockState = {
    state: {
      currentVersion: '0.7.3',
      workflowStatus: 'Idle',
      activeAgent: 'None',
      riskLevel: 'Low',
      pendingApproval: [],
      nextAction: 'Prepare handoff',
      updatedAt: '2026-05-26T12:00:00Z'
    }
  };

  const summary = getStatusSummary(mockState);
  assert.ok(summary.includes('[STATUS]   : Idle'));
  assert.ok(summary.includes('[NEXT]     : Prepare handoff'));

  const nextAction = getNextActionSummary(mockState);
  assert.strictEqual(nextAction, 'Next Action: Prepare handoff');

  console.log('Smoke Test: Operator CLI Status PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator CLI Status FAILED');
  console.error(err);
  process.exit(1);
});
