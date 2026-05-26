/**
 * GitHub Actions Recorder CLI v1.0.7
 * 
 * Records and classifies GitHub Actions workflow results.
 */

function recordActionsResult(input) {
  const { workflow, runId, status } = input;

  let nextAction = 'Wait';
  if (status === 'success') nextAction = 'Release';
  if (status === 'failed') nextAction = 'Repair';
  if (status === 'cancelled') nextAction = 'Re-run';

  return {
    version: '1.0.7',
    timestamp: new Date().toISOString(),
    workflow: workflow || 'Main Workflow',
    runId: runId || 'unknown',
    status: status,
    nextAction: nextAction
  };
}

module.exports = { recordActionsResult };

// CLI Entry Point
if (require.main === module) {
  const [,, status, runId, workflow] = process.argv;
  if (!status) {
    console.log('Usage: node tools/github-actions-recorder-cli.js <success|running|failed|cancelled> [runId] [workflow]');
    process.exit(0);
  }

  const result = recordActionsResult({
    status: status,
    runId: runId,
    workflow: workflow
  });
  console.log(JSON.stringify(result, null, 2));
}
