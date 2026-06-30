'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.107 safeSpawn gate fix / target_repo fix smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 107),
  `package version must be >= 113.3.107 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-107'], 'smoke:v113-3-107 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-107'), 'verify:dev-os must include smoke:v113-3-107');
console.log('  PASS: version >= 113.3.107');

// ── ① gate: safeSpawn=true → permission_prompt を通過させる ──────────────────
const { evaluateNoYesGate } = require('../tools/kosame-no-yes-gate');

const permLine = '[CLAUDE-LAUNCHER] claude -p --dangerously-skip-permissions 起動 cwd="/home/lavie/kosame-dev-orchestra"';

const gateSafeSpawn = evaluateNoYesGate({
  text: permLine, source: 'stdout',
  executionHost: 'kosame-api-runner', executionSource: 'kosame-api-runner',
  safeSpawn: true,
});
assert.ok(
  gateSafeSpawn.ok && gateSafeSpawn.decision === 'allow',
  `safeSpawn=true must allow permission_prompt lines (got ok=${gateSafeSpawn.ok} decision=${gateSafeSpawn.decision})`,
);
console.log('  PASS: gate — safeSpawn=true でも permission_prompt が通過 (❌ 失敗 防止)');

// ② gate: safeSpawn なし → permission_prompt は依然ブロック ──────────────────
const gateNoSafeSpawn = evaluateNoYesGate({ text: permLine, source: 'stdout' });
assert.ok(
  !gateNoSafeSpawn.ok,
  `safeSpawn=false must still block permission_prompt (got ok=${gateNoSafeSpawn.ok})`,
);
console.log('  PASS: gate — safeSpawn なし → permission_prompt は引き続きブロック');

// ③ gate: safeSpawn=true でも Safety Stop は引き続きブロック ─────────────────
const forcePushLine = 'git push --force origin main';
const gateSafetyStop = evaluateNoYesGate({
  text: forcePushLine, source: 'stdout',
  executionHost: 'kosame-api-runner', executionSource: 'kosame-api-runner',
  safeSpawn: true,
});
assert.ok(
  !gateSafetyStop.ok && gateSafetyStop.decision === 'safety_stop',
  `safeSpawn=true must still block safety_stop (got ok=${gateSafetyStop.ok} decision=${gateSafetyStop.decision})`,
);
console.log('  PASS: gate — safeSpawn=true でも safety_stop は引き続きブロック');

// ④ gate.js のコード変更確認 ──────────────────────────────────────────────────
const gateCode = read('tools/kosame-no-yes-gate.js');
assert.ok(
  gateCode.includes('blockedPromptType && !executionHostInfo.safeSpawnActive'),
  'kosame-no-yes-gate.js must guard blockedPromptType with !safeSpawnActive',
);
console.log('  PASS: kosame-no-yes-gate.js — blockedPromptType && !safeSpawnActive ガード確認');

// ⑤ HTML: _zeroConfirmDispatch の target_repo fallback 修正 ──────────────────
const html = read('public/kosame-live-cockpit.html');
const badPattern = /target_repo:\s*_sp\s*\?/;
assert.ok(
  !badPattern.test(html),
  '_zeroConfirmDispatch must NOT use `_sp ?` directly (falls back to projects[0] = wrong repo)',
);
const goodPattern = /target_repo:\s*\(selectedProjectId && _sp\)\s*\?/g;
const goodMatches = [...html.matchAll(goodPattern)];
assert.ok(
  goodMatches.length >= 2,
  `HTML must have at least 2 occurrences of (selectedProjectId && _sp) ? for target_repo (found: ${goodMatches.length})`,
);
console.log('  PASS: kosame-live-cockpit.html — target_repo: (selectedProjectId && _sp) ? 修正確認 x' + goodMatches.length);

console.log('\n✅ v113.3.107 safeSpawn gate fix / target_repo fix smoke PASSED');
