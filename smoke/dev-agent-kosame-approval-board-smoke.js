'use strict';
const { buildApprovalBoard, buildBoardRow, BOARD_VERSION, OPERATIONS, DANGEROUS_ACTIONS } = require('../tools/kosame-approval-board');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-approval-board smoke ===');

const GREEN = {
  verifyStatus: 'passed',
  actionsStatus: 'success',
  workingTreeClean: true,
  isAhead: false,
  hasUncommittedChanges: false,
  releaseDocsExist: true,
  openIssues: []
};

const DIRTY = {
  verifyStatus: 'failed',
  actionsStatus: 'failed',
  workingTreeClean: false,
  isAhead: true,
  hasUncommittedChanges: true,
  releaseDocsExist: false,
  openIssues: ['verify FAIL: some-smoke']
};

// --- buildBoardRow individual ---
const commit_green = buildBoardRow('commit', { ...GREEN, hasUncommittedChanges: true });
assert('commit green: recommendation YES', commit_green.recommendation === 'YES');
assert('commit green: humanApproval false', commit_green.humanApprovalRequired === false);
assert('commit green: requiredEvidence', Array.isArray(commit_green.requiredEvidence));
assert('commit green: safeNextStep string', typeof commit_green.safeNextStep === 'string');

const commit_dirty = buildBoardRow('commit', DIRTY);
assert('commit dirty: recommendation HOLD', commit_dirty.recommendation === 'HOLD');

const push_green_ahead = buildBoardRow('push', { ...GREEN, isAhead: true });
assert('push ahead: recommendation YES', push_green_ahead.recommendation === 'YES');
assert('push: humanApproval always true', push_green_ahead.humanApprovalRequired === true);
assert('push: dangerousActions not empty', push_green_ahead.dangerousActions.length > 0);

const push_not_ahead = buildBoardRow('push', GREEN);
assert('push not ahead: HOLD', push_not_ahead.recommendation === 'HOLD');

const push_dirty = buildBoardRow('push', DIRTY);
assert('push dirty: NO', push_dirty.recommendation === 'NO');

const tag_green = buildBoardRow('tag', GREEN);
assert('tag green: YES', tag_green.recommendation === 'YES');
assert('tag: humanApproval true', tag_green.humanApprovalRequired === true);
assert('tag: dangerousActions', tag_green.dangerousActions.some(d => d.includes('git tag')));

const tag_failed = buildBoardRow('tag', DIRTY);
assert('tag failed actions: NO', tag_failed.recommendation === 'NO');

const release_green = buildBoardRow('release', GREEN);
assert('release green: YES', release_green.recommendation === 'YES');
assert('release: humanApproval true', release_green.humanApprovalRequired === true);

const release_failed = buildBoardRow('release', DIRTY);
assert('release failed: NO', release_failed.recommendation === 'NO');

const dispatch_any = buildBoardRow('dispatch', GREEN);
assert('dispatch: always YES', dispatch_any.recommendation === 'YES');
assert('dispatch: humanApproval false', dispatch_any.humanApprovalRequired === false);

const handoff_clean = buildBoardRow('handoff', GREEN);
assert('handoff clean: YES', handoff_clean.recommendation === 'YES');
assert('handoff: humanApproval false', handoff_clean.humanApprovalRequired === false);

const handoff_dirty = buildBoardRow('handoff', DIRTY);
assert('handoff dirty: HOLD', handoff_dirty.recommendation === 'HOLD');

// --- buildApprovalBoard (full) ---
const b1 = buildApprovalBoard({
  snapshot: { ...GREEN, hasUncommittedChanges: false },
  session_id: 'smoke-001',
  sessionGoal: 'v3.8.0 smoke'
});
assert('board field', b1.board === 'kosame-approval-board');
assert('board version 3.8.0', b1.version === '3.8.0');
assert('board dryRun', b1.dryRun === true);
assert('board session_id', b1.session_id === 'smoke-001');
assert('board rows count', b1.rows.length === OPERATIONS.length);
assert('board totalItems', b1.totalItems === OPERATIONS.length);
assert('board humanYesCompression', typeof b1.humanYesCompression === 'object');
assert('board needsJunyaYes array', Array.isArray(b1.humanYesCompression.needsJunyaYes));
assert('board cannotYes array', Array.isArray(b1.humanYesCompression.cannotYes));
assert('board aiCanContinue array', Array.isArray(b1.humanYesCompression.aiCanContinue));
assert('board cloudShellCheck array', Array.isArray(b1.humanYesCompression.cloudShellCheck));
assert('board boardSummary string', typeof b1.boardSummary === 'string');
assert('board boardSummary has じゅんやさん', b1.boardSummary.includes('じゅんやさん'));
assert('board requiresJunyaYes bool', typeof b1.requiresJunyaYes === 'boolean');
assert('green: tag/release need YES', b1.humanYesCompression.needsJunyaYes.includes('tag') || b1.humanYesCompression.needsJunyaYes.includes('release'));
assert('green: dispatch AI可能', b1.humanYesCompression.aiCanContinue.includes('dispatch'));

// dirty board
const b2 = buildApprovalBoard({ snapshot: DIRTY });
assert('dirty: cannotYes not empty', b2.humanYesCompression.cannotYes.length > 0);
assert('dirty: requiresJunyaYes false (nothing YES + approval)', !b2.requiresJunyaYes);

// --- exports ---
assert('BOARD_VERSION 3.8.0', BOARD_VERSION === '3.8.0');
assert('OPERATIONS array 6', OPERATIONS.length === 6);
assert('OPERATIONS has push', OPERATIONS.includes('push'));
assert('OPERATIONS has release', OPERATIONS.includes('release'));
assert('DANGEROUS_ACTIONS push has git push', DANGEROUS_ACTIONS.push.some(d => d.includes('git push')));
assert('DANGEROUS_ACTIONS commit empty', DANGEROUS_ACTIONS.commit.length === 0);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
