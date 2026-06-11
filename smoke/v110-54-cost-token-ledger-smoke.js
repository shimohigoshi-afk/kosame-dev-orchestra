#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.54 Cost & Token Ledger
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const ledger = require('../tools/kosame-cost-token-ledger');
const policy = require('../tools/kosame-worker-security-policy');
const router = require('../tools/kosame-smart-task-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.54 cost/token ledger smoke ===');

assert.ok(pkg.version >= '110.54.0', `version must be >= 110.54.0 (got ${pkg.version})`);
pass('package version >= 110.54.0');

assert.ok(ledger.TOOL_META.version >= '110.54.0', 'ledger TOOL_META version must be v110.54+');
assert.strictEqual(ledger.MODEL_TIERS.cheap.model, 'gpt-5.4-mini');
assert.strictEqual(ledger.MODEL_TIERS.standard.model, 'gpt-5.4');
assert.strictEqual(ledger.MODEL_TIERS.expensive.model, 'gpt-5.5');
pass('model tiers are defined');

const routineDocs = ledger.recommendModel({ title: 'README docsを整形する' });
assert.strictEqual(routineDocs.selectedModel, 'gpt-5.4-mini', 'routine docs must recommend gpt-5.4-mini');
assert.strictEqual(routineDocs.modelTier, 'cheap');
pass('routine docs task recommends gpt-5.4-mini');

const smokeTask = ledger.recommendModel({ title: 'v110.54 smokeテストを追加する' });
assert.strictEqual(smokeTask.selectedModel, 'gpt-5.4-mini', 'smoke task must recommend gpt-5.4-mini');
pass('smoke task recommends gpt-5.4-mini');

const uiFix = ledger.recommendModel({ title: 'ANESTYのUI表示を微調整する' });
assert.strictEqual(uiFix.selectedModel, 'gpt-5.4-mini', 'UI text fix must recommend gpt-5.4-mini');
pass('UI text fix recommends gpt-5.4-mini');

const implementation = ledger.recommendModel({ title: '検索機能を実装する' });
assert.strictEqual(implementation.selectedModel, 'gpt-5.4', 'normal implementation must recommend gpt-5.4');
assert.strictEqual(implementation.modelTier, 'standard');
pass('normal implementation can recommend gpt-5.4');

const miniFallback = ledger.recommendModel({ title: '検索機能を実装する' }, { miniFailed: true });
assert.strictEqual(miniFallback.selectedModel, 'gpt-5.4', 'mini failure must promote to gpt-5.4');
pass('mini failure promotes to gpt-5.4');

const security = ledger.recommendModel({ title: 'KOSAME API_KEY の扱いを見直す' });
assert.strictEqual(security.approvalRequired, true, 'security task must require approval');
assert.strictEqual(security.selectedModel, 'gpt-5.4', 'security task should stop at standard tier');
pass('security/IP/core task requires human approval before expensive model');

const ipCore = ledger.recommendModel({ title: 'KOSAME Dev Orchestra core の全体設計を再構成する' });
assert.strictEqual(ipCore.approvalRequired, true, 'IP/core task must require approval');
assert.strictEqual(ipCore.selectedModel, 'gpt-5.4', 'IP/core task should not auto-select gpt-5.5');
pass('IP/core task is approval-gated');

for (const task of [routineDocs, smokeTask, uiFix, implementation, security, ipCore]) {
  assert.notStrictEqual(task.selectedModel, 'gpt-5.5', 'recommendation must not auto-escalate to gpt-5.5');
}
pass('no task auto-escalates to gpt-5.5');

const requestedDenied = ledger.evaluateRequestedModel(
  'gpt-5.5',
  { title: 'security escalation' },
  { approvalReceived: false },
);
assert.strictEqual(requestedDenied.approvalRequired, true, 'requested gpt-5.5 must require approval');
assert.strictEqual(requestedDenied.allowed, false, 'requested gpt-5.5 must be blocked without approval');
assert.strictEqual(requestedDenied.selectionBlocked, true, 'requested gpt-5.5 must set selectionBlocked');
pass('gpt-5.5 requires explicit approval');

const requestedApproved = ledger.evaluateRequestedModel(
  'gpt-5.5',
  { title: 'security escalation' },
  { approvalReceived: true },
);
assert.strictEqual(requestedApproved.allowed, true, 'requested gpt-5.5 must pass with approval');
assert.strictEqual(requestedApproved.selectedModel, 'gpt-5.5');
pass('approved gpt-5.5 remains explicit only');

const record = ledger.buildLedgerRecord(
  { title: 'KOSAME Dev Orchestra core の全体設計を再構成する' },
  { requestedModel: 'gpt-5.5', approvalReceived: false, verifyRunCount: 3 },
);
assert.ok(record.version, 'ledger record must include version');
assert.ok(record.timestamp, 'ledger record must include timestamp');
assert.ok(record.taskTitle, 'ledger record must include taskTitle');
assert.ok(record.selectedModel, 'ledger record must include selectedModel');
assert.ok(record.modelTier, 'ledger record must include modelTier');
assert.strictEqual(record.approvalRequired, true, 'ledger record must include approvalRequired');
assert.strictEqual(record.approvalReceived, false, 'ledger record must include approvalReceived');
assert.strictEqual(record.verifyRunCount, 3, 'ledger record must include verifyRunCount');
assert.ok(['low', 'medium', 'high', 'unknown'].includes(record.costEstimateBand), 'ledger record must include costEstimateBand');
assert.ok(typeof record.notes === 'string', 'ledger record must include notes');
pass('ledger record includes model tier and approval fields');

const external = ledger.recommendModel(
  { title: '外部workerへ渡す一般コード修正' },
  { externalSanitized: true },
);
assert.strictEqual(external.modelTier, 'external_sanitized', 'external sanitized tier must be used');
assert.strictEqual(external.selectedModel, 'deepseek-chat');
pass('external_sanitized tier is available');

const ipTask = { title: 'ANESTY Board core の全体アーキテクチャを更新する', difficulty: 'medium' };
const ipAllowed = policy.isDeepSeekAllowedTask(ipTask);
assert.strictEqual(ipAllowed.allowed, false, 'IP core task must remain blocked for external worker');
const ipRouted = router.assignWorkerByRules({ ...ipTask, isConfidential: false, isSalesDx: false });
assert.strictEqual(ipRouted.humanGate, true, 'router must still require human gate for IP core task');
assert.ok((ipRouted.securityViolation || []).length > 0, 'router must preserve security violations');
pass('v110.53 IP gate behavior remains intact');

console.log(`\n✅ v110.54 cost/token ledger smoke PASSED (${passed} checks)`);
