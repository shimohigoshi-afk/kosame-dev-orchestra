'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.101 clip位置/ASLデモ/通知音UI smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 101),
  `package version must be >= 113.3.101 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-101'], 'smoke:v113-3-101 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-101'), 'verify:dev-os must include smoke:v113-3-101');
console.log('  PASS: version >= 113.3.101');

const html = read('public/kosame-live-cockpit.html');

// ── ① clip icon: left of textarea (width: auto fix) ──────────────────────────
assert.ok(
  html.includes('id="chat-attach-btn"'),
  'chat-attach-btn must be present',
);
// button before textarea inside chat-input-with-btn
const inputWithBtnIdx = html.indexOf('class="chat-input-with-btn"');
const attachBtnIdx = html.indexOf('id="chat-attach-btn"');
const textareaIdx = html.indexOf('id="chat-input"');
assert.ok(
  inputWithBtnIdx > 0 && attachBtnIdx > inputWithBtnIdx && textareaIdx > attachBtnIdx,
  'chat-attach-btn must appear inside chat-input-with-btn, before textarea',
);
// flex layout fix: width: auto on chat-input-with-btn textarea
assert.ok(
  /\.chat-input-with-btn textarea\s*\{[^}]*width:\s*auto/.test(html),
  '.chat-input-with-btn textarea must have width: auto to prevent width:100% override',
);
console.log('  PASS: クリップアイコン — テキストエリア左横inline配置 (width:auto fix)');

// ── ② ASL demo: SSE replay fix ────────────────────────────────────────────────
// Must track _sseConnectedAt from connected event
assert.ok(
  html.includes('_sseConnectedAt'),
  '_sseConnectedAt variable must exist in SSE handler',
);
// Must compare event timestamp to connection time before stopping demo
assert.ok(
  html.includes('eventTs >= _sseConnectedAt'),
  'log handler must compare eventTs to _sseConnectedAt (not stop on replays)',
);
// connected handler must record connection time (not stop demo)
assert.ok(
  html.includes("new Date(JSON.parse(e.data).ts).getTime()"),
  'connected handler must parse connection timestamp',
);
const connectedHandler = html.match(/es\.addEventListener\(['"]connected['"],\s*function\s*\(e\)\s*\{([^}]*)\}/s);
assert.ok(connectedHandler && !connectedHandler[1].includes('stopAslDemo'),
  'connected handler must NOT call stopAslDemo',
);
console.log('  PASS: ASLデモ — SSEリプレイ対策 (_sseConnectedAt比較, connected handler safe)');

// ── ③ 通知音UI: OFF/Soft/Clear 3モード ────────────────────────────────────────
// Mode buttons: OFF / Soft / Clear
assert.ok(html.includes("{ label: 'OFF', mode: 'off' }"), "OFF mode button must exist");
assert.ok(html.includes("{ label: 'Soft', mode: 'soft' }"), "Soft mode button must exist");
assert.ok(html.includes("{ label: 'Clear', mode: 'clear' }"), "Clear mode button must exist");
// Order: OFF before Soft before Clear
const offModeIdx = html.indexOf("{ label: 'OFF', mode: 'off' }");
const softModeIdx = html.indexOf("{ label: 'Soft', mode: 'soft' }");
const clearModeIdx = html.indexOf("{ label: 'Clear', mode: 'clear' }");
assert.ok(offModeIdx < softModeIdx && softModeIdx < clearModeIdx, 'OFF must come before Soft, Soft before Clear');
// setNotificationMode accepts 'off'
assert.ok(
  html.includes("mode !== 'off' && mode !== 'soft' && mode !== 'clear'"),
  "setNotificationMode must accept 'off' mode",
);
// notificationEnabled derived from mode
assert.ok(
  html.includes("notificationEnabled = mode !== 'off'"),
  "notificationEnabled must be set to mode !== 'off'",
);
// 種別テストボタン4種
assert.ok(html.includes("type: 'question'"), 'こさめ質問音 test type must exist');
assert.ok(html.includes("type: 'human_gate'"), 'HUMAN_GATE音 test type must exist');
assert.ok(html.includes("type: 'done'"), 'DONE音 test type must exist');
assert.ok(html.includes("type: 'error'"), 'ERROR音 test type must exist');
// Old ON/OFF separate power row must be gone
assert.ok(!html.includes("{ label: 'ON', enabled: true }"), 'old ON power button must be gone');
assert.ok(!html.includes("{ label: 'OFF', enabled: false }"), 'old OFF power button must be gone');
console.log('  PASS: 通知音UI — OFF/Soft/Clear 3モード、種別テスト4種、旧powerRow除去');

console.log('\n✅ v113.3.101 clip位置/ASLデモ/通知音UI smoke PASSED');
