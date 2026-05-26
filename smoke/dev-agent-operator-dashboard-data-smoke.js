/**
 * Smoke Test: Operator Dashboard Data
 * v0.7.2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { formatDashboardData } = require('../tools/operator-dashboard-data-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Dashboard Data...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-dashboard-data-v0.7.2.md',
    'docs/ai-dev-team/operator-dashboard-widget-contract-v0.7.2.md',
    'docs/ai-dev-team/operator-dashboard-status-cards-v0.7.2.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Dashboard Data 整形確認
  const mockState = {
    state: {
      currentVersion: '0.7.2',
      workflowStatus: 'Running',
      activeAgent: 'Gemini',
      riskLevel: 'Medium',
      nextAction: 'Verify implementation'
    }
  };

  const dashboard = formatDashboardData(mockState);
  assert.strictEqual(dashboard.summary.currentVersion, '0.7.2');
  assert.ok(dashboard.cards.length >= 4);
  assert.strictEqual(dashboard.cards.find(c => c.id === 'version').value, '0.7.2');

  // 3. Fixture 確認
  const fixturePath = path.resolve('fixtures/operator-dashboard.sample.json');
  assert.ok(fs.existsSync(fixturePath), 'Missing fixture: fixtures/operator-dashboard.sample.json');

  console.log('Smoke Test: Operator Dashboard Data PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Dashboard Data FAILED');
  console.error(err);
  process.exit(1);
});
