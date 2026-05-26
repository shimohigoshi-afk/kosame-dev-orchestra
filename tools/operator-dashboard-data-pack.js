/**
 * Operator Dashboard Data Pack
 * v0.7.2
 */

function formatDashboardData(state) {
  if (!state || !state.state) {
    return null;
  }

  const s = state.state;
  return {
    version: '1.0.0',
    summary: {
      currentVersion: s.currentVersion,
      workflowStatus: s.workflowStatus,
      riskLevel: s.riskLevel
    },
    cards: [
      {
        type: 'StatusCard',
        id: 'version',
        title: 'Project Version',
        value: s.currentVersion,
        status: 'info'
      },
      {
        type: 'StatusCard',
        id: 'status',
        title: 'Workflow Status',
        value: s.workflowStatus,
        status: s.workflowStatus === 'Idle' ? 'info' : 'success'
      },
      {
        type: 'StatusCard',
        id: 'agent',
        title: 'Active Agent',
        value: s.activeAgent,
        status: s.activeAgent === 'None' ? 'info' : 'warning'
      },
      {
        type: 'StatusCard',
        id: 'next-action',
        title: 'Next Action',
        value: s.nextAction,
        status: 'warning'
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

module.exports = { formatDashboardData };
