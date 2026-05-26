/**
 * Human Approval Minimal Packet
 * v0.5.6
 */

class HumanApprovalMinimalPacket {
  createApprovalRequest(params) {
    const {
      title,
      riskLevel,
      recommendation = 'Approve',
      evidence = 'All tests passed',
      cost = 'Low'
    } = params;

    return {
      approvalId: `APP-${Date.now()}`,
      version: '0.5.6',
      title,
      riskLevel,
      recommendation,
      evidence,
      cost,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  formatForDisplay(packet) {
    return `
=== HUMAN APPROVAL REQUEST (${packet.approvalId}) ===
Title: ${packet.title}
Risk: ${packet.riskLevel}
PM Recommendation: ${packet.recommendation}
Evidence: ${packet.evidence}
Cost Impact: ${packet.cost}

Choices: [Yes] [No] [Repair by Claude]
`.trim();
  }
}

module.exports = { HumanApprovalMinimalPacket };
