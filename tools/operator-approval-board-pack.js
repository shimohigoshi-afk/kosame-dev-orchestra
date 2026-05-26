/**
 * Operator Approval Board Pack
 * v0.7.5
 */

function categorizeApprovals(approvals, riskLevel) {
  return approvals.map(item => {
    let recommendation = 'hold';
    
    if (riskLevel === 'Low') {
      recommendation = 'approve';
    } else if (riskLevel === 'Medium') {
      recommendation = 'approve';
    } else if (riskLevel === 'High') {
      recommendation = 'send_to_claude';
    } else if (riskLevel === 'Critical') {
      recommendation = 'reject';
    }

    return {
      item,
      riskLevel,
      recommendation,
      status: 'pending'
    };
  });
}

module.exports = { categorizeApprovals };
