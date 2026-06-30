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
// button must be INSIDE chat-input-with-btn (position relative to textarea superseded by v113.3.102)
const inputWithBtnIdx = html.indexOf('class="chat-input-with-btn"');
const attachBtnIdx = html.indexOf('id="chat-attach-btn"');
assert.ok(inputWithBtnIdx > 0 && attachBtnIdx > inputWithBtnIdx,
  'chat-attach-btn must appear inside chat-input-with-btn');
console.log('  PASS: chat-attach-btn restored inside chat-input-with-btn');

// ── ② chat-sound-badge present in static HTML ─────────────────────────────────
assert.ok(html.includes('id="chat-sound-badge"'), 'chat-sound-badge must exist in static HTML');
// must be in the chat-status-badges section
const soundBadgeIdx = html.indexOf('id="chat-sound-badge"');
const statusBadgesStart = html.indexOf('class="chat-status-badges"');
assert.ok(statusBadgesStart > 0 && soundBadgeIdx > statusBadgesStart, 'chat-sound-badge must be inside chat-status-badges');
console.log('  PASS: chat-sound-badge present in chat-status-badges');

// ── ③ ASL demo: connected handler must NOT call stopAslDemo ──────────────────
const connectedHandlerMatch = html.match(/es\.addEventListener\(['"]connected['"],\s*function\s*\([^)]*\)\s*\{([^}]*)\}/s);
assert.ok(connectedHandlerMatch, 'connected handler must exist');
assert.ok(
  !connectedHandlerMatch[1].includes('stopAslDemo'),
  'connected handler must NOT call stopAslDemo',
);
console.log('  PASS: connected handler does not stop ASL demo');

// ── ③ ASL demo: log handler references stopAslDemo ───────────────────────────
assert.ok(
  html.includes('stopAslDemo') && html.includes("addEventListener('log'"),
  'log event handler must reference stopAslDemo',
);
console.log('  PASS: log handler references stopAslDemo');

// ── ④ chat-sound-badge present (sound UI structure checked in v113.3.101 smoke) ─
assert.ok(html.includes('id="chat-sound-badge"'), 'chat-sound-badge must exist');
assert.ok(!html.includes('通知音をONにする'), 'old ON button label must remain gone');
assert.ok(!html.includes('通知音をOFFにする'), 'old OFF button label must remain gone');
console.log('  PASS: chat-sound-badge present, 旧ロングラベル除去確認');

console.log('\n✅ v113.3.100 UI restore + ASL + sound smoke PASSED');
