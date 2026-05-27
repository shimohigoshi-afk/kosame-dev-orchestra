'use strict';
const { generateVpHandoffPacket } = require('../tools/vp-handoff-packet');
const { extractApprovalItems, checkRequiresApproval, APPROVAL_REQUIRED_OPERATIONS } = require('../tools/vp-human-approval-gate');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== vp-handoff-packet + vp-human-approval-gate smoke ===');

// --- vp-handoff-packet ---

// basic handoff
const h1 = generateVpHandoffPacket({
  sessionId: 'session-001',
  sessionGoal: 'v3.5.0実装',
  completedActions: ['state-reader実装', 'decision-report実装'],
  currentState: { verifyStatus: 'passed', actionsStatus: 'success', workingTreeClean: true, overallHealth: 'healthy', branch: 'main' },
  pendingApprovals: ['git push origin main (じゅんやさんYES待ち)'],
  nextRecommendedAction: 'git pushをじゅんやさんに依頼',
  openIssues: [],
  geminiStatus: 'gemini_auth_error',
  packageVersion: '3.5.0'
});
assert('packet field', h1.packet === 'vp-handoff-packet');
assert('version 3.5.0', h1.version === '3.5.0');
assert('dryRun true', h1.dryRun === true);
assert('session_id', h1.session_id === 'session-001');
assert('readyForHandoff: no open issues + verify passed', h1.readyForHandoff === true);
assert('hasPendingApprovals true', h1.hasPendingApprovals === true);
assert('handoffNote is string', typeof h1.handoffNote === 'string');
assert('handoffNote has 引継ぎ', h1.handoffNote.includes('引継ぎ'));
assert('handoffNote has sessionGoal', h1.handoffNote.includes('v3.5.0実装'));
assert('handoffNote has nextAction', h1.handoffNote.includes('git push'));
assert('handoffNote has geminiStatus', h1.handoffNote.includes('gemini_auth_error'));
assert('completedActions count', h1.completedActions.length === 2);

// readyForHandoff: false when verify failed
const h2 = generateVpHandoffPacket({
  currentState: { verifyStatus: 'failed', actionsStatus: 'unknown', workingTreeClean: false, overallHealth: 'critical' },
  openIssues: ['verify FAIL: some-smoke'],
  packageVersion: '3.5.0'
});
assert('not ready: verify failed', h2.readyForHandoff === false);
assert('hasOpenIssues true', h2.hasOpenIssues === true);
assert('openIssues count', h2.openIssues.length === 1);
assert('no pending approvals', h2.hasPendingApprovals === false);

// session_id fallback
const h3 = generateVpHandoffPacket({ session_id: 'fallback-id', packageVersion: '3.5.0' });
assert('session_id fallback', h3.session_id === 'fallback-id');
assert('readyForHandoff: default no openIssues + not_run', h3.readyForHandoff === true);

// --- vp-human-approval-gate ---

// push YES + release NO → 1 item
const g1 = extractApprovalItems({
  push: { recommendation: 'YES', gate_required: true, branch: 'main', reason: 'verify passed', gate_reason: 'push needs approval' },
  release: { recommendation: 'NO', gate_required: true }
});
assert('gate field', g1.gate === 'vp-human-approval-gate');
assert('gate version 3.5.0', g1.version === '3.5.0');
assert('gate dryRun', g1.dryRun === true);
assert('push YES: hasItems true', g1.hasItems === true);
assert('push YES: itemCount 1', g1.itemCount === 1);
assert('push YES: operation', g1.items[0].operation === 'push');
assert('push YES: priority high', g1.items[0].priority === 'high');
assert('summary contains 1件', g1.summary.includes('1件'));

// push YES + release YES → 2 items
const g2 = extractApprovalItems({
  push: { recommendation: 'YES', gate_required: true, branch: 'main', reason: 'push ready', gate_reason: 'approval required' },
  release: { recommendation: 'YES', gate_required: true, reason: 'release ready', tagCommands: ['git tag v3.5.0', 'git push origin v3.5.0'] }
});
assert('2 items: hasItems', g2.hasItems === true);
assert('2 items: itemCount', g2.itemCount === 2);
assert('release item: tagCommands', g2.items[1].commands.length === 2);

// no items
const g3 = extractApprovalItems({
  push: { recommendation: 'HOLD', gate_required: true },
  release: { recommendation: 'NO', gate_required: true }
});
assert('no items: hasItems false', g3.hasItems === false);
assert('no items: summary なし', g3.summary.includes('ありません'));

// custom items
const g4 = extractApprovalItems({
  custom: [{ operation: 'custom-deploy', requiresHumanApproval: true, reason: 'custom approval' }]
});
assert('custom: hasItems', g4.hasItems === true);
assert('custom: priority normal', g4.items[0].priority === 'normal');

// checkRequiresApproval
assert('checkRequiresApproval: push', checkRequiresApproval('git push origin main') === true);
assert('checkRequiresApproval: deploy', checkRequiresApproval('gcloud run deploy') === true);
assert('checkRequiresApproval: verify (not required)', checkRequiresApproval('npm run verify') === false);

// APPROVAL_REQUIRED_OPERATIONS
assert('APPROVAL_REQUIRED_OPERATIONS: array', Array.isArray(APPROVAL_REQUIRED_OPERATIONS));
assert('APPROVAL_REQUIRED_OPERATIONS: has push', APPROVAL_REQUIRED_OPERATIONS.includes('git push'));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
