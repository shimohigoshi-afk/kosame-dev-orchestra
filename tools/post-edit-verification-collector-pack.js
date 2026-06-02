'use strict';

const TOOL_META = {
  version: '15.5.0',
  title: 'Post-Edit Verification Collector',
  slug: 'post-edit-verification-collector-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git commit', 'git push', 'git tag', 'git add',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'secret', '.env', 'api key'
];

function parseNodeCheckResult(raw) {
  if (!raw) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = lower.includes('ok') || lower.includes('pass') || lower === '';
  return { passed, raw: String(raw) };
}

function parseVerifyResult(raw) {
  if (raw === null || raw === undefined) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = !lower.includes('error') && !lower.includes('fail') &&
                 !lower.includes('exit code 1') && !lower.includes('npm err');
  return { passed, raw: String(raw) };
}

function parseSmokeResult(raw) {
  if (!raw) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = lower.includes('pass') && !lower.includes('fail') && !lower.includes('error');
  return { passed, raw: String(raw) };
}

function parseDiffSummary(raw) {
  if (!raw) return { present: false, raw: null };
  return { present: true, raw: String(raw) };
}

function assessRemainingRisks(input) {
  const risks = [];
  if (!input.nodeCheckResult?.passed)  risks.push('node --check did not pass — syntax issue may remain');
  if (!input.verifyResult?.passed)     risks.push('npm run verify did not pass — regressions possible');
  if (!input.smokeResult?.passed)      risks.push('smoke test result unclear or not passed');
  if (!input.diffSummary?.present)     risks.push('diff summary not provided — change scope unknown');
  if (!input.rollbackNote)             risks.push('rollbackNote not provided');
  return risks;
}

function buildVerificationCollector(input) {
  const collectorId    = `verify-collect-${Date.now()}`;
  const taskGoal       = String(input.taskGoal || '(task goal)').trim();
  const editedFiles    = input.editedFiles    || [];
  const rollbackNote   = input.rollbackNote   || '';

  const diffSummary    = parseDiffSummary(input.diffSummaryRaw);
  const nodeCheckResult = parseNodeCheckResult(input.nodeCheckRaw);
  const verifyResult   = parseVerifyResult(input.verifyRaw);
  const smokeResult    = parseSmokeResult(input.smokeRaw);

  const remainingRisks = assessRemainingRisks({
    nodeCheckResult,
    verifyResult,
    smokeResult,
    diffSummary,
    rollbackNote
  });

  const allPassed = nodeCheckResult.passed && verifyResult.passed &&
                    smokeResult.passed && diffSummary.present;

  const readyForCommitReview = allPassed && remainingRisks.length === 0;

  const recommendedNextAction = readyForCommitReview
    ? 'All verifications passed. Ready to build commit candidate packet (v16.0.0).'
    : `Verification not complete. Remaining risks: ${remainingRisks.length}. Resolve before commit.`;

  return {
    version:              TOOL_META.version,
    title:                TOOL_META.title,
    dryRun:               true,
    humanApprovalRequired: true,
    collectorId,
    taskGoal,
    editedFiles,
    diffSummary,
    nodeCheckResult,
    verifyResult,
    smokeResult,
    rollbackNote,
    remainingRisks,
    allPassed,
    readyForCommitReview,
    recommendedNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealCommit:  true,
    noRealPush:    true,
    noRealTag:     true
  };
}

function main() {
  console.log(JSON.stringify(buildVerificationCollector({
    taskGoal:       'README.mdにv15.0.0 First Safe Docs Edit Execution Packの説明を追加した',
    editedFiles:    ['README.md'],
    diffSummaryRaw: '1 file changed, 5 insertions(+)',
    nodeCheckRaw:   'ok',
    verifyRaw:      'All smoke tests passed.',
    smokeRaw:       'PASS: all smoke',
    rollbackNote:   'git checkout -- README.md if needed.'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildVerificationCollector
};
