/**
 * Claude Repair Intake Pack
 * v0.5.4
 */

class ClaudeRepairIntake {
  createRepairPacket(params) {
    const {
      sourceCommandId,
      failureLog,
      targetFiles,
      prohibitedFiles = ['.env', 'package.json'],
      completionCriteria = 'verify PASS'
    } = params;

    return {
      repairId: `REP-${Date.now()}`,
      sourceCommandId,
      version: '0.5.4',
      failureLog,
      targetFiles,
      prohibitedFiles,
      completionCriteria,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  formatPromptForClaude(packet) {
    return `
# Repair Request (${packet.repairId})
Source Command: ${packet.sourceCommandId}

## Failure Log
${packet.failureLog}

## Target Files (Allowed to modify)
${packet.targetFiles.join(', ')}

## Prohibited Files (DO NOT touch)
${packet.prohibitedFiles.join(', ')}

## Completion Criteria
${packet.completionCriteria}

Please fix the issues listed in the failure log within the allowed scope.
`.trim();
  }
}

module.exports = { ClaudeRepairIntake };
