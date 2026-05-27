/**
 * Verify Result Importer v2.7.0
 *
 * Parses npm run verify output into a normalized status snapshot.
 * Input: structured verify data object (no shell exec — dryRun always).
 */

function importVerifyResult(rawVerifyData = {}) {
  const {
    exitCode = -1,
    passedCount = 0,
    failedCount = 0,
    skippedCount = 0,
    failedSmokes = [],
    durationMs = 0,
    lastRunAt = ''
  } = rawVerifyData;

  const verifyStatus = exitCode === 0 && failedCount === 0
    ? 'passed'
    : exitCode === -1
      ? 'not_run'
      : 'failed';

  const totalSmokes = passedCount + failedCount + skippedCount;
  const passRate = totalSmokes > 0 ? Math.round((passedCount / totalSmokes) * 100) : 0;

  return {
    importer: 'verify-result-importer',
    verifyStatus,
    exitCode,
    passedCount,
    failedCount,
    skippedCount,
    totalSmokes,
    passRate,
    failedSmokes,
    hasFailures: failedCount > 0,
    durationMs,
    lastRunAt: lastRunAt || new Date().toISOString(),
    version: '2.7.0',
    importedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { importVerifyResult };

if (require.main === module) {
  const result = importVerifyResult({
    exitCode: 0,
    passedCount: 94,
    failedCount: 0,
    skippedCount: 0,
    failedSmokes: [],
    durationMs: 12450
  });
  console.log(JSON.stringify(result, null, 2));
}
