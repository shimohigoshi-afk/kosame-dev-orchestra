'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.103 clip左配置(center)/soundBadge直接配線 smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 103),
  `package version must be >= 113.3.103 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-103'], 'smoke:v113-3-103 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-103'), 'verify:dev-os must include smoke:v113-3-103');
console.log('  PASS: version >= 113.3.103');

const html = read('public/kosame-live-cockpit.html');

// ── ① クリップアイコン: テキストエリアの左横、align-items: center ──────────────────
assert.ok(html.includes('id="chat-attach-btn"'), 'chat-attach-btn must be present');
assert.ok(html.includes('id="chat-input"'), 'chat-input textarea must remain');

// button must be BEFORE textarea inside chat-input-with-btn (left side)
const inputWithBtnIdx = html.indexOf('class="chat-input-with-btn"');
const attachBtnIdx = html.indexOf('id="chat-attach-btn"');
const textareaIdx = html.indexOf('id="chat-input"');
assert.ok(inputWithBtnIdx > 0, 'chat-input-with-btn must exist');
assert.ok(attachBtnIdx > inputWithBtnIdx, 'chat-attach-btn must be inside chat-input-with-btn');
assert.ok(attachBtnIdx < textareaIdx, 'chat-attach-btn must appear BEFORE textarea (left-side position)');

// align-items: center (not flex-start or flex-end)
assert.ok(
  /\.chat-input-with-btn\s*\{[^}]*align-items:\s*center/.test(html),
  '.chat-input-with-btn must have align-items: center (button vertically centered beside textarea)',
);
// no margin-top or margin-bottom on .chat-attach-btn
assert.ok(
  !/\.chat-attach-btn\s*\{[^}]*margin-top/.test(html),
  '.chat-attach-btn must NOT have margin-top',
);
assert.ok(
  !/\.chat-attach-btn\s*\{[^}]*margin-bottom/.test(html),
  '.chat-attach-btn must NOT have margin-bottom (align-items:center handles vertical centering)',
);
// width: auto on textarea still present
assert.ok(
  /\.chat-input-with-btn textarea\s*\{[^}]*width:\s*auto/.test(html),
  '.chat-input-with-btn textarea must have width: auto',
);
console.log('  PASS: クリップアイコン — テキストエリア左横(align-items:center)配置確定');

// ── ② chat-sound-badge クリックで補助メニュー通知設定を開く (直接配線) ─────────────
// No IIFE wrapper — direct const wiring
assert.ok(
  html.includes("_chatSoundBadge = document.getElementById('chat-sound-badge')"),
  'sound badge must be wired via const (not IIFE)',
);
assert.ok(
  html.includes("querySelector('.chat-assist-shell')"),
  'sound badge click handler must querySelector .chat-assist-shell',
);
assert.ok(
  html.includes('_assistShell.open = true'),
  'sound badge click handler must unconditionally set _assistShell.open = true',
);
assert.ok(
  html.includes("selectAssistTab('notifications')"),
  "sound badge click handler must call selectAssistTab('notifications')",
);
assert.ok(
  html.includes("getElementById('assist-menu-strip')") && html.includes('scrollIntoView'),
  'sound badge handler must scroll #assist-menu-strip into view',
);
// No typeof guard needed since selectAssistTab is in same script scope
assert.ok(
  !html.includes("typeof selectAssistTab === 'function'"),
  'sound badge handler must NOT use typeof guard (same-scope direct call)',
);
console.log('  PASS: chat-sound-badge — 直接配線、open=true強制、assist-menu-strip スクロール');

console.log('\n✅ v113.3.103 clip左配置(center)/soundBadge直接配線 smoke PASSED');
