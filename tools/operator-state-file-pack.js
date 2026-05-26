/**
 * Operator State File Pack
 * v0.7.1
 */

const fs = require('fs');
const path = require('path');

function getOperatorState(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

function generateInitialState(version = '0.7.1') {
  return {
    version: '1.0.0',
    state: {
      currentVersion: version,
      currentPhase: 'Development',
      lastCommit: '',
      workflowStatus: 'Idle',
      pendingApproval: [],
      nextAction: 'Run smoke tests',
      activeAgent: 'None',
      riskLevel: 'Low',
      updatedAt: new Date().toISOString()
    }
  };
}

module.exports = { getOperatorState, generateInitialState };
