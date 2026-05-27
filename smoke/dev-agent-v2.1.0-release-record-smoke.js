/**
 * Smoke Test: v2.1.0 Release Record
 */

const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: v2.1.0 Release Record');

  const docPath = path.resolve('docs/ai-dev-team/kosame-dev-orchestra-v2.1.0-release-record.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  if (!content.includes('v2.1.0')) throw new Error('Missing v2.1.0 in release record');
  if (!content.includes('AI Provider Routing')) throw new Error('Missing feature title');
  if (!content.includes('Kosame Approval Delegation')) throw new Error('Missing feature title');
  if (!content.includes('次フェーズ候補')) throw new Error('Missing next phase section');
  if (!content.includes('未完成範囲')) throw new Error('Missing incomplete section');
  if (!content.includes('Claude係長')) throw new Error('Missing team contribution');

  // Verify all 7 implementation items are documented
  const items = [
    'Provider Routing Policy',
    'Gemini Failure Fallback',
    'Kosame Approval Delegation',
    'Yes Hell Reduction',
    'Operator Decision Engine',
    'Provider Health Status',
    'Fallback Routing Packet'
  ];

  for (const item of items) {
    if (!content.includes(item)) throw new Error(`Missing implementation item: ${item}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'v2.1.0 Release Record Smoke Test', status: 'passed', dryRun: true };
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
