'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/approval-packet-practical-review-runner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== approval-packet-practical-review-runner-pack smoke ===');

assert.ok(compareVersion(pkg.version, '14.5.0') >= 0, `package version must be 14.5.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 14.5.0 or later');

assert.ok(pkg.scripts['smoke:approval-packet-practical-review-runner'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:approval-packet-practical-review-runner'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v14.5.0-release-record.md')),
  'v14.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/approval-packet-practical-review.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '14.5.0', 'tool meta version must be 14.5.0');
console.log('  PASS: tool meta version 14.5.0');

const approvalPacket = {
  dryRun: true,
  humanApprovalRequired: true,
  taskGoal: 'README.mdにv14.5.0の説明を追加する',
  approvalSummary: {
    taskGoal: 'README.mdにv14.5.0の説明を追加する',
    riskLevel: 'low',
    targetFiles: ['README.md']
  },
  yesNoDecisionPacket: {
    approveToDeploy:       false,
    approveToReadSecrets:  false,
    approveToUseRealApi:   false
  },
  executionReadiness: {
    claudePromptReady:     true,
    verificationPlanReady: true,
    rollbackNoteReady:     true,
    readyToProceed:        false
  },
  rollbackNote: 'git checkout -- README.md',
  noRealApiExecution: true,
  noRealFileEdit:     true
};

const result = tool.buildReviewRunner({ approvalPacket, riskLevel: 'low' });

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.reviewerId, 'reviewerId must be present');
console.log('  PASS: reviewerId present');

assert.ok(result.checklist, 'checklist must be present');
console.log('  PASS: checklist present');

assert.ok(typeof result.checklistPassed === 'boolean', 'checklistPassed must be boolean');
console.log('  PASS: checklistPassed is boolean');

assert.ok(Array.isArray(result.dangerousActionsFound), 'dangerousActionsFound must be array');
console.log('  PASS: dangerousActionsFound is array');

assert.ok(Array.isArray(result.missingApprovalItems), 'missingApprovalItems must be array');
console.log('  PASS: missingApprovalItems is array');

assert.ok(tool.FINAL_DECISION_OPTIONS.includes(result.finalDecision), 'finalDecision must be valid option');
console.log(`  PASS: finalDecision is valid (${result.finalDecision})`);

assert.ok(Array.isArray(result.finalDecisionOptions), 'finalDecisionOptions must be array');
assert.ok(result.finalDecisionOptions.includes('approve'), 'must include approve');
assert.ok(result.finalDecisionOptions.includes('revise'),  'must include revise');
assert.ok(result.finalDecisionOptions.includes('reject'),  'must include reject');
assert.ok(result.finalDecisionOptions.includes('hold'),    'must include hold');
console.log('  PASS: finalDecisionOptions includes approve/revise/reject/hold');

assert.ok(Array.isArray(result.dangerousActionGates), 'dangerousActionGates must be array');
assert.ok(result.dangerousActionGates.includes('git push'), 'must include git push');
assert.ok(result.dangerousActionGates.includes('git commit'), 'must include git commit');
assert.ok(result.dangerousActionGates.includes('deploy'),   'must include deploy');
console.log('  PASS: dangerousActionGates valid');

assert.ok(typeof result.safeNextAction === 'string' && result.safeNextAction.length > 0, 'safeNextAction must be string');
console.log('  PASS: safeNextAction present');

assert.strictEqual(result.noRealApiExecution, true, 'noRealApiExecution must be true');
assert.strictEqual(result.noRealExecution,    true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

console.log('PASS: approval-packet-practical-review-runner-pack');
