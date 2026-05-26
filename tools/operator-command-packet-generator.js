/**
 * Operator Command Packet Generator
 * v0.5.1
 */

function generateOperatorCommand(params) {
  const {
    commandId,
    title,
    purpose,
    owner = 'Gemini Agent',
    executor = 'Claude Code',
    risk = 'low',
    approvalGate = 'kosame-pm',
    humanApprovalRequired = false,
    dryRunOnly = false,
    prohibitedActions = ['git push', 'deploy'],
    nextAction = 'verify'
  } = params;

  return {
    commandId: commandId || `CMD-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12)}`,
    version: '0.5.1',
    title,
    purpose,
    owner,
    executor,
    risk,
    approvalGate,
    humanApprovalRequired: risk === 'high' || risk === 'critical' ? true : humanApprovalRequired,
    dryRunOnly,
    prohibitedActions,
    nextAction,
    createdAt: new Date().toISOString()
  };
}

module.exports = { generateOperatorCommand };
