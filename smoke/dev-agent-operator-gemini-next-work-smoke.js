/**
 * Smoke test for Operator Gemini Next Work Pack v1.1.4
 */

const { prepareGeminiTask } = require('../tools/operator-gemini-next-work-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Gemini Next Work Pack v1.1.4');

  const packet = prepareGeminiTask({
    phase: 'v2.0.0',
    scope: ['test'],
    prohibited: ['shell'],
    reporting: 'report'
  });

  if (!packet.taskPacket.title.includes('v2.0.0')) throw new Error('Phase missing in title');
  if (!packet.taskPacket.instructions.some(i => i.includes('DO NOT execute any shell commands'))) {
    throw new Error('Crucial constraint missing');
  }

  console.log('Smoke test PASSED');
  return {
    version: '1.1.4',
    purpose: 'Operator Gemini Next Work Pack Smoke Test',
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
