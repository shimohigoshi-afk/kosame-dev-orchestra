/**
 * Smoke test for Operator Claude Emotional Escalation Complete Pack v1.3.2
 */

const { generateClaudeEscalationComplete } = require('../tools/operator-claude-emotional-escalation-complete-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Claude Emotional Escalation Complete Pack v1.3.2');

  const result = generateClaudeEscalationComplete();
  if (result.version !== '1.3.2') throw new Error('Version mismatch');
  if (result.type !== 'claude-escalation-complete') throw new Error('Type mismatch');
  if (result.completionStatus !== 'COMPLETE') throw new Error('Completion status mismatch');
  if (!result.dryRun) throw new Error('dryRun flag missing');

  const custom = generateClaudeEscalationComplete({ situation: 'Custom situation' });
  if (custom.situation !== 'Custom situation') throw new Error('Custom context not applied');

  console.log('Smoke test PASSED');
  return {
    version: '1.3.2',
    purpose: 'Operator Claude Emotional Escalation Complete Pack Smoke Test',
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
