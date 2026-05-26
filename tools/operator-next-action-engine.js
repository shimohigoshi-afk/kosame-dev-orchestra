/**
 * Operator Next Action Engine v1.0.3
 * 
 * Determines the next step based on operator state.
 */

function determineNextAction(state) {
  const { workflowStatus, riskLevel, activeAgent } = state;

  // Rule: Human Approval for High/Critical Risk
  if (riskLevel === 'High' || riskLevel === 'Critical') {
    return {
      nextAction: 'human_approval_required',
      reasoning: `Risk level is ${riskLevel}. Manual review is mandatory.`,
      requiredTool: 'tools/operator-approval-summary.js'
    };
  }

  // Rule: Escalation to Claude on failure
  if (workflowStatus === 'Failed') {
    return {
      nextAction: 'send_to_claude',
      reasoning: 'Verification failed. Escalating to Claude for repair.',
      requiredTool: 'tools/operator-claude-escalation-pack.js'
    };
  }

  // Rule: Run verify after implementation
  if (workflowStatus === 'Idle' || workflowStatus === 'In-Progress') {
    return {
      nextAction: 'run_verify',
      reasoning: 'Implementation cycle complete or idle. Verification recommended.',
      requiredTool: 'npm run verify'
    };
  }

  // Rule: Release after successful verification and commit
  if (workflowStatus === 'Passed') {
    return {
      nextAction: 'commit_candidate',
      reasoning: 'Verification passed. Ready for commit.',
      requiredTool: 'git commit'
    };
  }

  return {
    nextAction: 'wait_for_instruction',
    reasoning: 'No clear next step identified.',
    requiredTool: null
  };
}

module.exports = { determineNextAction };

// CLI Entry Point
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const samplePath = path.join(__dirname, '../fixtures/operator-state.sample.json');
  const stateData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const result = determineNextAction(stateData.state);
  console.log(JSON.stringify(result, null, 2));
}
