/**
 * Smoke Test: Yes Hell Reduction Approval Packet v2.1.0
 */

const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: Yes Hell Reduction Approval Packet v2.1.0');

  const docPath = path.resolve('docs/ai-dev-team/yes-hell-reduction-approval-packet-v2.1.0.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  const requiredFields = [
    '推奨：',
    '理由：',
    '残リスク：',
    '危険操作：',
    'じゅんやさんの操作：',
    'AI側で完了済みの確認：',
    '次アクション：'
  ];

  for (const field of requiredFields) {
    if (!content.includes(field)) throw new Error(`Missing approval packet field: ${field}`);
  }

  if (!content.includes('YES / NO / HOLD')) throw new Error('Missing YES/NO/HOLD options');

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Yes Hell Reduction Approval Packet Smoke Test', status: 'passed', dryRun: true };
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
