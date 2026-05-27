'use strict';
const { runCliCommand, formatCliOutput, RUNNER_VERSION, COMMANDS, FORBIDDEN_ACTIONS } = require('../tools/kosame-cli-runner');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-cli-runner smoke ===');

const GREEN = {
  rawData: {
    packageVersion: '3.6.0',
    repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
    actions: { status: 'success', conclusion: 'success', jobResults: [] },
    verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
    providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
  },
  sessionGoal: 'v3.6.0 smoke test'
};

const DIRTY = {
  rawData: {
    packageVersion: '3.6.0',
    repo: { gitStatusSbText: '## main...origin/main\nM package.json\n?? tools/new.js\n', headCommit: 'abc1234' },
    actions: { status: 'success', conclusion: 'success', jobResults: [] },
    verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
    providerHealth: {}
  }
};

// --- status command ---
const s1 = runCliCommand('status', GREEN);
assert('runner field', s1.runner === 'kosame-cli-runner');
assert('version 3.6.0', s1.version === '3.6.0');
assert('dryRun true', s1.dryRun === true);
assert('command: status', s1.command === 'status');
assert('status: recommendation YES (green)', s1.recommendation === 'YES');
assert('status: risk low', s1.risk === 'low');
assert('status: humanApproval false', s1.humanApprovalRequired === false);
assert('status: nextAction string', typeof s1.nextAction === 'string');
assert('status: safeCommands array', Array.isArray(s1.safeCommandSuggestion));
assert('status: forbiddenActions array', Array.isArray(s1.forbiddenActions));
assert('status: forbiddenActions has rm -rf', s1.forbiddenActions.some(f => f.includes('rm -rf')));
assert('status: overallHealth healthy', s1.overallHealth === 'healthy');

// --- commit-check (green: has changes + verify passed) ---
const c1 = runCliCommand('commit-check', DIRTY);
assert('commit-check: runner field', c1.runner === 'kosame-cli-runner');
assert('commit-check: command', c1.command === 'commit-check');
assert('commit-check: recommendation is string', ['YES', 'NO', 'HOLD'].includes(c1.recommendation));
assert('commit-check: humanApproval false (commit not dangerous)', c1.humanApprovalRequired === false);

// --- push-check (always humanApprovalRequired) ---
const p1 = runCliCommand('push-check', GREEN);
assert('push-check: humanApproval always true', p1.humanApprovalRequired === true);
assert('push-check: risk high', p1.risk === 'high');
assert('push-check: recommendation is string', ['YES', 'NO', 'HOLD'].includes(p1.recommendation));

// --- release-check (always humanApprovalRequired) ---
const r1 = runCliCommand('release-check', GREEN);
assert('release-check: humanApproval always true', r1.humanApprovalRequired === true);
assert('release-check: risk high', r1.risk === 'high');
assert('release-check: recommendation YES when all green', r1.recommendation === 'YES');

// --- dispatch ---
const d1 = runCliCommand('dispatch', GREEN);
assert('dispatch: command', d1.command === 'dispatch');
assert('dispatch: recommendation string', ['YES', 'NO', 'HOLD'].includes(d1.recommendation));
assert('dispatch: humanApproval false', d1.humanApprovalRequired === false);

// --- approval (green = no push/release YES → HOLD) ---
const a1 = runCliCommand('approval', GREEN);
assert('approval: command', a1.command === 'approval');
assert('approval: recommendation is string', ['YES', 'NO', 'HOLD'].includes(a1.recommendation));

// --- handoff ---
const h1 = runCliCommand('handoff', GREEN);
assert('handoff: command', h1.command === 'handoff');
assert('handoff: recommendation YES (green)', h1.recommendation === 'YES');
assert('handoff: risk low', h1.risk === 'low');
assert('handoff: humanApproval false', h1.humanApprovalRequired === false);

// --- next ---
const n1 = runCliCommand('next', GREEN);
assert('next: command', n1.command === 'next');
assert('next: recommendation YES (action exists)', n1.recommendation === 'YES');
assert('next: nextAction string', typeof n1.nextAction === 'string');
assert('next: additionalInfo has action', n1.additionalInfo && 'action' in n1.additionalInfo);

// --- unknown command ---
const u1 = runCliCommand('unknown-cmd', GREEN);
assert('unknown: recommendation HOLD', u1.recommendation === 'HOLD');
assert('unknown: safeCommands has kosame:status', u1.safeCommandSuggestion.some(s => s.includes('status')));

// --- formatCliOutput ---
const formatted = formatCliOutput(s1);
assert('formatCliOutput: string', typeof formatted === 'string');
assert('formatCliOutput: has KOSAME STATUS', formatted.includes('KOSAME STATUS'));
assert('formatCliOutput: has recommendation', formatted.includes('recommendation'));
assert('formatCliOutput: has FORBIDDEN', formatted.includes('FORBIDDEN'));

// --- exports ---
assert('RUNNER_VERSION 3.6.0', RUNNER_VERSION === '3.6.0');
assert('COMMANDS has 8', COMMANDS.length === 8);
assert('COMMANDS has next', COMMANDS.includes('next'));
assert('FORBIDDEN_ACTIONS array', Array.isArray(FORBIDDEN_ACTIONS));
assert('FORBIDDEN_ACTIONS has rm -rf', FORBIDDEN_ACTIONS.some(f => f.includes('rm -rf')));
assert('FORBIDDEN_ACTIONS has git reset', FORBIDDEN_ACTIONS.some(f => f.includes('git reset')));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
