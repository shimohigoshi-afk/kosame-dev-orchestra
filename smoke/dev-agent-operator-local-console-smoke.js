/**
 * Smoke Test: Operator Local Console MVP
 * v0.8.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runLocalConsole } = require('../tools/operator-local-console-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Local Console MVP...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-local-console-mvp-v0.8.0.md',
    'docs/ai-dev-team/operator-local-console-flow-v0.8.0.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. 統合動作確認
  const mockState = {
    state: {
      currentVersion: '0.8.0',
      workflowStatus: 'Idle',
      activeAgent: 'None',
      riskLevel: 'Low',
      pendingApproval: ['Test approval item'],
      nextAction: 'Finalize Phase 3',
      updatedAt: new Date().toISOString()
    }
  };

  const consoleResult = runLocalConsole(mockState);
  assert.ok(consoleResult.summary.includes('[STATUS]   : Idle'));
  assert.ok(consoleResult.dashboard.cards.length >= 4);
  assert.strictEqual(consoleResult.approvals.length, 1);
  assert.ok(consoleResult.handoff.includes('# Operator Handoff - 0.8.0'));

  console.log('Smoke Test: Operator Local Console MVP PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Local Console MVP FAILED');
  console.error(err);
  process.exit(1);
});
