/**
 * Smoke Test: v2.5.0 Release Record
 */
const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: v2.5.0 Release Record');

  const docPath = path.resolve('docs/ai-dev-team/kosame-dev-orchestra-v2.5.0-release-record.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  const required = [
    'v2.5.0',
    'Dev Orchestra Semi-Auto Operation Pack',
    'Semi-Auto Operation Policy',
    'Human Approval Gate',
    'Provider Fallback Controller',
    'Verify to Commit',
    'Release Readiness'
  ];
  for (const r of required) {
    if (!content.includes(r)) throw new Error(`Missing in release record: ${r}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'v2.5.0 Release Record Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
