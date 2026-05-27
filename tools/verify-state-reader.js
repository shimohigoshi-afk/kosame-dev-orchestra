/**
 * Verify State Reader v3.2.0
 *
 * Reads npm run verify log input from fixture/text.
 * Classifies PASS / FAIL / EXITCODE / timeout.
 * No shell execution.
 */

function parseVerifyLog(logText = '') {
  const lines = logText.split('\n');

  const passLines = lines.filter(l => l.trim().startsWith('PASS:'));
  const failLines = lines.filter(l => l.trim().startsWith('FAIL:'));

  const passedCount = passLines.reduce((sum, l) => {
    const m = l.match(/PASS:\s*(\d+)\s*\/\s*(\d+)/);
    return m ? sum + parseInt(m[1]) : sum + 1;
  }, 0);

  const failedCount = failLines.reduce((sum, l) => {
    const m = l.match(/FAILED:\s*(\d+)\s*\/\s*(\d+)/);
    return m ? sum + parseInt(m[1]) : sum + 1;
  }, 0);

  const hasTimeout = lines.some(l => l.toLowerCase().includes('timeout') || l.toLowerCase().includes('timed out'));
  const hasExitError = lines.some(l => l.toLowerCase().includes('exit code') || l.toLowerCase().includes('process.exit'));

  const exitCodeMatch = logText.match(/exit(?:ed)?\s*(?:code|with)?\s*:?\s*(\d+)/i);
  const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : (failedCount > 0 ? 1 : 0);

  const verifyStatus = hasTimeout ? 'timeout'
    : exitCode === 0 && failedCount === 0 ? 'passed'
    : failedCount > 0 || exitCode !== 0 ? 'failed'
    : 'unknown';

  const failedSmokes = failLines
    .filter(l => !l.match(/FAILED:\s*\d+/))
    .map(l => l.replace(/^\s*FAIL:\s*/, '').trim())
    .filter(Boolean);

  return {
    verifyStatus,
    exitCode,
    passedCount,
    failedCount,
    hasTimeout,
    hasExitError,
    failedSmokes
  };
}

function readVerifyState(verifyInput = {}) {
  const {
    logText = '',
    exitCode = -1,
    passedCount = 0,
    failedCount = 0,
    failedSmokes = [],
    durationMs = 0,
    session_id = ''
  } = verifyInput;

  let parsed;
  if (logText) {
    parsed = parseVerifyLog(logText);
  } else {
    const verifyStatus = exitCode === 0 && failedCount === 0 ? 'passed'
      : exitCode === -1 ? 'not_run'
      : 'failed';
    parsed = { verifyStatus, exitCode, passedCount, failedCount, failedSmokes, hasTimeout: false, hasExitError: false };
  }

  const totalSmokes = parsed.passedCount + parsed.failedCount;
  const passRate = totalSmokes > 0 ? Math.round((parsed.passedCount / totalSmokes) * 100) : 0;

  return {
    reader: 'verify-state-reader',
    session_id,
    ...parsed,
    totalSmokes,
    passRate,
    durationMs,
    hasFailures: parsed.failedCount > 0 || parsed.verifyStatus === 'failed',
    version: '3.2.0',
    readAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { readVerifyState, parseVerifyLog };

if (require.main === module) {
  const result = readVerifyState({
    logText: 'PASS: all checks\nPASS: 420 / 420\n',
    exitCode: 0
  });
  console.log(JSON.stringify(result, null, 2));
}
