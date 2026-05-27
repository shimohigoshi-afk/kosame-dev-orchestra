'use strict';
const { generateHumanApprovalSummary } = require('../tools/human-approval-summary-generator');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== human-approval-summary-generator smoke ===');

const r1 = generateHumanApprovalSummary({
  actionTitle: 'v2.8.0 tag & push',
  actionType: 'git_tag',
  requestedBy: 'こさめ副社長',
  dangerousCommands: ['git tag v2.8.0', 'git push origin v2.8.0'],
  riskLevel: 'High',
  recommendation: 'YES',
  reason: 'Actions PASS / verify全通過',
  consequences: ['タグ作成', 'remote push'],
  alternativeIfNo: 'キャンセル'
});

assert('generator field', r1.generator === 'human-approval-summary-generator');
assert('version 2.8.0', r1.version === '2.8.0');
assert('dryRun true', r1.dryRun === true);
assert('requiresApproval: High risk', r1.requiresApproval === true);
assert('approvalGate gate_required', r1.approvalGate.gate_required === true);
assert('approvalGate waiting_for human', r1.approvalGate.waiting_for === 'human_yes_no');
assert('summary is string', typeof r1.summary === 'string');
assert('summary contains action title', r1.summary.includes('v2.8.0 tag & push'));
assert('summary contains commands', r1.summary.includes('git tag v2.8.0'));
assert('summary contains じゅんやさん', r1.summary.includes('じゅんやさん'));
assert('dangerousCommands len 2', r1.dangerousCommands.length === 2);
assert('alternativeIfNo set', r1.alternativeIfNo === 'キャンセル');

// Test: Critical actionType
const r2 = generateHumanApprovalSummary({ actionType: 'git_tag', riskLevel: 'Critical' });
assert('critical: requiresApproval true', r2.requiresApproval === true);

// Test: Low risk / general → no approval required
const r3 = generateHumanApprovalSummary({ actionType: 'general', riskLevel: 'Low' });
assert('low risk: requiresApproval false', r3.requiresApproval === false);
assert('low risk: gate_required false', r3.approvalGate.gate_required === false);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
