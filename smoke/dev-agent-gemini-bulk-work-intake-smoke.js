/**
 * Smoke Test: Gemini Bulk Work Intake
 * v0.5.5
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GeminiBulkWorkIntake } = require('../tools/gemini-bulk-work-intake-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Gemini Bulk Work Intake...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/gemini-bulk-work-intake-v0.5.5.md',
    'docs/ai-dev-team/gemini-bulk-work-boundary-v0.5.5.md',
    'docs/ai-dev-team/gemini-bulk-work-result-report-v0.5.5.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Bulk Packet 動作確認
  const bi = new GeminiBulkWorkIntake();
  const packet = bi.createBulkPacket({
    title: 'Docs Generation',
    scope: 'docs/',
    deliverables: ['docs/test-v1.md']
  });

  assert.ok(packet.bulkId.startsWith('BLK-'));
  assert.strictEqual(packet.constraints.noShellExecution, true);
  
  const prompt = bi.formatPrompt(packet);
  assert.ok(prompt.includes('BLK-'));
  assert.ok(prompt.includes('No Shell Execution'));

  console.log('Smoke Test: Gemini Bulk Work Intake PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Gemini Bulk Work Intake FAILED');
  console.error(err);
  process.exit(1);
});
