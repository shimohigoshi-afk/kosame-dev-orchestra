/**
 * Smoke test for Operator Claude Escalation Pack v1.1.3
 */

const { prepareEscalation } = require('../tools/operator-claude-escalation-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Claude Escalation Pack v1.1.3');

  const packet = prepareEscalation({
    feature: 'Test',
    failedSmoke: ['test.js'],
    errorLog: 'error',
    safeFiles: ['safe.js'],
    protectedFiles: ['protected.js'],
    verifyCmd: 'verify'
  });

  if (!packet.escalationPacket.handoff.includes('senior technical consultant')) {
    // Wait, I didn't add that exact phrase to the tool output, let me check.
    // Ah, it says "senior technical expertise".
  }
  
  if (!packet.escalationPacket.handoff.includes('senior technical expertise')) throw new Error('Handoff message missing tone');
  if (packet.escalationPacket.context.failedSmoke[0] !== 'test.js') throw new Error('Context data missing');

  console.log('Smoke test PASSED');
  return {
    version: '1.1.3',
    purpose: 'Operator Claude Escalation Pack Smoke Test',
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
