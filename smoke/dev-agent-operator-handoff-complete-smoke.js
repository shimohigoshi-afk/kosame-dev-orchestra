/**
 * Smoke test for Operator Handoff Complete Pack v1.3.1
 */

const { generateFinalHandoff, renderHandoffMarkdown } = require('../tools/operator-handoff-complete-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Handoff Complete Pack v1.3.1');

  const handoff = generateFinalHandoff();
  if (handoff.version !== '2.0.0') throw new Error('Default version mismatch');
  if (handoff.status !== 'COMPLETE') throw new Error('Status should be COMPLETE');
  if (!Array.isArray(handoff.completedWork)) throw new Error('completedWork not an array');
  if (handoff.completedWork.length === 0) throw new Error('completedWork is empty');
  if (!handoff.dryRun) throw new Error('dryRun flag missing');

  const custom = generateFinalHandoff({ version: '1.3.1', completedWork: ['Pack A'] });
  if (custom.version !== '1.3.1') throw new Error('Custom version not applied');

  const md = renderHandoffMarkdown(handoff);
  if (typeof md !== 'string') throw new Error('Markdown output should be a string');
  if (!md.includes('# Operator Handoff')) throw new Error('Markdown header missing');

  console.log('Smoke test PASSED');
  return {
    version: '1.3.1',
    purpose: 'Operator Handoff Complete Pack Smoke Test',
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
