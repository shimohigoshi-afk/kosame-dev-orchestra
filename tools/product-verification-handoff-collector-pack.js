'use strict';

const TOOL_META = {
  version: '18.5.0',
  title: 'Product Verification & Handoff Collector',
  slug: 'product-verification-handoff-collector-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git commit', 'git push', 'git tag', 'git add',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'secret', '.env', 'api key', 'customer data'
];

function parseCheckResult(raw) {
  if (raw === null || raw === undefined) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = (lower.includes('ok') || lower.includes('pass')) &&
                 !lower.includes('error') && !lower.includes('fail');
  return { passed, raw: String(raw) };
}

function parseVerifyResult(raw) {
  if (raw === null || raw === undefined) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = !lower.includes('error') && !lower.includes('fail') &&
                 !lower.includes('exit code 1') && !lower.includes('npm err');
  return { passed, raw: String(raw) };
}

function buildHandoffNote(target, allPassed, remainingRisks, taskGoal) {
  const status = allPassed ? 'READY' : 'NEEDS_REVIEW';
  return {
    target,
    status,
    taskGoal,
    summary: allPassed
      ? `Implementation verified. Ready for ${target} review and release candidate build.`
      : `Verification incomplete. Risks: ${remainingRisks.slice(0, 2).join('; ')}.`,
    actionRequired: allPassed
      ? `Review verification results and proceed to Product Release Candidate Packet Builder (v19.0.0).`
      : `Resolve remaining risks before proceeding.`
  };
}

function assessRemainingRisks(results) {
  const risks = [];
  if (!results.diffSummary?.present)          risks.push('diff summary missing — change scope unknown');
  if (!results.nodeCheckResult?.passed)        risks.push('node --check failed — syntax issue may remain');
  if (!results.npmVerifyResult?.passed)        risks.push('npm verify failed — regressions possible');
  if (!results.productSmokeResult?.passed)     risks.push('product smoke test not passed');
  if (!results.rollbackNote)                   risks.push('rollback note not provided');
  return risks;
}

function buildHandoffCollector(input) {
  const collectorId  = `verify-handoff-${Date.now()}`;
  const taskGoal     = String(input.taskGoal || '(task goal)').trim();
  const productType  = String(input.productType || 'unknown');
  const editedFiles  = input.editedFiles || [];
  const rollbackNote = input.rollbackNote || '';

  const diffSummary       = { present: !!input.diffSummaryRaw, raw: input.diffSummaryRaw || null };
  const nodeCheckResult   = parseCheckResult(input.nodeCheckRaw);
  const npmVerifyResult   = parseVerifyResult(input.npmVerifyRaw);
  const productSmokeResult = parseCheckResult(input.productSmokeRaw);

  const remainingRisks = assessRemainingRisks({
    diffSummary, nodeCheckResult, npmVerifyResult, productSmokeResult, rollbackNote
  });

  const allPassed = diffSummary.present && nodeCheckResult.passed &&
                    npmVerifyResult.passed && productSmokeResult.passed;

  const handoffToKosame  = buildHandoffNote('Kosame/GPT PM', allPassed, remainingRisks, taskGoal);
  const handoffToGemini  = buildHandoffNote('Gemini', allPassed, remainingRisks, taskGoal);
  const handoffToGrok    = buildHandoffNote('Grok', allPassed, remainingRisks, taskGoal);

  const recommendedNextAction = allPassed
    ? 'All verifications passed. Proceed to Product Release Candidate Packet Builder (v19.0.0).'
    : `Verification incomplete (${remainingRisks.length} risks). Resolve before release candidate.`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    verificationCollectorId: collectorId,
    productType,
    taskGoal,
    editedFiles,
    diffSummary,
    nodeCheckResult,
    npmVerifyResult,
    productSmokeResult,
    rollbackNote,
    handoffToKosame,
    handoffToGemini,
    handoffToGrok,
    remainingRisks,
    allPassed,
    recommendedNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealCommit:  true,
    noRealPush:    true,
    noRealDeploy:  true
  };
}

function main() {
  console.log(JSON.stringify(buildHandoffCollector({
    taskGoal:        '営業DXリード管理画面にCSVエクスポート機能を追加した',
    productType:     'sales_dx',
    editedFiles:     ['src/leads/csv-export.js', 'tests/leads/csv-export.test.js'],
    diffSummaryRaw:  '2 files changed, 45 insertions(+)',
    nodeCheckRaw:    'ok',
    npmVerifyRaw:    'All tests passed.',
    productSmokeRaw: 'PASS: all smoke',
    rollbackNote:    'git checkout -- src/leads/csv-export.js'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildHandoffCollector
};
