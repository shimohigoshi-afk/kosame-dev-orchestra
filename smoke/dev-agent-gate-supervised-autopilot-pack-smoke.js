'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-gate-supervised-autopilot-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-gate-supervised-autopilot-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.2.0', 'package version must be 110.2.0 or later');
console.log('  PASS: package version >= 110.2.0');

// 2. routine local implementation → shouldProceedAutomatically:true and shouldAskUser:false
const r1 = tool.evaluateAction({ action: 'create_local_tool_files' });
assert.strictEqual(r1.shouldProceedAutomatically, true);
assert.strictEqual(r1.shouldAskUser, false);
assert.strictEqual(r1.humanApprovalRequired, false);
console.log('  PASS: create_local_tool_files → shouldProceedAutomatically:true, shouldAskUser:false');

// 3. smoke/verify actions → shouldProceedAutomatically:true
const r2 = tool.evaluateAction({ action: 'run_smoke_tests' });
assert.strictEqual(r2.shouldProceedAutomatically, true);
console.log('  PASS: run_smoke_tests → shouldProceedAutomatically:true');

const r2b = tool.evaluateAction({ action: 'run_npm_run_verify' });
assert.strictEqual(r2b.shouldProceedAutomatically, true);
console.log('  PASS: run_npm_run_verify → shouldProceedAutomatically:true');

// 4. git commit/tag/push → humanApprovalRequired:true
const r3a = tool.evaluateAction({ action: 'git_commit' });
assert.strictEqual(r3a.humanApprovalRequired, true);
assert.strictEqual(r3a.shouldAskUser, true);
console.log('  PASS: git_commit → humanApprovalRequired:true');

const r3b = tool.evaluateAction({ action: 'git_tag' });
assert.strictEqual(r3b.humanApprovalRequired, true);
console.log('  PASS: git_tag → humanApprovalRequired:true');

const r3c = tool.evaluateAction({ action: 'git_push' });
assert.strictEqual(r3c.humanApprovalRequired, true);
console.log('  PASS: git_push → humanApprovalRequired:true');

// 5. deploy → humanApprovalRequired:true
const r4 = tool.evaluateAction({ action: 'deploy' });
assert.strictEqual(r4.humanApprovalRequired, true);
console.log('  PASS: deploy → humanApprovalRequired:true');

// 6. secrets/.env/customer/insurance/health data → blocked or approval required
const r5a = tool.evaluateAction({ action: 'read_secrets' });
assert.strictEqual(r5a.humanApprovalRequired, true);
console.log('  PASS: read_secrets → humanApprovalRequired:true');

const r5b = tool.evaluateAction({ action: 'edit_env' });
assert.strictEqual(r5b.humanApprovalRequired, true);
console.log('  PASS: edit_env → humanApprovalRequired:true');

const r5c = tool.evaluateAction({ action: 'access_customer_data' });
assert.strictEqual(r5c.humanApprovalRequired, true);
console.log('  PASS: access_customer_data → humanApprovalRequired:true');

const r5d = tool.evaluateAction({ action: 'access_insurance_data' });
assert.strictEqual(r5d.humanApprovalRequired, true);
console.log('  PASS: access_insurance_data → humanApprovalRequired:true');

const r5e = tool.evaluateAction({ action: 'access_health_data' });
assert.strictEqual(r5e.humanApprovalRequired, true);
console.log('  PASS: access_health_data → humanApprovalRequired:true');

// 7. expensive model escalation → humanApprovalRequired:true
const r6 = tool.evaluateAction({ action: 'expensive_model_escalation' });
assert.strictEqual(r6.humanApprovalRequired, true);
console.log('  PASS: expensive_model_escalation → humanApprovalRequired:true');

// 8. GPT policy forbids task-order decision
const report = tool.buildPolicyReport();
assert.ok(report.gptConstraintPolicy.forbiddenRoles.includes('decide_task_order'));
assert.ok(report.gptConstraintPolicy.forbiddenRoles.includes('change_agreed_sequence'));
assert.strictEqual(report.gptConstraintPolicy.gptRole, 'execution_assistant_only');
console.log('  PASS: GPT policy forbids task-order decision and conservative detour');

// 9. Claude load policy discourages full logs
assert.strictEqual(report.claudeLoadPolicy.receiveFullLogs, false);
assert.strictEqual(report.claudeLoadPolicy.receiveFailureSnapshot, true);
assert.strictEqual(report.claudeLoadPolicy.recommendedPreprocessor, 'gemini');
console.log('  PASS: Claude load policy discourages full logs, prefers Gemini preprocessing');

// 10. dryRun:true
assert.strictEqual(report.dryRun, true);
console.log('  PASS: dryRun is true');

// 11. realProductActionsExecuted:false
assert.strictEqual(report.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted is false');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-gate-supervised-autopilot-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-gate-supervised-autopilot-pack');
