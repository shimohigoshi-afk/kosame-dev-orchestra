/**
 * Operator Dashboard Snapshot v1.1.1
 * 
 * Aggregates operational data into a snapshot.
 */

function generateSnapshot(state, verifyResult, actionsResult) {
  return {
    version: '1.1.1',
    timestamp: new Date().toISOString(),
    cards: {
      status: {
        phase: state.state.currentPhase,
        version: state.state.currentVersion
      },
      verification: {
        result: verifyResult ? verifyResult.result : 'unknown',
        timestamp: verifyResult ? verifyResult.timestamp : null
      },
      actions: {
        status: actionsResult ? actionsResult.status : 'unknown',
        runId: actionsResult ? actionsResult.runId : null
      },
      governance: {
        pendingApprovals: state.state.pendingApproval ? state.state.pendingApproval.length : 0,
        riskLevel: state.state.riskLevel
      },
      execution: {
        nextAction: state.state.nextAction,
        agent: state.state.activeAgent
      }
    }
  };
}

module.exports = { generateSnapshot };

// CLI Entry Point
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/operator-state.sample.json'), 'utf8'));
  const verify = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/verify-result.passed.sample.json'), 'utf8'));
  const actions = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/github-actions.success.sample.json'), 'utf8'));

  const snapshot = generateSnapshot(state, verify, actions);
  console.log(JSON.stringify(snapshot, null, 2));
}
