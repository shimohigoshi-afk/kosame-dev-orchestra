'use strict';
const { generateHandoff, GENERATOR_VERSION, TONE_PROFILES, FORBIDDEN_ACTIONS_LIST } = require('../tools/kosame-handoff-auto-generator');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-handoff-auto-generator smoke ===');

const FULL_INPUT = {
  currentVersion: '3.9.0',
  currentHead: 'abc1234',
  latestTag: 'v3.8.0',
  actionsStatus: 'success',
  completedWork: ['v3.6.0 CLI Runner', 'v3.7.0 Real Snapshot', 'v3.8.0 Approval Board'],
  uncommittedWork: [],
  nextRecommendedAction: 'npm run verify && git commit',
  riskNotes: ['Geminiエラー継続中'],
  nextClaudePromptSummary: 'v4.0.0 Practical Console実装を依頼',
  nextGeminiFallbackSummary: 'Gemini fallback: Claude係長へルーティング',
  humanApprovalStatus: 'git push: じゅんやさんYES待ち',
  session_id: 'smoke-001'
};

// --- concise (default) ---
const c1 = generateHandoff({ ...FULL_INPUT, tone: 'concise' });
assert('generator field', c1.generator === 'kosame-handoff-auto-generator');
assert('version 3.9.0', c1.version === '3.9.0');
assert('dryRun true', c1.dryRun === true);
assert('session_id', c1.session_id === 'smoke-001');
assert('tone concise', c1.tone === 'concise');
assert('currentVersion', c1.currentVersion === '3.9.0');
assert('currentHead', c1.currentHead === 'abc1234');
assert('latestTag', c1.latestTag === 'v3.8.0');
assert('actionsStatus', c1.actionsStatus === 'success');
assert('completedWork array', Array.isArray(c1.completedWork) && c1.completedWork.length === 3);
assert('uncommittedWork empty', c1.uncommittedWork.length === 0);
assert('nextRecommendedAction string', typeof c1.nextRecommendedAction === 'string');
assert('handoffNote string', typeof c1.handoffNote === 'string');
assert('conciseNote string', typeof c1.conciseNote === 'string');
assert('detailedNote string', typeof c1.detailedNote === 'string');
assert('concise: handoffNote = conciseNote', c1.handoffNote === c1.conciseNote);
assert('concise: has version', c1.conciseNote.includes('3.9.0'));
assert('concise: has tag', c1.conciseNote.includes('v3.8.0'));
assert('concise: has nextAction', c1.conciseNote.includes('npm run verify'));
assert('concise: has risk', c1.conciseNote.includes('Gemini'));
assert('readyForHandoff true (no uncommitted)', c1.readyForHandoff === true);
assert('forbiddenActions array', Array.isArray(c1.forbiddenActions));
assert('forbiddenActions has rm -rf', c1.forbiddenActions.some(f => f.includes('rm -rf')));

// --- detailed ---
const d1 = generateHandoff({ ...FULL_INPUT, tone: 'detailed' });
assert('tone detailed', d1.tone === 'detailed');
assert('detailed: handoffNote = detailedNote', d1.handoffNote === d1.detailedNote);
assert('detailed: has 完了作業', d1.detailedNote.includes('完了作業'));
assert('detailed: has リスクノート', d1.detailedNote.includes('リスクノート'));
assert('detailed: has 絶対実行禁止', d1.detailedNote.includes('絶対実行禁止'));
assert('detailed: has Claude', d1.detailedNote.includes('Claude'));
assert('detailed: has Gemini', d1.detailedNote.includes('Gemini'));
assert('detailed: has 承認状態', d1.detailedNote.includes('承認状態'));
assert('detailed: has nextClaudePromptSummary', d1.nextClaudePromptSummary.includes('v4.0.0'));
assert('detailed: has nextGeminiFallbackSummary', d1.nextGeminiFallbackSummary.includes('fallback'));

// --- readyForHandoff: false when uncommittedWork ---
const c2 = generateHandoff({ uncommittedWork: ['tools/x.js', 'smoke/y.js'] });
assert('uncommitted: readyForHandoff false', c2.readyForHandoff === false);

// --- default tone (concise) ---
const d2 = generateHandoff({ currentVersion: '3.9.0' });
assert('default tone: concise', d2.tone === TONE_PROFILES.CONCISE);
assert('default: readyForHandoff true (empty uncommitted)', d2.readyForHandoff === true);

// --- exports ---
assert('GENERATOR_VERSION 3.9.0', GENERATOR_VERSION === '3.9.0');
assert('TONE_PROFILES.CONCISE', TONE_PROFILES.CONCISE === 'concise');
assert('TONE_PROFILES.DETAILED', TONE_PROFILES.DETAILED === 'detailed');
assert('FORBIDDEN_ACTIONS_LIST array', Array.isArray(FORBIDDEN_ACTIONS_LIST));
assert('FORBIDDEN_ACTIONS_LIST has rm', FORBIDDEN_ACTIONS_LIST.some(f => f.includes('rm -rf')));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
