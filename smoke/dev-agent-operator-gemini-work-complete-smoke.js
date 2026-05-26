/**
 * Smoke test for Operator Gemini Work Complete Pack v1.3.3
 */

const { generateGeminiWorkComplete } = require('../tools/operator-gemini-work-complete-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Gemini Work Complete Pack v1.3.3');

  const result = generateGeminiWorkComplete();
  if (result.version !== '1.3.3') throw new Error('Version mismatch');
  if (result.type !== 'gemini-work-complete') throw new Error('Type mismatch');
  if (!Array.isArray(result.completedWork)) throw new Error('completedWork not an array');
  if (result.completedWork.length === 0) throw new Error('completedWork is empty');
  if (!result.dryRun) throw new Error('dryRun flag missing');

  const custom = generateGeminiWorkComplete({ stopReason: 'MANUAL_STOP' });
  if (custom.stopReason !== 'MANUAL_STOP') throw new Error('Custom stopReason not applied');

  console.log('Smoke test PASSED');
  return {
    version: '1.3.3',
    purpose: 'Operator Gemini Work Complete Pack Smoke Test',
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
