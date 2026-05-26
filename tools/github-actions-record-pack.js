/**
 * GitHub Actions Record Pack
 * v0.8.2
 */

function recordGhaStatus(workflowName, runId, status, conclusion = null, url = '') {
  const isFinal = ['success', 'failed', 'cancelled'].includes(status) || conclusion !== null;
  const isSuccess = status === 'success' || conclusion === 'success';

  return {
    version: '1.0.0',
    workflow: {
      name: workflowName,
      runId,
      status,
      conclusion,
      isFinal,
      isSuccess,
      url,
      updatedAt: new Date().toISOString()
    }
  };
}

module.exports = { recordGhaStatus };
