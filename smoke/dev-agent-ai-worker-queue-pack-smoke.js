'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/ai-worker-queue-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== ai-worker-queue-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.8.0') >= 0);
console.log('  PASS: package version 5.8.0 or later');

assert.ok(pkg.scripts['smoke:ai-worker-queue-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.8.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/ai-worker-queue.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.8.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ items: [{ provider: 'claude', taskType: 'bugfix', priority: 'high' }] });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const enqResult = tool.enqueue([], { provider: 'claude', taskType: 'bugfix', priority: 'high', dataLevel: 'A' });
assert.strictEqual(enqResult.ok, true);
assert.strictEqual(enqResult.queue.length, 1);
console.log('  PASS: enqueue works');

const dqResult = tool.dequeue(enqResult.queue);
assert.strictEqual(dqResult.ok, true);
assert.strictEqual(dqResult.item.status, 'dispatched');
console.log('  PASS: dequeue works');

const emptyDq = tool.dequeue([]);
assert.strictEqual(emptyDq.ok, false);
console.log('  PASS: empty queue dequeue fails gracefully');

const status = tool.getQueueStatus(enqResult.queue);
assert.strictEqual(status.total, 1);
console.log('  PASS: queue status total correct');

console.log('PASS: ai-worker-queue-pack');
