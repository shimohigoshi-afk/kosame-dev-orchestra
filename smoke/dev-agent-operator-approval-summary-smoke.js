/**
 * Smoke test for Operator Approval Summary v1.0.4
 */

const { generateApprovalSummary } = require('../tools/operator-approval-summary.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Approval Summary v1.0.4');

  const sampleApproval = {
    action: 'Test Action',
    agent: 'Test Agent',
    risk: 'Low',
    changes: ['Change 1'],
    reasoning: 'Reasoning',
    risks: ['Risk 1']
  };

  const summary = generateApprovalSummary(sampleApproval);

  if (!summary.includes('Approval Request: Test Action')) throw new Error('Action name missing');
  if (!summary.includes('Low')) throw new Error('Risk level missing');
  if (!summary.includes('Approve')) throw new Error('Options missing');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.4',
    purpose: 'Operator Approval Summary Smoke Test',
    status: 'passed',
    dryRun: true
  };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
