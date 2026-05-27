'use strict';
const { generateCommitDecisionReport } = require('../tools/commit-decision-report');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== commit-decision-report smoke ===');

// YES case
const r1 = generateCommitDecisionReport({ verifyStatus: 'passed', workingTreeClean: false, repo: { uncommittedFiles: ['tools/foo.js'] } });
assert('report field', r1.report === 'commit-decision-report');
assert('YES: recommendation', r1.recommendation === 'YES');
assert('YES: humanApprovalRequired false', r1.humanApprovalRequired === false);
assert('version 3.3.0', r1.version === '3.3.0');
assert('dryRun true', r1.dryRun === true);

// HOLD case (verify not_run)
const r2 = generateCommitDecisionReport({ verifyStatus: 'not_run', workingTreeClean: false });
assert('HOLD: verify not_run', r2.recommendation === 'HOLD');

// NO case (verify failed)
const r3 = generateCommitDecisionReport({ verifyStatus: 'failed', workingTreeClean: false });
assert('NO: verify failed', r3.recommendation === 'NO');
assert('NO: blockers', r3.blockers.length > 0);

// HOLD: no changes
const r4 = generateCommitDecisionReport({ verifyStatus: 'passed', workingTreeClean: true, repo: { uncommittedFiles: [] } });
assert('HOLD: no changes', r4.recommendation === 'HOLD');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
