/**
 * Operator State Reader Writer v1.0.2
 * 
 * Safely reads and updates the operator state.
 */

const fs = require('fs');

function readState(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to read state from ${filePath}: ${error.message}`);
  }
}

function updateState(currentState, updates) {
  const allowedFields = [
    'currentVersion',
    'currentPhase',
    'lastCommit',
    'workflowStatus',
    'pendingApproval',
    'nextAction',
    'activeAgent',
    'riskLevel'
  ];

  const updatedState = { ...currentState };
  
  // Update version and state data
  if (updates.version) updatedState.version = updates.version;
  
  if (updates.state) {
    for (const key in updates.state) {
      if (allowedFields.includes(key)) {
        updatedState.state[key] = updates.state[key];
      }
    }
  }

  updatedState.state.updatedAt = new Date().toISOString();
  return updatedState;
}

function writeState(state, filePath) {
  try {
    const data = JSON.stringify(state, null, 2);
    // In Auto-Edit mode, we might want to write to a sample/updated file first
    fs.writeFileSync(filePath, data, 'utf8');
    return { status: 'success', path: filePath };
  } catch (error) {
    throw new Error(`Failed to write state to ${filePath}: ${error.message}`);
  }
}

module.exports = { readState, updateState, writeState };
