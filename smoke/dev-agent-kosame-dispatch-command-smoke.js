'use strict';
const { executeDispatchCommand, DISPATCH_TARGETS } = require('../tools/kosame-dispatch-command');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('=== kosame-dispatch-command smoke ===');

// Test 1: repair task → Claude
const r1 = executeDispatchCommand({
  task_type: 'repair',
  needs_repair: true,
  verify_status: 'failed',
  risk_level: 'Low'
});
assert('command field', r1.command === 'kosame dispatch');
assert('repair → claude', r1.target === DISPATCH_TARGETS.CLAUDE);
assert('version 2.6.0', r1.version === '2.6.0');
assert('dryRun true', r1.dryRun === true);
assert('not human approval', r1.human_approval_required === false);

// Test 2: bulk gen + gemini available → Gemini
const r2 = executeDispatchCommand({
  task_type: 'bulk_generation',
  needs_bulk_gen: true,
  gemini_available: true,
  verify_status: 'passed',
  risk_level: 'Low'
});
assert('bulk gen + gemini: gemini', r2.target === DISPATCH_TARGETS.GEMINI);

// Test 3: bulk gen + gemini unavailable → Claude fallback
const r3 = executeDispatchCommand({
  task_type: 'bulk_generation',
  needs_bulk_gen: true,
  gemini_available: false,
  verify_status: 'passed',
  risk_level: 'Low'
});
assert('bulk gen + no gemini: claude fallback', r3.target === DISPATCH_TARGETS.CLAUDE);

// Test 4: Critical risk → Human
const r4 = executeDispatchCommand({
  task_type: 'deploy',
  risk_level: 'Critical'
});
assert('critical: human', r4.target === DISPATCH_TARGETS.HUMAN);
assert('critical: human_approval_required', r4.human_approval_required === true);

// Test 5: dangerous action → Human
const r5 = executeDispatchCommand({
  dangerous_actions: ['git push origin main'],
  risk_level: 'Low'
});
assert('dangerous action: human', r5.target === DISPATCH_TARGETS.HUMAN);
assert('dangerous action: has_dangerous', r5.has_dangerous === true);

// Test 6: High risk → Human
const r6 = executeDispatchCommand({ risk_level: 'High' });
assert('high risk: human', r6.target === DISPATCH_TARGETS.HUMAN);

// Test 7: standard task → Claude
const r7 = executeDispatchCommand({ task_type: 'implementation', risk_level: 'Low' });
assert('standard: claude', r7.target === DISPATCH_TARGETS.CLAUDE);

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
