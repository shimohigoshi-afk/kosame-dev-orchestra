/**
 * Smoke Test: Operator Command Packet
 * v0.5.1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateOperatorCommand } = require('../tools/operator-command-packet-generator');

async function runSmokeTest() {
  console.log('Running Smoke Test: Operator Command Packet...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/operator-command-packet-v0.5.1.md',
    'docs/ai-dev-team/operator-command-lifecycle-v0.5.1.md',
    'docs/ai-dev-team/operator-command-risk-classification-v0.5.1.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Generator 動作確認
  const packet = generateOperatorCommand({
    title: 'Test Command',
    purpose: 'Smoke Testing',
    risk: 'high'
  });

  assert.strictEqual(packet.version, '0.5.1');
  assert.strictEqual(packet.risk, 'high');
  assert.strictEqual(packet.humanApprovalRequired, true, 'High risk must require human approval');
  assert.ok(packet.commandId.startsWith('CMD-'));

  console.log('Smoke Test: Operator Command Packet PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Operator Command Packet FAILED');
  console.error(err);
  process.exit(1);
});
