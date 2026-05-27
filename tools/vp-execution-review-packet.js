/**
 * VP Execution Review Packet v3.5.0
 *
 * Reviews Cloud Shell execution result and produces a verdict:
 * success / failure / needs_review / claude_repair / gemini_expand / release_candidate
 */

const VERDICTS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  NEEDS_REVIEW: 'needs_review',
  CLAUDE_REPAIR: 'claude_repair',
  GEMINI_EXPAND: 'gemini_expand',
  RELEASE_CANDIDATE: 'release_candidate'
};

function reviewExecutionResult(executionInput = {}) {
  const {
    operation = 'unknown',
    exitCode = -1,
    stdout = '',
    stderr = '',
    durationMs = 0,
    expectedOutcome = '',
    verifyStatus = 'not_run',
    actionsStatus = 'unknown',
    session_id = ''
  } = executionInput;

  const succeeded = exitCode === 0;
  const hasErrors = stderr.length > 0 || stdout.toLowerCase().includes('error') || stdout.toLowerCase().includes('failed');
  const verifyPassed = verifyStatus === 'passed';
  const actionsSuccess = actionsStatus === 'success';

  let verdict = VERDICTS.NEEDS_REVIEW;
  let analysis = '';
  let nextSteps = [];

  if (succeeded && verifyPassed && actionsSuccess) {
    verdict = VERDICTS.RELEASE_CANDIDATE;
    analysis = '全グリーン — release候補。じゅんやさんへrelease確認を依頼。';
    nextSteps = ['release-decision-reportを生成', 'じゅんやさんYESで git tag / push'];
  } else if (succeeded && !hasErrors) {
    verdict = VERDICTS.SUCCESS;
    analysis = `${operation} 成功 (exitCode: ${exitCode})。`;
    nextSteps = verifyPassed ? ['commit candidateを確認'] : ['npm run verifyを実行'];
  } else if (!succeeded && (stderr.includes('verify') || stderr.includes('FAIL') || stdout.includes('FAIL'))) {
    verdict = VERDICTS.CLAUDE_REPAIR;
    analysis = 'verify/smokeエラー検出 — Claude係長による修正が必要。';
    nextSteps = ['Claude係長にrepair-intake送付', 'fix → verify loopを実行'];
  } else if (!succeeded && (stderr.includes('quota') || stderr.includes('rate limit') || stderr.includes('Gemini'))) {
    verdict = VERDICTS.GEMINI_EXPAND;
    analysis = 'Gemini quota/rate limit — Claude係長にフォールバック検討。';
    nextSteps = ['Gemini状態を確認', 'Claude係長にフォールバック'];
  } else if (!succeeded) {
    verdict = VERDICTS.FAILURE;
    analysis = `${operation} 失敗 (exitCode: ${exitCode})。要調査。`;
    nextSteps = ['エラーログを確認', 'Claude係長にtriage依頼'];
  }

  return {
    packet: 'vp-execution-review-packet',
    session_id,
    operation,
    verdict,
    analysis,
    nextSteps,
    exitCode,
    succeeded,
    hasErrors,
    durationMs,
    verifyStatus,
    actionsStatus,
    verdicts: VERDICTS,
    requiresHumanApproval: verdict === VERDICTS.RELEASE_CANDIDATE,
    version: '3.5.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { reviewExecutionResult, VERDICTS };

if (require.main === module) {
  const result = reviewExecutionResult({
    operation: 'npm run verify',
    exitCode: 0,
    stdout: 'PASS: 420 / 420',
    stderr: '',
    verifyStatus: 'passed',
    actionsStatus: 'success'
  });
  console.log(JSON.stringify(result, null, 2));
}
