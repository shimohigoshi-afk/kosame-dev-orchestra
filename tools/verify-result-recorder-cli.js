/**
 * Verify Result Recorder CLI v1.0.6
 * 
 * Records and classifies verification results.
 */

function recordVerifyResult(input) {
  const { status, failedSmoke = [], errorSummary = '' } = input;

  const isPass = status === 'pass' && failedSmoke.length === 0;

  return {
    version: '1.0.6',
    timestamp: new Date().toISOString(),
    result: isPass ? 'pass' : 'fail',
    summary: isPass ? 'All verification steps passed.' : `Verification failed: ${errorSummary}`,
    failedSmoke: failedSmoke,
    nextRepairOwner: isPass ? 'None' : (failedSmoke.length > 0 ? 'Claude' : 'Human'),
    commitAllowed: isPass
  };
}

module.exports = { recordVerifyResult };

// CLI Entry Point
if (require.main === module) {
  const [,, status, ...failed] = process.argv;
  if (!status) {
    console.log('Usage: node tools/verify-result-recorder-cli.js <pass|fail> [failed-smoke-1] [failed-smoke-2]...');
    process.exit(0);
  }

  const result = recordVerifyResult({
    status: status,
    failedSmoke: failed,
    errorSummary: status === 'fail' ? 'Manual fail entry' : ''
  });
  console.log(JSON.stringify(result, null, 2));
}
