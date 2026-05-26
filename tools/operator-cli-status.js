/**
 * Operator CLI Status
 * v0.7.3
 */

const fs = require('fs');
const path = require('path');

function getStatusSummary(state) {
  if (!state || !state.state) return 'No state found.';
  const s = state.state;
  return `
[STATUS]   : ${s.workflowStatus}
[VERSION]  : ${s.currentVersion}
[AGENT]    : ${s.activeAgent}
[RISK]     : ${s.riskLevel}
[APPROVAL] : ${s.pendingApproval.length} pending
[NEXT]     : ${s.nextAction}
[UPDATED]  : ${s.updatedAt}
`.trim();
}

function getNextActionSummary(state) {
  if (!state || !state.state) return 'No action found.';
  return `Next Action: ${state.state.nextAction}`;
}

// CLI 実行時の処理
if (require.main === module) {
  const statePath = path.resolve(__dirname, '../fixtures/operator-state.sample.json');
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'summary';
    
    if (mode === 'next') {
      console.log(getNextActionSummary(state));
    } else {
      console.log(getStatusSummary(state));
    }
  } else {
    console.error('Operator state file not found.');
    process.exit(1);
  }
}

module.exports = { getStatusSummary, getNextActionSummary };
