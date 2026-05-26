/**
 * Smoke test for Operator Next Action Engine v1.0.3
 */

const { determineNextAction } = require('../tools/operator-next-action-engine.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Next Action Engine v1.0.3');

  // Test Human Approval Rule
  const highRiskState = { riskLevel: 'High' };
  const highRiskResult = determineNextAction(highRiskState);
  if (highRiskResult.nextAction !== 'human_approval_required') throw new Error('High risk rule failed');

  // Test Claude Escalation Rule
  const failedState = { workflowStatus: 'Failed', riskLevel: 'Low' };
  const failedResult = determineNextAction(failedState);
  if (failedResult.nextAction !== 'send_to_claude') throw new Error('Claude escalation rule failed');

  // Test Run Verify Rule
  const idleState = { workflowStatus: 'Idle', riskLevel: 'Low' };
  const idleResult = determineNextAction(idleState);
  if (idleResult.nextAction !== 'run_verify') throw new Error('Run verify rule failed');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.3',
    purpose: 'Operator Next Action Engine Smoke Test',
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
