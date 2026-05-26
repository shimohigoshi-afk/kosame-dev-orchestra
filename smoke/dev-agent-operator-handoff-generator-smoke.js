/**
 * Smoke Test: Operator Handoff Generator
 * v0.7.4
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateHandoffMarkdown } = require('../tools/operator-handoff-generator');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Handoff Generator...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-handoff-generator-v0.7.4.md',
    'docs/ai-dev-team/operator-handoff-format-v0.7.4.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Markdown 生成確認
  const mockState = {
    state: {
      currentVersion: '0.7.4',
      workflowStatus: 'InProgress',
      activeAgent: 'Claude',
      riskLevel: 'High',
      pendingApproval: ['Security review of API key handling'],
      nextAction: 'Finalize v0.7.5 Approval Board'
    }
  };

  const handoff = generateHandoffMarkdown(mockState, ['Implemented v0.7.4 Handoff Generator']);
  assert.ok(handoff.includes('# Operator Handoff - 0.7.4'));
  assert.ok(handoff.includes('Risk: High'));
  assert.ok(handoff.includes('Implemented v0.7.4 Handoff Generator'));
  assert.ok(handoff.includes('Security review of API key handling'));

  // 3. Fixture 確認
  assert.ok(fs.existsSync(path.resolve('fixtures/operator-handoff.sample.md')), 'Missing fixture');

  console.log('Smoke Test: Operator Handoff Generator PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Handoff Generator FAILED');
  console.error(err);
  process.exit(1);
});
