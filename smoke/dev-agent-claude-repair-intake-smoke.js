/**
 * Smoke Test: Claude Repair Intake
 * v0.5.4
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ClaudeRepairIntake } = require('../tools/claude-repair-intake-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Claude Repair Intake...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/claude-repair-intake-v0.5.4.md',
    'docs/ai-dev-team/claude-repair-scope-control-v0.5.4.md',
    'docs/ai-dev-team/claude-repair-result-report-v0.5.4.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Intake Packet 動作確認
  const ri = new ClaudeRepairIntake();
  const packet = ri.createRepairPacket({
    sourceCommandId: 'CMD-001',
    failureLog: 'Syntax Error at line 10',
    targetFiles: ['src/app.js']
  });

  assert.ok(packet.repairId.startsWith('REP-'));
  assert.strictEqual(packet.targetFiles[0], 'src/app.js');
  
  const prompt = ri.formatPromptForClaude(packet);
  assert.ok(prompt.includes('REP-'));
  assert.ok(prompt.includes('Syntax Error'));

  console.log('Smoke Test: Claude Repair Intake PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Claude Repair Intake FAILED');
  console.error(err);
  process.exit(1);
});
