'use strict';
const {
  runPracticalConsole,
  buildVpDecisionPacket,
  CONSOLE_VERSION,
  COMMAND_MAP,
  SAFE_COMMAND_BOUNDARY,
  FORBIDDEN_ACTIONS
} = require('../tools/kosame-vp-practical-console');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-vp-practical-console smoke ===');

const GREEN_INPUT = {
  rawData: {
    packageVersion: '4.0.0',
    repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
    actions: { status: 'success', conclusion: 'success', jobResults: [] },
    verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
    providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
  },
  sessionGoal: 'v4.0.0 smoke test',
  session_id: 'smoke-v4'
};

// --- status command ---
const s1 = runPracticalConsole('status', GREEN_INPUT);
assert('console field', s1.console === 'kosame-vp-practical-console');
assert('version 4.0.0', s1.version === '4.0.0');
assert('dryRun true', s1.dryRun === true);
assert('command status', s1.command === 'status');
assert('status: recommendation YES', s1.recommendation === 'YES');
assert('status: risk low', s1.risk === 'low');
assert('status: has decisionPacket', s1.decisionPacket && s1.decisionPacket.packet === 'vp-practical-decision-packet');
assert('status: decisionPacket topPriority', s1.decisionPacket.topPriority && 'action' in s1.decisionPacket.topPriority);
assert('status: commandMap', typeof s1.commandMap === 'object');
assert('status: safeCommandBoundary', typeof s1.safeCommandBoundary === 'object');
assert('status: safeCommandBoundary.proposable', Array.isArray(s1.safeCommandBoundary.proposable));
assert('status: safeCommandBoundary.neverGenerate', Array.isArray(s1.safeCommandBoundary.neverGenerate));
assert('status: neverGenerate has rm -rf', s1.safeCommandBoundary.neverGenerate.some(c => c.includes('rm -rf')));
assert('status: session_id', s1.session_id === 'smoke-v4');

// --- commit-check ---
const c1 = runPracticalConsole('commit-check', GREEN_INPUT);
assert('commit-check: command', c1.command === 'commit-check');
assert('commit-check: recommendation string', ['YES', 'NO', 'HOLD'].includes(c1.recommendation));
assert('commit-check: humanApproval false', c1.humanApprovalRequired === false);

// --- push-check (always humanApproval true) ---
const p1 = runPracticalConsole('push-check', GREEN_INPUT);
assert('push-check: humanApproval true', p1.humanApprovalRequired === true);
assert('push-check: risk high', p1.risk === 'high');

// --- release-check (always humanApproval true) ---
const r1 = runPracticalConsole('release-check', GREEN_INPUT);
assert('release-check: humanApproval true', r1.humanApprovalRequired === true);
assert('release-check: risk high', r1.risk === 'high');

// --- dispatch ---
const d1 = runPracticalConsole('dispatch', GREEN_INPUT);
assert('dispatch: command', d1.command === 'dispatch');
assert('dispatch: humanApproval false', d1.humanApprovalRequired === false);

// --- next ---
const n1 = runPracticalConsole('next', GREEN_INPUT);
assert('next: command', n1.command === 'next');
assert('next: recommendation YES', n1.recommendation === 'YES');

// --- approval-board (special) ---
const a1 = runPracticalConsole('approval-board', GREEN_INPUT);
assert('approval-board: console', a1.console === 'kosame-vp-practical-console');
assert('approval-board: board field', a1.board && a1.board.board === 'kosame-approval-board');
assert('approval-board: board rows', a1.board.rows.length === 6);
assert('approval-board: requiresJunyaYes bool', typeof a1.requiresJunyaYes === 'boolean');
assert('approval-board: boardSummary string', typeof a1.board.boardSummary === 'string');

// --- handoff (special) ---
const h1 = runPracticalConsole('handoff', {
  ...GREEN_INPUT,
  completedWork: ['v3.6.0 CLI Runner', 'v3.7.0 Real Snapshot'],
  nextRecommendedAction: 'npm run verify',
  humanApprovalStatus: '承認待ちなし',
  handoffTone: 'concise'
});
assert('handoff: console', h1.console === 'kosame-vp-practical-console');
assert('handoff: handoffResult', h1.handoffResult && h1.handoffResult.generator === 'kosame-handoff-auto-generator');
assert('handoff: handoffNote string', typeof h1.handoffResult.handoffNote === 'string');
assert('handoff: tone concise', h1.handoffResult.tone === 'concise');

// --- textInputs path ---
const t1 = runPracticalConsole('status', {
  textInputs: {
    packageJsonText: '{"version":"4.0.0"}',
    gitStatusText: '## main...origin/main\n',
    ghRunListText: 'completed\tsuccess\tKOSAME Verify\n',
    verifyLogText: 'PASS: 169 / 169\nEXIT:0\n'
  },
  session_id: 'text-path'
});
assert('textInputs path: console', t1.console === 'kosame-vp-practical-console');
assert('textInputs path: snapshotSource text', t1.snapshotSource === 'text');

// --- buildVpDecisionPacket ---
const dp = buildVpDecisionPacket({ verifyStatus: 'failed', actionsStatus: 'success', workingTreeClean: true }, 'smoke');
assert('decisionPacket: packet field', dp.packet === 'vp-practical-decision-packet');
assert('decisionPacket: version 4.0.0', dp.version === '4.0.0');
assert('decisionPacket: topPriority', dp.topPriority && 'action' in dp.topPriority);
assert('decisionPacket: verify_failed → fix_verify', dp.topPriority.action === 'fix_verify');
assert('decisionPacket: commandMap', typeof dp.commandMap === 'object');
assert('decisionPacket: safeCommandBoundary', typeof dp.safeCommandBoundary === 'object');
assert('decisionPacket: dryRun', dp.dryRun === true);

// --- exports ---
assert('CONSOLE_VERSION 4.0.0', CONSOLE_VERSION === '4.0.0');
assert('COMMAND_MAP object', typeof COMMAND_MAP === 'object');
assert('COMMAND_MAP has kosame:status', 'npm run kosame:status' in COMMAND_MAP);
assert('COMMAND_MAP has kosame:next', 'npm run kosame:next' in COMMAND_MAP);
assert('COMMAND_MAP has 8 entries', Object.keys(COMMAND_MAP).length === 8);
assert('SAFE_COMMAND_BOUNDARY object', typeof SAFE_COMMAND_BOUNDARY === 'object');
assert('SAFE_COMMAND_BOUNDARY.proposable has git status', SAFE_COMMAND_BOUNDARY.proposable.some(c => c.includes('git status')));
assert('SAFE_COMMAND_BOUNDARY.neverGenerate has rm -rf', SAFE_COMMAND_BOUNDARY.neverGenerate.some(c => c.includes('rm -rf')));
assert('FORBIDDEN_ACTIONS array', Array.isArray(FORBIDDEN_ACTIONS));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
