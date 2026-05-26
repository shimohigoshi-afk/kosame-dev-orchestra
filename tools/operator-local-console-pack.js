/**
 * Operator Local Console MVP Pack
 * v0.8.0
 */

const { getStatusSummary } = require('./operator-cli-status');
const { formatDashboardData } = require('./operator-dashboard-data-pack');
const { generateHandoffMarkdown } = require('./operator-handoff-generator');
const { categorizeApprovals } = require('./operator-approval-board-pack');

function runLocalConsole(state) {
  if (!state || !state.state) return 'Error: State not found.';

  const summary = getStatusSummary(state);
  const dashboard = formatDashboardData(state);
  const approvals = categorizeApprovals(state.state.pendingApproval, state.state.riskLevel);
  const handoff = generateHandoffMarkdown(state);

  return {
    summary,
    dashboard,
    approvals,
    handoff,
    timestamp: new Date().toISOString()
  };
}

module.exports = { runLocalConsole };
