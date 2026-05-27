/**
 * Smoke Test: Kosame Approval Delegation Policy v2.1.0
 */

const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: Kosame Approval Delegation Policy v2.1.0');

  const docPath = path.resolve('docs/ai-dev-team/kosame-approval-delegation-v2.1.0.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  const kosameItems = ['routing推奨', 'proceed推奨', 'repair推奨', 'commit推奨', 'fallback推奨'];
  const junyaItems = ['git push', 'git tag', 'deploy', 'Cloud Run', 'Secret'];

  for (const item of kosameItems) {
    if (!content.includes(item)) throw new Error(`Missing kosame delegation item: ${item}`);
  }
  for (const item of junyaItems) {
    if (!content.includes(item)) throw new Error(`Missing junya approval item: ${item}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Kosame Approval Delegation Smoke Test', status: 'passed', dryRun: true };
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
