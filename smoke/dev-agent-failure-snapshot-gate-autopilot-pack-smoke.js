'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-failure-snapshot-gate-autopilot-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-failure-snapshot-gate-autopilot-pack smoke ===');

// 1. package version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.2.0'), 'package version must be 110.2.0 or later');
console.log('  PASS: package version >= 110.2.0');

// 2. routine work → AUTO_PROCEED
const r1 = tool.classifyGate({ action: 'create_local_tool_files' });
assert.strictEqual(r1.gateDecision, tool.GATE_DECISIONS.AUTO_PROCEED);
assert.strictEqual(r1.humanApprovalRequired, false);
assert.strictEqual(r1.shouldProceedAutomatically, true);
assert.strictEqual(r1.shouldAskUser, false);
console.log('  PASS: create_local_tool_files → AUTO_PROCEED');

const r1b = tool.classifyGate({ action: 'run_smoke_tests' });
assert.strictEqual(r1b.gateDecision, tool.GATE_DECISIONS.AUTO_PROCEED);
console.log('  PASS: run_smoke_tests → AUTO_PROCEED');

const r1c = tool.classifyGate({ action: 'inspect_git_status' });
assert.strictEqual(r1c.gateDecision, tool.GATE_DECISIONS.AUTO_PROCEED);
console.log('  PASS: inspect_git_status → AUTO_PROCEED');

// 3. commit/push → NEEDS_HUMAN_APPROVAL
const r2a = tool.classifyGate({ action: 'git_commit' });
assert.strictEqual(r2a.gateDecision, tool.GATE_DECISIONS.NEEDS_HUMAN_APPROVAL);
assert.strictEqual(r2a.humanApprovalRequired, true);
console.log('  PASS: git_commit → NEEDS_HUMAN_APPROVAL');

const r2b = tool.classifyGate({ action: 'git_push' });
assert.strictEqual(r2b.gateDecision, tool.GATE_DECISIONS.NEEDS_HUMAN_APPROVAL);
console.log('  PASS: git_push → NEEDS_HUMAN_APPROVAL');

const r2c = tool.classifyGate({ action: 'git_tag' });
assert.strictEqual(r2c.gateDecision, tool.GATE_DECISIONS.NEEDS_HUMAN_APPROVAL);
console.log('  PASS: git_tag → NEEDS_HUMAN_APPROVAL');

// 4. provider timeout → SNAPSHOT_REQUIRED
const r3 = tool.classifyGate({ failureType: 'provider_timeout' });
assert.strictEqual(r3.gateDecision, tool.GATE_DECISIONS.SNAPSHOT_REQUIRED);
assert.ok(r3.snapshot, 'snapshot must be present');
assert.strictEqual(r3.snapshot.failureType, 'provider_timeout');
console.log('  PASS: provider_timeout → SNAPSHOT_REQUIRED with snapshot');

// 5. context too large → BLOCKED_CONTEXT_OVERLOAD
const r4 = tool.classifyGate({ failureType: 'context_too_large' });
assert.strictEqual(r4.gateDecision, tool.GATE_DECISIONS.BLOCKED_CONTEXT_OVERLOAD);
assert.strictEqual(r4.shouldReadFullLog, false);
assert.ok(r4.snapshot, 'snapshot must be present for context overload');
console.log('  PASS: context_too_large → BLOCKED_CONTEXT_OVERLOAD, shouldReadFullLog:false');

const r4b = tool.classifyGate({ contextOverloaded: true });
assert.strictEqual(r4b.gateDecision, tool.GATE_DECISIONS.BLOCKED_CONTEXT_OVERLOAD);
console.log('  PASS: contextOverloaded:true → BLOCKED_CONTEXT_OVERLOAD');

// 6. secret/customer data → BLOCKED_DANGEROUS_ACTION or NEEDS_HUMAN_APPROVAL
const r5a = tool.classifyGate({ action: 'access_customer_data' });
assert.ok(
  r5a.gateDecision === tool.GATE_DECISIONS.BLOCKED_DANGEROUS_ACTION ||
  r5a.gateDecision === tool.GATE_DECISIONS.NEEDS_HUMAN_APPROVAL
);
assert.strictEqual(r5a.humanApprovalRequired, true);
console.log('  PASS: access_customer_data → blocked or approval required');

const r5b = tool.classifyGate({ action: 'read_secrets' });
assert.ok(
  r5b.gateDecision === tool.GATE_DECISIONS.BLOCKED_DANGEROUS_ACTION ||
  r5b.gateDecision === tool.GATE_DECISIONS.NEEDS_HUMAN_APPROVAL
);
console.log('  PASS: read_secrets → blocked or approval required');

// 7. DeepSeek/Kimi without sanitized handoff → BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF
const r6 = tool.classifyGate({ targetProvider: 'deepseek', sanitized: false });
assert.strictEqual(r6.gateDecision, tool.GATE_DECISIONS.BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF);
assert.strictEqual(r6.humanApprovalRequired, true);
console.log('  PASS: deepseek + unsanitized → BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF');

const r6b = tool.classifyGate({ targetProvider: 'kimi', sanitized: false });
assert.strictEqual(r6b.gateDecision, tool.GATE_DECISIONS.BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF);
console.log('  PASS: kimi + unsanitized → BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF');

// 8. Gemini recommended for long preprocessing
const r7 = tool.classifyGate({ action: 'create_docs' });
assert.strictEqual(r7.geminiPreprocessPolicy.useForLongInputs, true);
assert.strictEqual(r7.claudeLoadPolicy.recommendedPreprocessor, 'gemini');
console.log('  PASS: Gemini recommended for long preprocessing');

// 9. GPT constrained to execution assistant
const r8 = tool.classifyGate({ action: 'create_fixtures' });
assert.strictEqual(r8.gptConstraintPolicy.gptRole, 'execution_assistant_only');
assert.ok(r8.gptConstraintPolicy.forbiddenRoles.includes('decide_task_order'));
console.log('  PASS: GPT constrained to execution assistant');

// 10. Claude receives short snapshot, not full log
assert.strictEqual(r8.claudeLoadPolicy.receiveFullLogs, false);
assert.strictEqual(r8.claudeLoadPolicy.receiveFailureSnapshot, true);
console.log('  PASS: Claude receives snapshot not full log');

// 11. dryRun:true
assert.strictEqual(r1.dryRun, true);
console.log('  PASS: dryRun is true');

// 12. realProductActionsExecuted:false
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted is false');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-failure-snapshot-gate-autopilot-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-failure-snapshot-gate-autopilot-pack');
