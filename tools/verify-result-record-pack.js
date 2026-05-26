/**
 * Verify Result Record Pack
 * v0.8.1
 */

function recordVerifyResult(status, failedTests = [], errorSummary = '') {
  const commitAllowed = status === 'pass' && failedTests.length === 0;
  
  let nextRepairOwner = 'None';
  if (!commitAllowed) {
    nextRepairOwner = 'Claude'; // デフォルトで補修担当は Claude
  }

  return {
    version: '1.0.0',
    result: {
      status,
      failedSmokeTests: failedTests,
      errorSummary,
      nextRepairOwner,
      commitAllowed,
      updatedAt: new Date().toISOString()
    }
  };
}

module.exports = { recordVerifyResult };
