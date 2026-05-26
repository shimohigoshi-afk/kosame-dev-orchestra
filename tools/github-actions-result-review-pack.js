/**
 * GitHub Actions Result Review Pack
 * v0.6.2
 */

class GitHubActionsResultReview {
  reviewRun(runData) {
    const { id, name, conclusion, url } = runData;
    
    let nextAction = 'none';
    if (conclusion === 'failure') {
      if (name.includes('Verify')) {
        nextAction = 'claude-repair';
      } else {
        nextAction = 'pm-investigation';
      }
    } else if (conclusion === 'success') {
      nextAction = 'record-release';
    }

    return {
      runId: id,
      workflowName: name,
      conclusion,
      url,
      nextAction,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { GitHubActionsResultReview };
