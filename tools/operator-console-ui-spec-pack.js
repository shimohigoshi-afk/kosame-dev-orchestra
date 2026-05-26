/**
 * Operator Console UI Spec Pack
 * v0.9.1
 */

function getUiMetadata() {
  return {
    version: '1.0.0',
    theme: 'Dark',
    screens: ['Dashboard', 'Approvals', 'Handoff', 'History'],
    components: [
      { id: 'status-card', type: 'DataDisplay' },
      { id: 'action-button', type: 'Interactive' },
      { id: 'approval-list', type: 'List' }
    ]
  };
}

module.exports = { getUiMetadata };
