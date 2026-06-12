#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const sanitizedPackGenerator = require('../tools/kosame-sanitized-task-pack-generator');
const patchGate = require('../tools/kosame-patch-intake-gate');
const explainability = require('../tools/kosame-router-explainability-dashboard');
const fallbackMatrix = require('../tools/kosame-availability-fallback-matrix');
const workerScorecard = require('../tools/kosame-worker-scorecard');
const costLedger = require('../tools/kosame-cost-token-ledger');
const ipGate = require('../tools/kosame-ip-protection-gate');

let failures = 0;
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function includesText(value, fragment) {
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function buildPack(task, workerType, context = {}) {
  return sanitizedPackGenerator.buildSanitizedTaskPack(task, {
    ...context,
    workerType,
    requestedModel: context.requestedModel || workerType,
  });
}

function buildGate(input, context = {}) {
  return patchGate.buildPatchIntakeGate(input, context);
}

console.log('=== v110.59 patch intake gate smoke ===');

check('package version >= 110.59.0', versionAtLeast(pkg.version, 110, 59));
check('patch intake gate module is available', typeof patchGate.buildPatchIntakeGate === 'function');

const docsTask = {
  id: 'T-DOCS',
  title: 'Update router explanation docs',
  description: 'Refresh one docs section for the router explanation text.',
  file_scope: ['docs/router-explainability.md'],
};

const smokeTask = {
  id: 'T-SMOKE',
  title: 'Add sanitized task pack smoke',
  description: 'Add one smoke file for the new sanitized task pack generator.',
  file_scope: ['smoke/v110-58-sanitized-task-pack-generator-smoke.js'],
};

const utilTask = {
  id: 'T-UTIL',
  title: 'Refactor one utility function',
  description: 'Keep this to one small utility function.',
  file_scope: ['tools/kosame-sanitized-task-pack-generator.js'],
};

const docsPack = buildPack(docsTask, 'deepseek-chat', { specText: docsTask.description });
const smokePack = buildPack(smokeTask, 'opencode', { specText: smokeTask.description });
const utilPack = buildPack(utilTask, 'grok', { specText: utilTask.description });

check('v110.58 sanitized task pack behavior remains intact', docsPack.allowedWorkerClass === 'sanitized_only' && docsPack.returnDiffOnly === true);

const docsPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update router explanation docs',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
  riskNotes: 'docs only',
});
check('safe docs patch is accepted', docsPatch.accepted === true && docsPatch.rejected === false && docsPatch.humanGateRequired === false);
check('safe docs patch allows changed files', docsPatch.forbiddenFilesTouched.length === 0 && docsPatch.changedFilesAllowed.length === 1);
check('safe docs patch respects diff-only', docsPatch.returnDiffOnlyRespected === true);

const smokePatch = buildGate({
  workerType: 'opencode',
  sourceTaskPack: smokePack,
  changedFiles: ['smoke/v110-58-sanitized-task-pack-generator-smoke.js'],
  patchSummary: 'Add sanitized task pack smoke',
  diffText: 'diff --git a/smoke/v110-58-sanitized-task-pack-generator-smoke.js b/smoke/v110-58-sanitized-task-pack-generator-smoke.js\n+++ b/smoke/v110-58-sanitized-task-pack-generator-smoke.js\n@@ -0,0 +1,3 @@\n+// smoke',
  declaredScope: smokePack.allowedScope,
  verifyCommands: smokePack.verifyCommands,
  riskNotes: 'smoke only',
});
check('safe smoke patch is accepted', smokePatch.accepted === true && smokePatch.rejected === false && smokePatch.humanGateRequired === false);
check('safe smoke patch keeps verify commands present', smokePatch.verifyCommandsPresent === true);

const utilPatch = buildGate({
  workerType: 'grok',
  sourceTaskPack: utilPack,
  changedFiles: ['tools/kosame-sanitized-task-pack-generator.js'],
  patchSummary: 'Refactor one utility function',
  diffText: 'diff --git a/tools/kosame-sanitized-task-pack-generator.js b/tools/kosame-sanitized-task-pack-generator.js\n+++ b/tools/kosame-sanitized-task-pack-generator.js\n@@ -1,2 +1,2 @@\n-const x = 1;\n+const x = 2;',
  declaredScope: utilPack.allowedScope,
  verifyCommands: utilPack.verifyCommands,
  riskNotes: 'utility only',
});
check('safe one-function utility patch is accepted', utilPatch.accepted === true && utilPatch.rejected === false && utilPatch.humanGateRequired === false);

const outOfScopePatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md', 'tools/other-file.js'],
  patchSummary: 'Update router explanation docs and unrelated tool',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('patch touching files outside allowedFiles is rejected', outOfScopePatch.rejected === true && outOfScopePatch.scopeViolationDetected === true);

const secretPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Document KOSAME_API_KEY handling',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New KOSAME_API_KEY',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('patch with Secret/API key is HUMAN_GATE_REQUIRED', secretPatch.humanGateRequired === true);

const customerPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update customer data handling',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New customer_name',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('patch with customer data is HUMAN_GATE_REQUIRED', customerPatch.humanGateRequired === true);

const ipPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update full architecture and orchestration',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New full architecture orchestration',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('patch with IP/core/full architecture is HUMAN_GATE_REQUIRED', ipPatch.humanGateRequired === true);

const billingPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Change billing and lead management',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New billing lead management',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('patch with billing/lead-management scope is HUMAN_GATE_REQUIRED', billingPatch.humanGateRequired === true);

const transcriberPack = buildPack({
  id: 'T-TRANSC',
  title: 'Transcriber customer data cleanup',
  description: 'Remove transcriber customer data from docs.',
  file_scope: ['docs/router-explainability.md'],
}, 'deepseek-chat', { specText: 'transcriber customer data' });
const transcriberPatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: transcriberPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Transcriber customer data cleanup',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New transcriber customer data',
  declaredScope: transcriberPack.allowedScope,
  verifyCommands: transcriberPack.verifyCommands,
});
check('transcriber/customer-data patch blocks DeepSeek/opencode', transcriberPatch.humanGateRequired === true || transcriberPatch.rejected === true);

const deepseekUnsafePack = {
  ...docsPack,
  allowedWorkerClass: 'standard',
};
const deepseekUnsafePatch = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: deepseekUnsafePack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update docs',
  diffText: 'diff --git a/docs/router-explainability.md b/docs/router-explainability.md\n+++ b/docs/router-explainability.md\n@@ -1,2 +1,2 @@\n-Old\n+New',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('DeepSeek/opencode patch without sanitized_only task pack is rejected', deepseekUnsafePatch.rejected === true);

const missingVerifyPatch = buildGate({
  workerType: 'gpt-5.4',
  sourceTaskPack: utilPack,
  changedFiles: ['tools/kosame-sanitized-task-pack-generator.js'],
  patchSummary: 'Refactor one utility function',
  diffText: 'diff --git a/tools/kosame-sanitized-task-pack-generator.js b/tools/kosame-sanitized-task-pack-generator.js\n+++ b/tools/kosame-sanitized-task-pack-generator.js\n@@ -1,2 +1,2 @@\n-const x = 1;\n+const x = 2;',
  declaredScope: utilPack.allowedScope,
  verifyCommands: [],
});
check('missing verifyCommands for code change is rejected or human_gate', missingVerifyPatch.rejected === true || missingVerifyPatch.humanGateRequired === true);

const diffOnlyViolation = buildGate({
  workerType: 'deepseek-chat',
  sourceTaskPack: docsPack,
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update docs',
  diffText: 'Please update the docs with the new explanation.',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
});
check('returnDiffOnly violation is rejected', diffOnlyViolation.rejected === true && diffOnlyViolation.returnDiffOnlyRespected === false);

const docsExplanation = explainability.buildRouterExplanation(docsTask, docsPack, { requestedModel: 'gpt-5.4-mini' });
check('v110.57 explainability behavior remains intact', includesText(docsExplanation.costReason, 'cheap-first') && includesText(docsExplanation.costReason, 'gpt-5.4-mini'));

const claudeFallback = fallbackMatrix.recommendAvailabilityFallback(
  docsTask,
  'claude-sonnet-4-6',
  fallbackMatrix.WORKER_STATES.unavailable,
  { approvalReceived: false },
);
check('v110.56 fallback behavior remains intact', claudeFallback.humanGateRequired === false && claudeFallback.canProceed === true);

const scorecardDocs = workerScorecard.recommendWorkerForTask(docsTask);
check('v110.55 scorecard behavior remains intact', scorecardDocs.modelId === 'gpt-5.4-mini' && scorecardDocs.modelTier === 'cheap');

const ledgerDocs = costLedger.buildLedgerRecord(docsTask, { verifyRunCount: 1 });
check('v110.54 cost ledger behavior remains intact', ledgerDocs.selectedModel === 'gpt-5.4-mini' && ledgerDocs.modelTier === 'cheap');

const ipGateCheck = ipGate.isIPProtectedTask({
  title: 'Smart Router core full architecture update',
  description: 'Revise the full architecture and orchestration core.',
}, {});
check('v110.53 IP gate behavior remains intact', ipGateCheck.allowed === false);

if (failures > 0) {
  console.error(`\nFAIL: v110.59 patch intake gate smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.59 patch intake gate smoke PASSED');
