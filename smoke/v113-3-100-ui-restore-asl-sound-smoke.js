'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.100 UI restore + ASL + sound smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 100),
  `package version must be >= 113.3.100 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-100'], 'smoke:v113-3-100 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-100'), 'verify:dev-os must include smoke:v113-3-100');
console.log('  PASS: version >= 113.3.100');

const html = read('public/kosame-live-cockpit.html');

// ── ① chat-attach-btn restored ────────────────────────────────────────────────
assert.ok(html.includes('id="chat-attach-btn"'), 'chat-attach-btn must be restored in HTML');
assert.ok(html.includes('id="chat-file-input"'), 'chat-file-input must be restored in HTML');
assert.ok(html.includes('id="chat-input"'), 'chat-input textarea must remain');
// button must be INSIDE chat-input-with-btn (before textarea)
const inputWithBtnIdx = html.indexOf('class="chat-input-with-btn"');
const attachBtnIdx = html.indexOf('id="chat-attach-btn"');
const textareaIdx = html.indexOf('id="chat-input"');
assert.ok(inputWithBtnIdx > 0 && attachBtnIdx > inputWithBtnIdx && textareaIdx > attachBtnIdx,
  'chat-attach-btn must appear inside chat-input-with-btn, before textarea');
console.log('  PASS: chat-attach-btn restored beside textarea');

// ── ② chat-sound-badge present in static HTML ─────────────────────────────────
assert.ok(html.includes('id="chat-sound-badge"'), 'chat-sound-badge must exist in static HTML');
// must be in the chat-status-badges section
const soundBadgeIdx = html.indexOf('id="chat-sound-badge"');
const statusBadgesStart = html.indexOf('class="chat-status-badges"');
assert.ok(statusBadgesStart > 0 && soundBadgeIdx > statusBadgesStart, 'chat-sound-badge must be inside chat-status-badges');
console.log('  PASS: chat-sound-badge present in chat-status-badges');

// ── ③ ASL demo: connected handler must NOT call stopAslDemo ──────────────────
// The connected handler must be empty (demo not killed on SSE connect)
const connectedHandler = html.match(/es\.addEventListener\(['"]connected['"],\s*function\s*\(\)\s*\{([^}]*)\}/s);
assert.ok(connectedHandler, 'connected handler must exist');
assert.ok(
  !connectedHandler[1].includes('stopAslDemo'),
  'connected handler must NOT call stopAslDemo (demo must not be killed on SSE connect)',
);
console.log('  PASS: connected handler does not stop ASL demo');

// ── ③ ASL demo: log handler DOES call stopAslDemo ────────────────────────────
const logHandler = html.match(/es\.addEventListener\(['"]log['"],\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*\)\s*;/);
assert.ok(logHandler, 'log event handler must exist');
assert.ok(
  logHandler[1].includes('stopAslDemo'),
  'log handler must call stopAslDemo (demo stops when real events arrive)',
);
console.log('  PASS: log handler calls stopAslDemo on first real event');

// ── ④ notification sound UI: ON/OFF buttons still intact ─────────────────────
assert.ok(html.includes("{ label: 'ON', enabled: true }"), "sound ON button label must be 'ON'");
assert.ok(html.includes("{ label: 'OFF', enabled: false }"), "sound OFF button label must be 'OFF'");
assert.ok(!html.includes('通知音をONにする'), 'old ON button label must remain gone');
assert.ok(!html.includes('通知音をOFFにする'), 'old OFF button label must remain gone');
console.log('  PASS: 通知音UI — ON/OFF buttons intact, chat-sound-badge restored');

console.log('\n✅ v113.3.100 UI restore + ASL + sound smoke PASSED');
