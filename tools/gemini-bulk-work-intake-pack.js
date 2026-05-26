/**
 * Gemini Bulk Work Intake Pack
 * v0.5.5
 */

class GeminiBulkWorkIntake {
  createBulkPacket(params) {
    const {
      title,
      scope,
      deliverables,
      constraints = { noShellExecution: true, editOnly: true }
    } = params;

    return {
      bulkId: `BLK-${Date.now()}`,
      version: '0.5.5',
      title,
      scope,
      deliverables,
      constraints,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  formatPrompt(packet) {
    return `
# Bulk Work Request (${packet.bulkId})
Title: ${packet.title}

## Scope
${packet.scope}

## Expected Deliverables
${packet.deliverables.map(d => `- ${d}`).join('\n')}

## Constraints
- No Shell Execution: ${packet.constraints.noShellExecution}
- Edit/Generate Only: ${packet.constraints.editOnly}

Please proceed with generating or editing the files listed above.
Do not run any commands.
`.trim();
  }
}

module.exports = { GeminiBulkWorkIntake };
