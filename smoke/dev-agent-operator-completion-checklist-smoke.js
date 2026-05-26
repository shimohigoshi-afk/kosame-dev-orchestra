/**
 * Smoke test for Operator Completion Checklist Pack v1.2.3
 */

const { generateChecklist, CHECKLIST_ITEMS } = require('../tools/operator-completion-checklist-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Completion Checklist Pack v1.2.3');

  const empty = generateChecklist();
  if (empty.version !== '1.2.3') throw new Error('Version mismatch');
  if (empty.status !== 'INCOMPLETE') throw new Error('Empty checklist should be INCOMPLETE');
  if (empty.summary.completed !== 0) throw new Error('No items should be completed');

  const allIds = CHECKLIST_ITEMS.map(i => i.id);
  const full = generateChecklist(allIds);
  if (full.status !== 'COMPLETE') throw new Error('All items checked should be COMPLETE');
  if (full.summary.allRequiredDone !== true) throw new Error('All required should be done');

  console.log('Smoke test PASSED');
  return {
    version: '1.2.3',
    purpose: 'Operator Completion Checklist Pack Smoke Test',
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
