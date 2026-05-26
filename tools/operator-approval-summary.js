/**
 * Operator Approval Summary v1.0.4
 * 
 * Generates a concise summary for human approval.
 */

function generateApprovalSummary(approvalData) {
  const { action, agent, risk, changes, reasoning, risks } = approvalData;

  const lines = [
    `### 📋 Approval Request: ${action}`,
    '',
    `**Risk Level**: ${risk}`,
    `**Requested By**: ${agent}`,
    '',
    '**Summary of Changes**:',
    ...changes.map(c => `- ${c}`),
    '',
    '**Why this is needed**:',
    `- ${reasoning}`,
    '',
    '**Risk Factors**:',
    ...risks.map(r => `- ⚠️ ${r}`),
    '',
    '**Suggested Options**:',
    '1. ✅ **Approve**: Proceed immediately.',
    '2. ⏸️ **Hold**: Need more investigation.',
    '3. 🤖 **Send to Claude**: Requires technical fixing.',
    '4. ❌ **Reject**: Stop this approach.'
  ];

  return lines.join('\n');
}

module.exports = { generateApprovalSummary };

// CLI Entry Point
if (require.main === module) {
  const sampleApproval = {
    action: 'Deploy v1.0.2 to Staging',
    agent: 'Gemini Kacho',
    risk: 'Medium',
    changes: ['Updated state reader', 'Added next action engine'],
    reasoning: 'Finalizing v1.0.2 Practical MVP milestone.',
    risks: ['Potential state file corruption if write fails', 'Incomplete smoke test coverage']
  };

  const summary = generateApprovalSummary(sampleApproval);
  console.log(summary);
}
