#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const pkg = require('../package.json');
const generator = require('../tools/kosame-sanitized-task-pack-generator');
const patchGate = require('../tools/kosame-patch-intake-gate');
const runner = require('../tools/kosame-external-worker-safe-trial-runner');
const reviewLane = require('../tools/kosame-grok-safe-review-lane');
const router = require('../tools/kosame-smart-task-router');

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

function buildTask(id, title, description, file_scope) {
  return { id, title, description, file_scope };
}

console.log('=== v110.61 grok safe review lane smoke ===');

check('package version >= 110.61.0', versionAtLeast(pkg.version, 110, 61));
check('review lane module is available', typeof reviewLane.buildGrokSafeReviewLane === 'function');

const docsTask = buildTask(
  'T-DOCS',
  'Update router review docs',
  'Refresh one docs section for the Grok safe review lane.',
  ['docs/grok-safe-review-lane.md'],
);

const implTask = buildTask(
  'T-IMPL',
  'Implement Grok review lane integration',
  'Add review lane integration and patch summary plumbing.',
  ['tools/kosame-grok-safe-review-lane.js'],
);

const docsPack = generator.buildSanitizedTaskPack(docsTask, { workerType: 'grok' });
check('v110.60 safe trial pack remains sanitized_only', docsPack.allowedWorkerClass === 'sanitized_only');

const docsTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, { workerType: 'grok' });
check('v110.60 safe trial runner still accepts sanitized docs', docsTrial.accepted === true && docsTrial.status === 'accepted');

const docsReviewGate = patchGate.buildPatchIntakeGate({
  sourceTaskPack: docsPack,
  workerType: 'grok',
  changedFiles: ['docs/grok-safe-review-lane.md'],
  patchSummary: 'Update router review docs',
  diffText: 'diff --git a/docs/grok-safe-review-lane.md b/docs/grok-safe-review-lane.md\n+++ b/docs/grok-safe-review-lane.md\n@@ -1,2 +1,2 @@\n-Old\n+New',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
  riskNotes: 'docs only',
});
check('v110.59 patch intake gate still accepts safe docs patch', docsReviewGate.accepted === true && docsReviewGate.humanGateRequired === false);

const safeReview = reviewLane.buildGrokSafeReviewLane(docsTask, {
  workerType: 'grok',
  sourceTaskPack: docsTrial.sourceTaskPack,
  patchIntakeGate: docsTrial.patchIntakeGate,
  trialResult: docsTrial,
  reviewSummary: docsTrial.patchIntakeGate.patchSummary,
  diffSummary: docsTrial.mockWorkerOutput.patchSummary,
  intakeSummary: 'accepted patch intake',
});

check('safe docs review is safe', safeReview.status === 'safe' && safeReview.safe === true);
check('safe docs review is not blocked or human_gate', safeReview.blocked === false && safeReview.humanGateRequired === false);
check('safe docs review is Grok review-only', safeReview.reviewRole === 'grok' && safeReview.finalDecisionOwner === 'human');
check('safe docs review result is JSON with findings', safeReview.reviewResult && typeof safeReview.reviewResult === 'object' && Array.isArray(safeReview.reviewResult.findings));
check('safe docs review prompt stays sanitized', !includesText(safeReview.reviewPrompt, '*** Begin Patch') && !includesText(safeReview.reviewPrompt, 'sk-'));
check('safe docs review prompt asks for hole-finding', includesText(safeReview.reviewPrompt, 'missing pieces') && includesText(safeReview.reviewPrompt, 'edge cases'));
check('safe docs review packet includes json output format', safeReview.reviewPacket.expectedOutputFormat === 'json');

const implTrial = runner.buildExternalWorkerSafeTrialRun(implTask, { workerType: 'grok' });
check('implementation trial remains accepted', implTrial.accepted === true && implTrial.status === 'accepted');

const implReview = reviewLane.buildGrokSafeReviewLane(implTask, {
  workerType: 'grok',
  sourceTaskPack: implTrial.sourceTaskPack,
  patchIntakeGate: implTrial.patchIntakeGate,
  trialResult: implTrial,
  reviewSummary: implTrial.patchIntakeGate.patchSummary,
  diffSummary: implTrial.mockWorkerOutput.patchSummary,
  intakeSummary: 'accepted patch intake',
});
check('implementation review is caution', implReview.status === 'caution' && implReview.caution === true);
check('implementation review remains advisory only', implReview.reviewResult.recommendedNextAction === 'review_with_extra_verification');

const secretGate = patchGate.buildPatchIntakeGate({
  sourceTaskPack: docsPack,
  workerType: 'grok',
  changedFiles: ['docs/grok-safe-review-lane.md'],
  patchSummary: 'Document KOSAME_API_KEY handling',
  diffText: 'diff --git a/docs/grok-safe-review-lane.md b/docs/grok-safe-review-lane.md\n+++ b/docs/grok-safe-review-lane.md\n@@ -1,2 +1,2 @@\n-Old\n+New KOSAME_API_KEY',
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
  riskNotes: 'secret content',
});
check('secret patch requires human gate', secretGate.humanGateRequired === true);

const humanReview = reviewLane.buildGrokSafeReviewLane(docsTask, {
  workerType: 'grok',
  sourceTaskPack: docsPack,
  patchIntakeGate: secretGate,
  reviewSummary: 'sanitized summary only',
  diffSummary: 'sanitized diff summary only',
  intakeSummary: 'human gate from secret redaction',
});
check('secret review becomes human_gate', humanReview.status === 'human_gate' && humanReview.humanGateRequired === true);
check('secret review reason mentions redaction or secret', includesText(humanReview.humanGateReason, 'secret') || includesText(humanReview.humanGateReason, 'redact'));
check('secret review result routes to human gate', humanReview.reviewResult.recommendedNextAction === 'route_to_human_gate');

const wrongPack = generator.buildSanitizedTaskPack(docsTask, { workerType: 'gpt-5.4-mini' });
const blockedReview = reviewLane.buildGrokSafeReviewLane(docsTask, {
  workerType: 'grok',
  sourceTaskPack: wrongPack,
  reviewSummary: 'safe summary',
  diffSummary: 'safe diff summary',
  intakeSummary: 'sanitized review',
});
check('non sanitized_only review pack is blocked', blockedReview.status === 'blocked' && blockedReview.blocked === true);
check('non sanitized_only review pack explains why', includesText(blockedReview.humanGateReason, 'sanitized_only'));

const routed = router.assignWorkerByRules(docsTask, {
  generateSanitizedTaskPack: true,
  generatePatchIntakeGate: true,
  generateSafeTrialRunner: true,
  generateGrokSafeReviewLane: true,
  safeTrialWorkerType: 'deepseek-chat',
  grokReviewWorkerType: 'grok',
});
check('router attaches Grok safe review lane', !!routed.grokSafeReviewLane);
check('router-attached Grok review lane stays safe for docs', routed.grokSafeReviewLane && routed.grokSafeReviewLane.status === 'safe');

check('v110.61 review lane keeps v110.60 safe trial runner behavior intact', docsTrial.accepted === true && docsTrial.patchIntakeGate.accepted === true);
check('v110.61 review lane keeps v110.59 patch gate behavior intact', docsReviewGate.accepted === true && docsReviewGate.rejected === false);
check('review packet keeps forbidden scope listed', Array.isArray(safeReview.reviewPacket.forbiddenScope) && safeReview.reviewPacket.forbiddenScope.length > 0);

if (failures > 0) {
  console.log(`\nFAIL: v110.61 grok safe review lane smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.61 grok safe review lane smoke PASSED');
