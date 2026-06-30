#!/usr/bin/env node
'use strict';

/**
 * v113.3.119 — RC80 Pack Smoke
 *
 * 80+ tests covering:
 * - Model Lane Router (confidentiality, difficulty, lane selection)
 * - Readiness API
 * - Workflow Dashboard UI
 * - RC80 Summary
 * - HTTP E2E integration
 * - Secret/sales-dx/transcriber block
 * - Existing smoke backward compat
 * - Status badge / release readability
 * - gitignore hygiene
 */

const fs   = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.119';
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');
const RUNS_DIR = path.join(ROOT, '.kosame-runner', 'runs');

let passed = 0;
let failed = 0;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function test(name, fn) {
  try { fn(); console.log('  PASS: ' + name); passed++; }
  catch (e) { console.error('  FAIL: ' + name + ' — ' + e.message); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function unlink(p) { try { fs.unlinkSync(p); } catch (_) {} }

// ── Imports ──
const {
  detectConfidentiality,
  detectTaskDifficulty,
  selectModelLane,
  MODEL_LANES,
  CONFIDENTIALITY_LEVELS,
  DIFFICULTY_LEVELS,
  writeDeepSeekHandoffFile,
  writeRevisionHandoffFile,
  writeLatestStatus,
  detectExecutorLane,
  executorLaneRouter,
  processTicket,
} = require('../tools/kosame-runner-queue');

// ════════════════════════════════════════════════════════════════════════════

console.log('===== v' + MIN_VERSION + ' RC80 pack smoke =====');

// Version
test('version >= 113.3.119', () => {
  assert(compareVersions(PKG.version, MIN_VERSION) >= 0, 'got ' + PKG.version);
});

// ────────────────────────────────────────────────────────────────────────────
// Model Lane Router — Confidentiality
// ────────────────────────────────────────────────────────────────────────────

test('confidentiality: safe for plain text', () => {
  assert(detectConfidentiality({ prompt_text: 'add a comment to file' }) === 'safe');
});

test('confidentiality: sanitized for smoke/test', () => {
  assert(detectConfidentiality({ prompt_text: 'add smoke test for patch' }) === 'sanitized');
});

test('confidentiality: sanitized for CI/config', () => {
  assert(detectConfidentiality({ prompt_text: 'update CI config' }) === 'sanitized');
});

test('confidentiality: sanitized for audit/review', () => {
  assert(detectConfidentiality({ prompt_text: 'audit the diff' }) === 'sanitized');
});

test('confidentiality: sensitive for customer', () => {
  assert(detectConfidentiality({ prompt_text: 'update customer data schema' }) === 'sensitive');
});

test('confidentiality: sensitive for billing', () => {
  assert(detectConfidentiality({ prompt_text: 'add billing module' }) === 'sensitive');
});

test('confidentiality: sensitive for production', () => {
  assert(detectConfidentiality({ prompt_text: 'deploy to production' }) === 'forbidden');
});

test('confidentiality: forbidden for .env', () => {
  assert(detectConfidentiality({ prompt_text: 'read .env file' }) === 'forbidden');
});

test('confidentiality: forbidden for credentials.json', () => {
  assert(detectConfidentiality({ prompt_text: 'use credentials.json' }) === 'forbidden');
});

test('confidentiality: forbidden for private key', () => {
  assert(detectConfidentiality({ prompt_text: 'loading private_key' }) === 'forbidden');
});

test('confidentiality: forbidden for api key', () => {
  assert(detectConfidentiality({ prompt_text: 'set api_key=xxx' }) === 'forbidden');
});

test('confidentiality: forbidden for SECRET', () => {
  assert(detectConfidentiality({ prompt_text: 'SECRET token' }) === 'forbidden');
});

test('confidentiality: forbidden for sales-dx', () => {
  assert(detectConfidentiality({ prompt_text: 'fix sales_dx' }) === 'forbidden');
});

test('confidentiality: forbidden for transcriber', () => {
  assert(detectConfidentiality({ prompt_text: 'transcriber pipeline' }) === 'forbidden');
});

test('confidentiality: forbidden for deploy', () => {
  assert(detectConfidentiality({ prompt_text: 'deploy now' }) === 'forbidden');
});

test('confidentiality: forbidden for git push', () => {
  assert(detectConfidentiality({ prompt_text: 'git push origin main' }) === 'forbidden');
});

test('confidentiality: forbidden for npm publish', () => {
  assert(detectConfidentiality({ prompt_text: 'npm publish patch' }) === 'forbidden');
});

// ────────────────────────────────────────────────────────────────────────────
// Model Lane Router — Difficulty
// ────────────────────────────────────────────────────────────────────────────

test('difficulty: low for simple comment add', () => {
  assert(detectTaskDifficulty({ prompt_text: 'add comment' }) === 'low');
});

test('difficulty: medium for function implement', () => {
  assert(detectTaskDifficulty({ prompt_text: 'implement function for calculate' }) === 'medium');
});

test('difficulty: medium for fix/修正', () => {
  assert(detectTaskDifficulty({ prompt_text: '修正して component layout' }) === 'medium');
});

test('difficulty: high for refactor', () => {
  assert(detectTaskDifficulty({ prompt_text: 'refactor the entire module architecture' }) === 'high');
});

test('difficulty: high for security vulnerability', () => {
  assert(detectTaskDifficulty({ prompt_text: 'fix security vulnerability in auth' }) === 'high');
});

test('difficulty: high for API endpoint + state management', () => {
  assert(detectTaskDifficulty({ prompt_text: 'implement API endpoint with state management' }) === 'high');
});

test('difficulty: high for long prompt (>300 chars)', () => {
  var long = 'refactor ';
  for (var i = 0; i < 50; i++) long += 'the system module pattern ';
  assert(detectTaskDifficulty({ prompt_text: long }) === 'high');
});

test('difficulty: blocked for path traversal (..)', () => {
  assert(detectTaskDifficulty({ prompt_text: '../secret' }) === 'blocked');
});

test('difficulty: blocked for delete/rm', () => {
  assert(detectTaskDifficulty({ prompt_text: '削除して cleanup' }) === 'blocked');
});

// ────────────────────────────────────────────────────────────────────────────
// Model Lane Router — Lane Selection
// ────────────────────────────────────────────────────────────────────────────

test('selectModelLane: safe + low → L1 (V4 Flash)', () => {
  var r = selectModelLane({ prompt_text: 'add comment to public/test.html' });
  assert(r.lane === 'L1_DEEPSEEK_V4_FLASH', 'got ' + r.lane);
  assert(r.audit_required === false);
  assert(r.human_gate_required === false);
});

test('selectModelLane: safe + medium → L2 (V4 Pro)', () => {
  var r = selectModelLane({ prompt_text: 'implement a new function for the router' });
  assert(r.lane === 'L2_DEEPSEEK_V4_PRO', 'got ' + r.lane);
});

test('selectModelLane: safe + high → L3 (V4 Pro+Audit)', () => {
  var r = selectModelLane({ prompt_text: 'refactor the authentication module with security fixes' });
  assert(r.lane === 'L3_DEEPSEEK_V4_PRO_AUDIT', 'got ' + r.lane);
  assert(r.audit_required === true);
});

test('selectModelLane: sanitized + low → L1 (V4 Flash)', () => {
  var r = selectModelLane({ prompt_text: 'add smoke test for the patch' });
  assert(r.lane === 'L1_DEEPSEEK_V4_FLASH', 'got ' + r.lane);
});

test('selectModelLane: sanitized + medium → L2 (V4 Pro)', () => {
  var r = selectModelLane({ prompt_text: 'update CI config with new build step' });
  assert(r.lane === 'L2_DEEPSEEK_V4_PRO', 'got ' + r.lane);
});

test('selectModelLane: sanitized + high → L3 (V4 Pro+Audit)', () => {
  var r = selectModelLane({ prompt_text: 'refactor security audit pipeline with migration' });
  assert(r.lane === 'L3_DEEPSEEK_V4_PRO_AUDIT', 'got ' + r.lane);
});

test('selectModelLane: sensitive + any → INTERNAL_ONLY', () => {
  var r = selectModelLane({ prompt_text: 'customer data migration to new schema' });
  assert(r.lane === 'INTERNAL_ONLY', 'got ' + r.lane);
  assert(r.human_gate_required === true);
});

test('selectModelLane: sensitive + high → INTERNAL_ONLY', () => {
  var r = selectModelLane({ prompt_text: 'customer billing system refactor with security' });
  assert(r.lane === 'INTERNAL_ONLY', 'got ' + r.lane);
});

test('selectModelLane: forbidden + low → BLOCKED', () => {
  var r = selectModelLane({ prompt_text: '.env fix low' });
  assert(r.lane === 'BLOCKED', 'got ' + r.lane);
});

test('selectModelLane: forbidden + high → BLOCKED', () => {
  var r = selectModelLane({ prompt_text: 'transcriber refactor with security' });
  assert(r.lane === 'BLOCKED', 'got ' + r.lane);
});

test('selectModelLane: blocked difficulty → BLOCKED', () => {
  var r = selectModelLane({ prompt_text: 'rm -rf cleanup' });
  assert(r.lane === 'BLOCKED', 'got ' + r.lane);
});

test('selectModelLane: deploy → forbidden → BLOCKED', () => {
  var r = selectModelLane({ prompt_text: 'deploy to cloud run' });
  assert(r.lane === 'BLOCKED', 'got ' + r.lane);
});

test('selectModelLane: git push → forbidden → BLOCKED', () => {
  var r = selectModelLane({ prompt_text: 'git push origin main' });
  assert(r.lane === 'BLOCKED', 'got ' + r.lane);
});

// ────────────────────────────────────────────────────────────────────────────
// Handoff contains lane info
// ────────────────────────────────────────────────────────────────────────────

test('writeDeepSeekHandoffFile includes model lane fields', () => {
  var hp = writeDeepSeekHandoffFile(
    { id: 'rc80-test', title: 'RC80 Test', prompt_text: 'refactor the auth module with security fixes', target_repo: ROOT },
    { reason: 'test' },
    path.join(RUNS_DIR, 'dummy')
  );
  var c = fs.readFileSync(hp, 'utf8');
  assert(c.includes('confidentiality: safe'), 'must include confidentiality');
  assert(c.includes('difficulty: high'), 'must include difficulty');
  assert(c.includes('model_lane: L3_DEEPSEEK_V4_PRO_AUDIT'), 'must include model_lane');
  assert(c.includes('recommended_model: deepseek-v4-pro'), 'must include model');
  assert(c.includes('audit_required: true'), 'must include audit_required');
  assert(c.includes('human_gate_required: false'), 'must include human_gate_required');
  assert(c.includes('lane_reason:'), 'must include lane_reason');
});

test('writeDeepSeekHandoffFile for low difficulty goes to Flash', () => {
  var hp = writeDeepSeekHandoffFile(
    { id: 'rc80-low', title: 'Low', prompt_text: 'add comment', target_repo: ROOT },
    { reason: 'test' },
    path.join(RUNS_DIR, 'dummy')
  );
  var c = fs.readFileSync(hp, 'utf8');
  assert(c.includes('model_lane: L1_DEEPSEEK_V4_FLASH'), 'must go to flash');
});

// ────────────────────────────────────────────────────────────────────────────
// writeLatestStatus includes model lane
// ────────────────────────────────────────────────────────────────────────────

test('writeLatestStatus includes model lane fields', () => {
  var latestPath = path.join(EXECUTOR_DIR, 'latest.md');
  if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
  writeLatestStatus('deepseek_patch_required', 'pending',
    { id: 'rc80-wls', title: 'WLS', prompt_text: 'refactor the auth with security', target_repo: ROOT },
    '/tmp/out.md', null, 'test');
  var c = fs.readFileSync(latestPath, 'utf8');
  assert(c.includes('confidentiality:'), 'must include confidentiality');
  assert(c.includes('difficulty:'), 'must include difficulty');
  assert(c.includes('model_lane:'), 'must include model_lane');
  assert(c.includes('audit_required:'), 'must include audit_required');
  assert(c.includes('human_gate_required:'), 'must include human_gate_required');
});

// ────────────────────────────────────────────────────────────────────────────
// Readiness API
// ────────────────────────────────────────────────────────────────────────────

test('server has /api/executor/readiness endpoint', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/readiness'), 'must have readiness endpoint');
});

test('server has /api/executor/rc-summary endpoint', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/rc-summary'), 'must have rc-summary endpoint');
});

test('readiness API returns version/appBlocker/warnings', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('blockers'), 'must include blockers');
  assert(s.includes('warnings'), 'must include warnings');
  assert(s.includes('next_actions'), 'must include next_actions');
  assert(s.includes("'ready'"), 'must include ready state');
  assert(s.includes("'caution'"), 'must include caution state');
  assert(s.includes("'blocked'"), 'must include blocked state');
});

test('readiness writes rc80-summary.md', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('rc80-summary.md'), 'must write rc80-summary.md');
  assert(s.includes('rc_summary'), 'must include rc_summary in response');
});

test('rc80-summary.md is in gitignore', () => {
  var gi = read('.gitignore');
  assert(gi.includes('rc80-summary.md'), 'must be in gitignore');
});

// ────────────────────────────────────────────────────────────────────────────
// .gitignore hygiene
// ────────────────────────────────────────────────────────────────────────────

test('.gitignore ignores test-results/', () => {
  var gi = read('.gitignore');
  assert(gi.includes('test-results/'), 'must ignore test-results');
});

test('.gitignore ignores logs/', () => {
  var gi = read('.gitignore');
  assert(gi.includes('logs/'), 'must ignore logs');
});

test('.gitignore keeps .kosame-executor/run-latest.sh safe', () => {
  var gi = read('.gitignore');
  var lines = gi.split('\n');
  var found = lines.some(function(l) { return l.includes('run-latest.sh') && !l.startsWith('#'); });
  assert(!found, 'run-latest.sh must NOT be in gitignore');
});

// ────────────────────────────────────────────────────────────────────────────
// Workflow Dashboard UI
// ────────────────────────────────────────────────────────────────────────────

test('HTML has deepseek-dashboard-content', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-dashboard-content'), 'must have dashboard content');
});

test('HTML has release-readiness-display', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('release-readiness-display'), 'must have readiness display');
});

test('HTML has renderWorkflowDashboard function', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('function renderWorkflowDashboard'), 'must define function');
});

test('HTML has renderReleaseReadiness function', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('function renderReleaseReadiness'), 'must define function');
});

test('HTML calls renderWorkflowDashboard on init', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderWorkflowDashboard()'), 'must call on init');
});

test('HTML calls renderReleaseReadiness on init', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderReleaseReadiness()'), 'must call on init');
});

// ────────────────────────────────────────────────────────────────────────────
// Status badge states
// ────────────────────────────────────────────────────────────────────────────

test('HTML defines no_handoff state in badge', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'no_handoff'"), 'must define no_handoff');
});

test('HTML defines handoff_ready state', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'handoff_ready'"), 'must define handoff_ready');
});

test('HTML defines result_received state', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'result_received'"), 'must define result_received');
});

test('HTML uses action_ prefix for actions', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('action_'), 'must use action_ prefix');
});

test('HTML defines blocked state', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'blocked'"), 'must define blocked');
});

test('HTML defines revision_ready state', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'revision_ready'"), 'must define revision_ready');
});

// ────────────────────────────────────────────────────────────────────────────
// Existing UI preservation
// ────────────────────────────────────────────────────────────────────────────

test('HTML preserves deepseek-handoff-strip', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-handoff-strip'), 'must have handoff strip');
  assert(h.includes('renderDeepSeekHandoff()'), 'must call handoff render');
});

test('HTML preserves deepseek-result-strip', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-result-strip'), 'must have result strip');
  assert(h.includes('renderDeepSeekResult()'), 'must call result render');
});

test('HTML preserves deepseek-action-strip with accept/revise/reject', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-accept'), 'must have accept');
  assert(h.includes('deepseek-action-revise'), 'must have revise');
  assert(h.includes('deepseek-action-reject'), 'must have reject');
  assert(h.includes('renderDeepSeekResultAction()'), 'must call action render');
});

test('HTML preserves deepseek-history-content', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-history-content'), 'must have history');
  assert(h.includes('renderDeepSeekWorkflowHistory()'), 'must call history render');
});

test('HTML preserves chat-proceed/chat-input/chat-sound-badge', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('chat-proceed'), 'must have chat-proceed');
  assert(h.includes('chat-input'), 'must have chat-input');
  assert(h.includes('chat-sound-badge'), 'must have sound badge');
});

test('HTML preserves agent-stream-log', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('agent-stream-log'), 'must have agent-stream-log');
});

// ────────────────────────────────────────────────────────────────────────────
// Package scripts
// ────────────────────────────────────────────────────────────────────────────

test('package.json has smoke:v113-3-119', () => {
  assert(PKG.scripts && PKG.scripts['smoke:v113-3-119'],
    'must have smoke:v113-3-119');
});

test('verify:dev-os includes v119 node --check', () => {
  var v = PKG.scripts['verify:dev-os'];
  assert(v.includes('rc80-pack-smoke.js'), 'must check rc80 pack smoke');
});

test('verify:dev-os includes smoke:v113-3-119', () => {
  var v = PKG.scripts['verify:dev-os'];
  assert(v.includes('smoke:v113-3-119'), 'must run v119 smoke');
});

test('verify:dev-os temp file references version file', () => {
  var v = PKG.scripts['verify:dev-os'];
  assert(v.includes('json'), 'temp file must be a json file');
});

// ────────────────────────────────────────────────────────────────────────────
// Runner exports include new functions
// ────────────────────────────────────────────────────────────────────────────

test('module.exports includes detectConfidentiality', () => {
  var r = read('tools/kosame-runner-queue.js');
  assert(r.includes('detectConfidentiality'), 'must export confidentiality');
});

test('module.exports includes detectTaskDifficulty', () => {
  var r = read('tools/kosame-runner-queue.js');
  assert(r.includes('detectTaskDifficulty'), 'must export difficulty');
});

test('module.exports includes selectModelLane', () => {
  var r = read('tools/kosame-runner-queue.js');
  assert(r.includes('selectModelLane'), 'must export lane selector');
});

test('module.exports includes MODEL_LANES', () => {
  var r = read('tools/kosame-runner-queue.js');
  assert(r.includes('MODEL_LANES'), 'must export MODEL_LANES');
});

test('module.exports includes CONFIDENTIALITY_LEVELS', () => {
  var r = read('tools/kosame-runner-queue.js');
  assert(r.includes('CONFIDENTIALITY_LEVELS'), 'must export levels');
});

// ────────────────────────────────────────────────────────────────────────────
// MODEL_LANES structure
// ────────────────────────────────────────────────────────────────────────────

test('MODEL_LANES has all 6 lanes', () => {
  var keys = Object.keys(MODEL_LANES);
  assert(keys.length >= 6, 'must have 6 lanes');
  assert(MODEL_LANES.L0_LOCAL, 'L0 missing');
  assert(MODEL_LANES.L1_DEEPSEEK_V4_FLASH, 'L1 missing');
  assert(MODEL_LANES.L2_DEEPSEEK_V4_PRO, 'L2 missing');
  assert(MODEL_LANES.L3_DEEPSEEK_V4_PRO_AUDIT, 'L3 missing');
  assert(MODEL_LANES.INTERNAL_ONLY, 'INTERNAL_ONLY missing');
  assert(MODEL_LANES.BLOCKED, 'BLOCKED missing');
});

test('CONFIDENTIALITY_LEVELS has 4 levels', () => {
  assert(CONFIDENTIALITY_LEVELS.length === 4, 'must have 4');
  assert(CONFIDENTIALITY_LEVELS.indexOf('safe') >= 0);
  assert(CONFIDENTIALITY_LEVELS.indexOf('sanitized') >= 0);
  assert(CONFIDENTIALITY_LEVELS.indexOf('sensitive') >= 0);
  assert(CONFIDENTIALITY_LEVELS.indexOf('forbidden') >= 0);
});

test('DIFFICULTY_LEVELS has 4 levels', () => {
  assert(DIFFICULTY_LEVELS.length === 4, 'must have 4');
  assert(DIFFICULTY_LEVELS.indexOf('low') >= 0);
  assert(DIFFICULTY_LEVELS.indexOf('medium') >= 0);
  assert(DIFFICULTY_LEVELS.indexOf('high') >= 0);
  assert(DIFFICULTY_LEVELS.indexOf('blocked') >= 0);
});

// ────────────────────────────────────────────────────────────────────────────
// Contamination
// ────────────────────────────────────────────────────────────────────────────

test('no sales-dx / transcriber in target_repo path', () => {
  var bad = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (var i = 0; i < bad.length; i++) {
    assert(!ROOT.includes(bad[i]), 'must NOT contain ' + bad[i]);
  }
});

test('no ANESTY Board in source files', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  var r = read('tools/kosame-runner-queue.js');
  var h = read('public/kosame-live-cockpit.html');
  var files = [s, r, h];
  for (var j = 0; j < files.length; j++) {
    assert(!files[j].includes('ANESTY Board'), 'must not reference ANESTY Board');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Existing smokes preserved (spot check)
// ────────────────────────────────────────────────────────────────────────────

test('package.json has smoke:v113-3-112', () => {
  assert(PKG.scripts['smoke:v113-3-112'], 'must have v112');
});

test('package.json has smoke:v113-3-114', () => {
  assert(PKG.scripts['smoke:v113-3-114'], 'must have v114');
});

test('package.json has smoke:v113-3-115', () => {
  assert(PKG.scripts['smoke:v113-3-115'], 'must have v115');
});

test('package.json has smoke:v113-3-116', () => {
  assert(PKG.scripts['smoke:v113-3-116'], 'must have v116');
});

test('package.json has smoke:v113-3-117', () => {
  assert(PKG.scripts['smoke:v113-3-117'], 'must have v117');
});

test('package.json has smoke:v113-3-118', () => {
  assert(PKG.scripts['smoke:v113-3-118'], 'must have v118');
});

// ────────────────────────────────────────────────────────────────────────────
// executorLaneRouter still works
// ────────────────────────────────────────────────────────────────────────────

test('executorLaneRouter handles blocked', () => {
  var runDir = path.join(RUNS_DIR, 'rc80-elr-blk-' + Date.now());
  mkdir(runDir);
  var r = executorLaneRouter({ id: 'rc80-elr', prompt_text: '../escape', target_repo: ROOT }, runDir);
  assert(!r.ok, 'must be not ok');
});

test('executorLaneRouter handles local_append', () => {
  var runDir = path.join(RUNS_DIR, 'rc80-elr-la-' + Date.now());
  mkdir(runDir);
  var r = executorLaneRouter(
    { id: 'rc80-elr', prompt_text: 'public/test.html に KOSAME_RC80 を追記してください', target_repo: ROOT },
    runDir
  );
  assert(r.ok, 'must succeed');
  // Cleanup
  try {
    var html = path.join(ROOT, 'public', 'test.html');
    var c = fs.readFileSync(html, 'utf8').replace('KOSAME_RC80', '');
    fs.writeFileSync(html, c);
  } catch (_) {}
});

// ────────────────────────────────────────────────────────────────────────────
// processTicket terminal state guard
// ────────────────────────────────────────────────────────────────────────────

test('processTicket skips pre-set blocked_by_test_failure', () => {
  var state = {};
  var id = 'rc80-btf-' + Date.now();
  state[id] = { status: 'blocked_by_test_failure', attempts: 3, blockedAt: new Date().toISOString() };
  var r = processTicket({ id: id, title: 'test', prompt_text: 'x', target_repo: ROOT }, { state: state, runsDir: RUNS_DIR });
  assert(r.status === 'blocked_by_test_failure', 'must skip');
});

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────

var total = passed + failed;
console.log('');
if (failed === 0) {
  console.log('✅ v' + MIN_VERSION + ' RC80 pack smoke PASSED (' + passed + '/' + total + ')');
} else {
  console.error('❌ v' + MIN_VERSION + ' RC80 pack smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
  process.exit(1);
}
