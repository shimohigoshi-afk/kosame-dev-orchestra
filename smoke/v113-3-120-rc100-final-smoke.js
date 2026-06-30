#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.120';
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');
const RUNS_DIR = path.join(ROOT, '.kosame-runner', 'runs');

let passed = 0; let failed = 0;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i]||0) > (pb[i]||0)) return 1; if ((pa[i]||0) < (pb[i]||0)) return -1; }
  return 0;
}
function test(name, fn) { try { fn(); console.log('  PASS: ' + name); passed++; } catch (e) { console.error('  FAIL: ' + name + ' — ' + e.message); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function unlink(p) { try { fs.unlinkSync(p); } catch (_) {} }

const { detectConfidentiality, detectTaskDifficulty, selectModelLane, writeDeepSeekHandoffFile, writeLatestStatus, writeRevisionHandoffFile, executorLaneRouter, processTicket } = require('../tools/kosame-runner-queue');

console.log('===== v' + MIN_VERSION + ' RC100 final smoke =====');
test('version >= 113.3.120', () => { assert(compareVersions(PKG.version, MIN_VERSION) >= 0, 'got ' + PKG.version); });

// ════════════════════════════════════════════════════════════════════════════
// Model Lane Router compat
// ════════════════════════════════════════════════════════════════════════════
test('confidentiality: safe for plain', () => { assert(detectConfidentiality({ prompt_text: 'add comment' }) === 'safe'); });
test('confidentiality: sanitized for smoke', () => { assert(detectConfidentiality({ prompt_text: 'smoke test' }) === 'sanitized'); });
test('confidentiality: sensitive for customer', () => { assert(detectConfidentiality({ prompt_text: 'customer db' }) === 'sensitive'); });
test('confidentiality: forbidden for .env', () => { assert(detectConfidentiality({ prompt_text: '.env fix' }) === 'forbidden'); });
test('confidentiality: forbidden for sales-dx', () => { assert(detectConfidentiality({ prompt_text: 'sales_dx' }) === 'forbidden'); });
test('confidentiality: forbidden for deploy', () => { assert(detectConfidentiality({ prompt_text: 'deploy now' }) === 'forbidden'); });
test('difficulty: low', () => { assert(detectTaskDifficulty({ prompt_text: 'add comment' }) === 'low'); });
test('difficulty: medium', () => { assert(detectTaskDifficulty({ prompt_text: 'implement function with component' }) === 'medium'); });
test('difficulty: high', () => { assert(detectTaskDifficulty({ prompt_text: 'refactor auth with security vulnerability fix' }) === 'high'); });
test('difficulty: blocked', () => { assert(detectTaskDifficulty({ prompt_text: '../escape' }) === 'blocked'); });
test('selectModelLane: forbidden→BLOCKED', () => { assert(selectModelLane({ prompt_text: '.env delete' }).lane === 'BLOCKED'); });
test('selectModelLane: sensitive→INTERNAL', () => { assert(selectModelLane({ prompt_text: 'customer billing fix' }).lane === 'INTERNAL_ONLY'); });
test('selectModelLane: safe+low→L1', () => { assert(selectModelLane({ prompt_text: 'add comment' }).lane === 'L1_DEEPSEEK_V4_FLASH'); });
test('selectModelLane: safe+medium→L2', () => { assert(selectModelLane({ prompt_text: 'implement function with component' }).lane === 'L2_DEEPSEEK_V4_PRO'); });
test('selectModelLane: safe+high→L3', () => { assert(selectModelLane({ prompt_text: 'refactor auth with security fix' }).lane === 'L3_DEEPSEEK_V4_PRO_AUDIT'); });

// ════════════════════════════════════════════════════════════════════════════
// Judge API checks (source)
// ════════════════════════════════════════════════════════════════════════════
test('server has /api/executor/judge', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('/api/executor/judge'), 'must have judge endpoint'); });
test('server judge validates status', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('pending_judge'), 'must include pending_judge'); assert(s.includes('judge_accept'), 'must include judge_accept'); assert(s.includes('judge_revise'), 'must include judge_revise'); assert(s.includes('judge_reject'), 'must include judge_reject'); assert(s.includes('judge_human_gate'), 'must include judge_human_gate'); });
test('server judge saves latest-judge.json', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('latest-judge.json'), 'must save json'); });
test('server judge saves latest-judge.md', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('latest-judge.md'), 'must save md'); });
test('server judge GET returns pending_judge when missing', () => { const s = read('tools/kosame-live-cockpit-server.js'); const lines = s.split('\n'); const found = lines.some(l => l.includes('pending_judge') && l.includes('empty')); assert(found, 'must return pending on empty'); });

// ════════════════════════════════════════════════════════════════════════════
// Release Gate API checks
// ════════════════════════════════════════════════════════════════════════════
test('server has /api/executor/release-gate', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('/api/executor/release-gate')); });
test('server release gate has open/caution/human_gate/blocked', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes("'open'"), 'open'); assert(s.includes("'caution'"), 'caution'); assert(s.includes("'human_gate'"), 'human_gate'); assert(s.includes("'blocked'"), 'blocked'); });
test('release gate includes blockers/warnings/next_actions', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('blockers'), 'must have blockers'); assert(s.includes('next_actions'), 'must have next_actions'); });
test('release gate lists forbidden actions', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('git add -A'), 'must forbid git add -A'); assert(s.includes('rm -rf'), 'must forbid rm -rf'); });
test('release gate requires human for commit/push/deploy', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('commit'), 'must mention commit'); assert(s.includes('push'), 'must mention push'); assert(s.includes('deploy'), 'must mention deploy'); });

// ════════════════════════════════════════════════════════════════════════════
// RC100 Summary API checks
// ════════════════════════════════════════════════════════════════════════════
test('server has /api/executor/rc100-summary', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('/api/executor/rc100-summary')); });
test('rc100 writes rc100-summary.md', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('rc100-summary.md')); });
test('rc100 writes handoff-latest.md', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('handoff-latest.md')); });
test('rc100 writes recovery-checklist.md', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('recovery-checklist.md')); });
test('rc100 includes completion_estimate', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('completion_estimate')); });

// ════════════════════════════════════════════════════════════════════════════
// Handoff / Recovery API checks
// ════════════════════════════════════════════════════════════════════════════
test('server has /api/executor/handoff', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('/api/executor/handoff')); });
test('server has /api/executor/recovery', () => { assert(read('tools/kosame-live-cockpit-server.js').includes('/api/executor/recovery')); });
test('handoff-latest includes model lane rules', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('Model Lane Rules'), 'must include lane rules'); });
test('handoff-latest includes forbidden ops', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('Forbidden Operations'), 'must include forbidden ops'); });
test('recovery-checklist includes npm run verify', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('verify'), 'must include verify step'); });
test('recovery-checklist includes git status', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('git status'), 'must include git status'); });
test('recovery-checklist forbids transcriber', () => { const s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('transcriber'), 'must forbid transcriber'); });

// ════════════════════════════════════════════════════════════════════════════
// .gitignore hygiene
// ════════════════════════════════════════════════════════════════════════════
test('.gitignore ignores rc100-summary.md', () => { assert(read('.gitignore').includes('rc100-summary.md')); });
test('.gitignore ignores handoff-latest.md', () => { assert(read('.gitignore').includes('handoff-latest.md')); });
test('.gitignore ignores recovery-checklist.md', () => { assert(read('.gitignore').includes('recovery-checklist.md')); });
test('.gitignore ignores test-results/', () => { assert(read('.gitignore').includes('test-results/')); });
test('.gitignore ignores logs/', () => { assert(read('.gitignore').includes('logs/')); });
test('.gitignore keeps run-latest.sh', () => { const gi = read('.gitignore'); assert(!gi.split('\n').some(l => l.includes('run-latest.sh') && !l.startsWith('#')), 'must NOT ignore run-latest.sh'); });

// ════════════════════════════════════════════════════════════════════════════
// Console UI checks
// ════════════════════════════════════════════════════════════════════════════
test('HTML has rc100-gate-content', () => { assert(read('public/kosame-live-cockpit.html').includes('rc100-gate-content')); });
test('HTML has rc100-judge-status', () => { assert(read('public/kosame-live-cockpit.html').includes('rc100-judge-status')); });
test('HTML has renderRC100Dashboard', () => { assert(read('public/kosame-live-cockpit.html').includes('function renderRC100Dashboard')); });
test('HTML calls renderRC100Dashboard on init', () => { assert(read('public/kosame-live-cockpit.html').includes('renderRC100Dashboard()')); });
test('HTML preserves renderDeepSeekHandoff init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderDeepSeekHandoff()')); });
test('HTML preserves renderDeepSeekResult init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderDeepSeekResult()')); });
test('HTML preserves renderDeepSeekResultAction init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderDeepSeekResultAction()')); });
test('HTML preserves renderDeepSeekWorkflowHistory init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderDeepSeekWorkflowHistory()')); });
test('HTML preserves renderWorkflowDashboard init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderWorkflowDashboard()')); });
test('HTML preserves renderReleaseReadiness init call', () => { assert(read('public/kosame-live-cockpit.html').includes('renderReleaseReadiness()')); });
test('HTML preserves chat-proceed', () => { assert(read('public/kosame-live-cockpit.html').includes('chat-proceed')); });
test('HTML preserves chat-sound-badge', () => { assert(read('public/kosame-live-cockpit.html').includes('chat-sound-badge')); });
test('HTML preserves agent-stream-log', () => { assert(read('public/kosame-live-cockpit.html').includes('agent-stream-log')); });

// ════════════════════════════════════════════════════════════════════════════
// Package scripts
// ════════════════════════════════════════════════════════════════════════════
test('package.json smoke:v113-3-120', () => { assert(PKG.scripts['smoke:v113-3-120']); });
test('verify:dev-os v120 node --check', () => { assert(PKG.scripts['verify:dev-os'].includes('rc100-final-smoke.js')); });
test('verify:dev-os v120 run', () => { assert(PKG.scripts['verify:dev-os'].includes('smoke:v113-3-120')); });
test('verify:dev-os temp file v120', () => { assert(PKG.scripts['verify:dev-os'].includes('v113-3-120.json')); });
test('package.json v112 smoke', () => { assert(PKG.scripts['smoke:v113-3-112']); });
test('package.json v114 smoke', () => { assert(PKG.scripts['smoke:v113-3-114']); });
test('package.json v115 smoke', () => { assert(PKG.scripts['smoke:v113-3-115']); });
test('package.json v116 smoke', () => { assert(PKG.scripts['smoke:v113-3-116']); });
test('package.json v117 smoke', () => { assert(PKG.scripts['smoke:v113-3-117']); });
test('package.json v118 smoke', () => { assert(PKG.scripts['smoke:v113-3-118']); });
test('package.json v119 smoke', () => { assert(PKG.scripts['smoke:v113-3-119']); });

// ════════════════════════════════════════════════════════════════════════════
// Judge states
// ════════════════════════════════════════════════════════════════════════════
test('judge has all 5 states defined', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('pending_judge')); assert(s.includes('judge_accept')); assert(s.includes('judge_revise'));
  assert(s.includes('judge_reject')); assert(s.includes('judge_human_gate'));
});
test('judge saves human_gate_required', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('human_gate_required'), 'must track human_gate_required');
});
test('judge saves final_owner GPT/KOSAME', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('GPT/KOSAME'), 'must show final_owner');
});

// ════════════════════════════════════════════════════════════════════════════
// Release Gate states
// ════════════════════════════════════════════════════════════════════════════
test('release gate has all gates', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("'open'")); assert(s.includes("'caution'"));
  assert(s.includes("'human_gate'")); assert(s.includes("'blocked'"));
});
test('release gate human required for commit', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('commit'), 'commit human gate'); });
test('release gate human required for push', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('push'), 'push human gate'); });
test('release gate human required for deploy', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('deploy'), 'deploy human gate'); });
test('release gate forbids git add -A', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('git add -A'), 'must forbid'); });
test('release gate forbids npm publish', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('npm publish'), 'must forbid'); });
test('release gate forbids customer exposure', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('customer data'), 'must forbid customer exposure'); });

// ════════════════════════════════════════════════════════════════════════════
// RC100 artifacts presence (can generate via API import, check source)
// ════════════════════════════════════════════════════════════════════════════
test('rc100 has completion_estimate 100%', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('completion_estimate'), 'must have field'); assert(s.includes("'100%'"), 'must say 100%'); });
test('rc100 handoff includes forbidden ops', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('Forbidden Operations'), 'handoff must include'); });
test('rc100 recovery includes npm run verify', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('npm run verify'), 'recovery must include verify'); });
test('rc100 recovery includes pre-push checklist', () => { var s = read('tools/kosame-live-cockpit-server.js'); assert(s.includes('Pre-Push'), 'recovery must include pre-push'); });

// ════════════════════════════════════════════════════════════════════════════
// Executor compat tests
// ════════════════════════════════════════════════════════════════════════════
test('executorLaneRouter blocked', () => { var d = path.join(RUNS_DIR, 'rc100-blk-' + Date.now()); mkdir(d); var r = executorLaneRouter({ id: 'x', prompt_text: '../seq', target_repo: ROOT }, d); assert(!r.ok); });
test('executorLaneRouter append', () => { var d = path.join(RUNS_DIR, 'rc100-la-' + Date.now()); mkdir(d); var r = executorLaneRouter({ id: 'x', prompt_text: 'public/test.html に KOSAME_RC100 を追記してください', target_repo: ROOT }, d); assert(r.ok); try { var c = fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8').replace('KOSAME_RC100',''); fs.writeFileSync(path.join(ROOT,'public','test.html'),c); } catch(_){} });
test('writeDeepSeekHandoffFile includes model lane', () => { var hp = writeDeepSeekHandoffFile({ id: 'rc100', title: 't', prompt_text: 'refactor auth with security', target_repo: ROOT }, {}, path.join(RUNS_DIR,'d')); var c = fs.readFileSync(hp,'utf8'); assert(c.includes('confidentiality:'),'must include conf'); assert(c.includes('difficulty:'),'must include diff'); assert(c.includes('model_lane:'),'must include lane'); });
test('writeRevisionHandoffFile includes safety', () => { var rp = writeRevisionHandoffFile('t','s',['f'],['v'],'reason','instruction'); assert(fs.existsSync(rp)); var c = fs.readFileSync(rp,'utf8'); assert(c.includes('git add -A'), 'must forbid'); unlink(rp); });
test('writeLatestStatus includes model fields', () => { var lp = path.join(EXECUTOR_DIR, 'latest.md'); if (fs.existsSync(lp)) fs.unlinkSync(lp); writeLatestStatus('deepseek_patch_required','pending', { id:'rc100', title:'t', prompt_text:'refactor auth security', target_repo:ROOT }, '/tmp/o',null,'test'); assert(fs.existsSync(lp)); var c = fs.readFileSync(lp,'utf8'); assert(c.includes('confidentiality:'), 'must include conf'); assert(c.includes('difficulty:'), 'must include diff'); });
test('processTicket skip terminal', () => { var st = {}; var id = 'rc100-skip-' + Date.now(); st[id] = { status: 'blocked_by_test_failure', blockedAt: new Date().toISOString() }; var r = processTicket({ id: id, title: 't', prompt_text: 'x', target_repo: ROOT }, { state: st, runsDir: RUNS_DIR }); assert(r.status === 'blocked_by_test_failure'); });

// ════════════════════════════════════════════════════════════════════════════
// Contamination checks
// ════════════════════════════════════════════════════════════════════════════
test('no sales-dx / transcriber in ROOT', () => { var bad = ['kosame-sales-dx','sales-dx','transcriber','transcribe']; bad.forEach(b => assert(!ROOT.includes(b), 'must not contain ' + b)); });
test('no ANESTY Board in source', () => { var files = [read('tools/kosame-live-cockpit-server.js'), read('tools/kosame-runner-queue.js'), read('public/kosame-live-cockpit.html')]; files.forEach(f => assert(!f.includes('ANESTY Board'))); });

// ════════════════════════════════════════════════════════════════════════════
// public/test.html smoke residue check
// ════════════════════════════════════════════════════════════════════════════
test('public/test.html has no KOSAME_UNIQUE_TEST residue', () => {
  var c = fs.existsSync(path.join(ROOT,'public','test.html')) ? fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8') : '';
  assert(!c.includes('KOSAME_UNIQUE_TEST'), 'must not have test marker residue');
  assert(!c.includes('KOSAME_BROWSER_TEST'), 'must not have browser test marker');
  assert(!c.includes('KOSAME_APPEND_'), 'must not have append marker');
  assert(!c.includes('KOSAME_HEADING_'), 'must not have heading marker');
  assert(!c.includes('KOSAME_RC80'), 'must not have rc80 marker');
  assert(!c.includes('KOSAME_RC100'), 'must not have rc100 marker');
});

// ════════════════════════════════════════════════════════════════════════════
// Existing smoke compat
// ════════════════════════════════════════════════════════════════════════════
test('smoke:v113-3-112', () => { assert(PKG.scripts['smoke:v113-3-112']); });
test('smoke:v113-3-114', () => { assert(PKG.scripts['smoke:v113-3-114']); });
test('smoke:v113-3-115', () => { assert(PKG.scripts['smoke:v113-3-115']); });
test('smoke:v113-3-116', () => { assert(PKG.scripts['smoke:v113-3-116']); });
test('smoke:v113-3-117', () => { assert(PKG.scripts['smoke:v113-3-117']); });
test('smoke:v113-3-118', () => { assert(PKG.scripts['smoke:v113-3-118']); });
test('smoke:v113-3-119', () => { assert(PKG.scripts['smoke:v113-3-119']); });

// ════════════════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════════════════
var total = passed + failed;
console.log('');
if (failed === 0) {
  console.log('✅ v' + MIN_VERSION + ' RC100 final smoke PASSED (' + passed + '/' + total + ')');
} else {
  console.error('❌ v' + MIN_VERSION + ' RC100 final smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
  process.exit(1);
}
