/**
 * Smoke Test: Human Approval Minimal Packet
 * v0.5.6
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { HumanApprovalMinimalPacket } = require('../tools/human-approval-minimal-packet');

async function runSmokeTest() {
  console.log('Running Smoke Test: Human Approval Minimal Packet...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/human-approval-minimal-packet-v0.5.6.md',
    'docs/ai-dev-team/junya-final-yes-no-policy-v0.5.6.md',
    'docs/ai-dev-team/approval-question-reduction-policy-v0.5.6.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Approval Packet 動作確認
  const ha = new HumanApprovalMinimalPacket();
  const packet = ha.createApprovalRequest({
    title: 'Deploy to Production',
    riskLevel: 'L4',
    recommendation: 'Approve after manual smoke test'
  });

  assert.ok(packet.approvalId.startsWith('APP-'));
  assert.strictEqual(packet.riskLevel, 'L4');
  
  const display = ha.formatForDisplay(packet);
  assert.ok(display.includes('APP-'));
  assert.ok(display.includes('Risk: L4'));

  console.log('Smoke Test: Human Approval Minimal Packet PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Human Approval Minimal Packet FAILED');
  console.error(err);
  process.exit(1);
});
