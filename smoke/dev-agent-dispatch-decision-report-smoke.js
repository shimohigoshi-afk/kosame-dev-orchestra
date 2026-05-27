'use strict';
const { generateDispatchDecisionReport, TARGETS } = require('../tools/dispatch-decision-report');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== dispatch-decision-report smoke ===');

// Repair → Claude
const r1 = generateDispatchDecisionReport({ verifyStatus: 'failed', taskHints: { needsRepair: true } });
assert('report field', r1.report === 'dispatch-decision-report');
assert('repair: target claude', r1.target === TARGETS.CLAUDE);
assert('version 3.3.0', r1.version === '3.3.0');
assert('dryRun true', r1.dryRun === true);

// Bulk gen + gemini → Gemini
const r2 = generateDispatchDecisionReport({ verifyStatus: 'passed', actionsStatus: 'success', geminiAvailable: true, taskHints: { needsBulkGen: true } });
assert('bulk+gemini: target gemini', r2.target === TARGETS.GEMINI);

// Bulk gen, no gemini → Claude fallback
const r3 = generateDispatchDecisionReport({ verifyStatus: 'passed', geminiAvailable: false, taskHints: { needsBulkGen: true } });
assert('bulk no gemini: claude fallback', r3.target === TARGETS.CLAUDE);

// Critical → Human
const r4 = generateDispatchDecisionReport({ taskHints: { riskLevel: 'Critical' } });
assert('critical: human', r4.target === TARGETS.HUMAN);
assert('critical: humanApprovalRequired', r4.humanApprovalRequired === true);

// Commit-ready → Cloud Shell
const r5 = generateDispatchDecisionReport({
  verifyStatus: 'passed', workingTreeClean: false, actionsStatus: 'unknown',
  taskHints: { riskLevel: 'Low' }
});
assert('commit-ready: cloud_shell', r5.target === TARGETS.CLOUD_SHELL);

// TARGETS export
assert('TARGETS.CLAUDE', TARGETS.CLAUDE === 'claude');
assert('TARGETS.HUMAN', TARGETS.HUMAN === 'human_approval');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
