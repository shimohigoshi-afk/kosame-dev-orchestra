/**
 * Smoke Test: Agent Dispatch Queue
 * v0.5.2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AgentDispatchQueue } = require('../tools/agent-dispatch-queue-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Agent Dispatch Queue...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/agent-dispatch-queue-v0.5.2.md',
    'docs/ai-dev-team/agent-dispatch-state-machine-v0.5.2.md',
    'docs/ai-dev-team/agent-dispatch-priority-policy-v0.5.2.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Queue 動作確認
  const dq = new AgentDispatchQueue();
  const cmd = { commandId: 'CMD-001', title: 'Test' };
  
  dq.enqueue(cmd, 'high');
  assert.strictEqual(dq.queue.length, 1);
  assert.strictEqual(dq.queue[0].priority, 'high');
  assert.strictEqual(dq.queue[0].status, 'queued');

  dq.dispatch('CMD-001', 'claude-code');
  assert.strictEqual(dq.queue[0].status, 'running');
  assert.strictEqual(dq.queue[0].assignedTo, 'claude-code');

  dq.complete('CMD-001', { success: true });
  assert.strictEqual(dq.queue[0].status, 'needs_review');

  console.log('Smoke Test: Agent Dispatch Queue PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Agent Dispatch Queue FAILED');
  console.error(err);
  process.exit(1);
});
