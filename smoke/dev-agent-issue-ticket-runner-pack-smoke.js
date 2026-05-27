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
const tool = require('../tools/issue-ticket-runner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== issue-ticket-runner-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.4.0') >= 0);
console.log('  PASS: package version 6.4.0 or later');

assert.ok(pkg.scripts['smoke:issue-ticket-runner-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.4.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/issue-ticket-runner.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.4.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ tickets: [
  { title: 'implement X', type: 'implementation', assignedProvider: 'claude' }
] });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const impl = tool.createTicket({ title: 'impl task', type: 'implementation', assignedProvider: 'claude' });
assert.strictEqual(impl.status, 'open');
assert.strictEqual(impl.humanApprovalRequired, false);
console.log('  PASS: implementation ticket no approval gate');

const deploy = tool.createTicket({ title: 'deploy to prod', type: 'deploy', assignedProvider: 'cloudShell' });
assert.strictEqual(deploy.humanApprovalRequired, true);
assert.strictEqual(deploy.approvalGate.required, true);
assert.ok(deploy.approvalGate.approver.includes('じゅんやさん'));
console.log('  PASS: deploy ticket requires human approval');

const updated = tool.updateTicket(impl, { status: 'in_progress' });
assert.strictEqual(updated.status, 'in_progress');
console.log('  PASS: ticket status updated');

const invalidStatus = tool.updateTicket(impl, { status: 'invalid_status' });
assert.strictEqual(invalidStatus.status, 'open');
console.log('  PASS: invalid status reset to open');

const status = tool.getTicketStatus(deploy);
assert.strictEqual(status.isBlocked, false);
assert.strictEqual(status.humanApprovalRequired, true);
console.log('  PASS: ticket status report correct');

const plan = tool.buildRunnerPlan(packet.tickets);
assert.strictEqual(plan.total, 1);
assert.strictEqual(plan.humanApprovalRequired, true);
console.log('  PASS: runner plan built');

console.log('PASS: issue-ticket-runner-pack');
