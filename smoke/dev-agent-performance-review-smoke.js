/**
 * Smoke Test: Agent Performance Review
 * v0.8.3
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateScorecard } = require('../tools/agent-performance-review-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Agent Performance Review...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/agent-performance-review-v0.8.3.md',
    'docs/ai-dev-team/gemini-claude-role-scorecard-v0.8.3.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Scorecard 生成確認
  const mockTasks = [
    { id: 1, status: 'success' },
    { id: 2, status: 'success' },
    { id: 3, status: 'failure' }
  ];

  const scorecard = generateScorecard('Gemini', mockTasks);
  assert.strictEqual(scorecard.scorecard.agentId, 'Gemini');
  assert.strictEqual(scorecard.scorecard.metrics.totalTasks, 3);
  assert.strictEqual(scorecard.scorecard.metrics.successCount, 2);
  assert.ok(scorecard.scorecard.summary.includes('66.7%'));

  console.log('Smoke Test: Agent Performance Review PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Agent Performance Review FAILED');
  console.error(err);
  process.exit(1);
});
