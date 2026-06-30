'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.102 clip右配置/soundBadgeクリック/SSE新着のみ smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 102),
  `package version must be >= 113.3.102 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-102'], 'smoke:v113-3-102 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-102'), 'verify:dev-os must include smoke:v113-3-102');
console.log('  PASS: version >= 113.3.102');

const html = read('public/kosame-live-cockpit.html');

// ── ① クリップアイコン: テキストエリアの右側に移動、align-items: flex-end ──────────
assert.ok(html.includes('id="chat-attach-btn"'), 'chat-attach-btn must be present');
assert.ok(html.includes('id="chat-input"'), 'chat-input textarea must remain');

// button must be AFTER textarea inside chat-input-with-btn (right side)
const inputWithBtnIdx = html.indexOf('class="chat-input-with-btn"');
const textareaIdx = html.indexOf('id="chat-input"');
const attachBtnIdx = html.indexOf('id="chat-attach-btn"');
assert.ok(inputWithBtnIdx > 0, 'chat-input-with-btn must exist');
assert.ok(attachBtnIdx > textareaIdx, 'chat-attach-btn must appear AFTER textarea (right-side position)');
assert.ok(attachBtnIdx > inputWithBtnIdx, 'chat-attach-btn must be inside chat-input-with-btn');

// align-items: flex-end (not flex-start)
assert.ok(
  /\.chat-input-with-btn\s*\{[^}]*align-items:\s*flex-end/.test(html),
  '.chat-input-with-btn must have align-items: flex-end (button aligns to bottom-right)',
);
// margin-bottom (not margin-top) on chat-attach-btn
assert.ok(
  /\.chat-attach-btn\s*\{[^}]*margin-bottom/.test(html),
  '.chat-attach-btn must have margin-bottom (not margin-top)',
);
assert.ok(
  !/\.chat-attach-btn\s*\{[^}]*margin-top/.test(html),
  '.chat-attach-btn must NOT have margin-top',
);
console.log('  PASS: クリップアイコン — テキストエリア右横(flex-end)配置');

// ── ② chat-sound-badge クリックで補助メニュー通知設定を開く ──────────────────────
assert.ok(
  html.includes("querySelector('.chat-assist-shell')"),
  'sound badge click handler must querySelector .chat-assist-shell',
);
assert.ok(
  html.includes("selectAssistTab('notifications')"),
  "sound badge click handler must call selectAssistTab('notifications')",
);
assert.ok(
  html.includes("'chat-sound-badge'") && html.includes("style.cursor = 'pointer'"),
  'sound badge must have cursor:pointer set',
);
console.log('  PASS: chat-sound-badge — クリックで通知設定タブを開く');

// ── ③ SSE log handler: 新着のみ addAgentStreamLog に渡す ────────────────────────
// Must use isNew flag to gate both stopAslDemo and addAgentStreamLog
assert.ok(
  html.includes('var isNew = _sseConnectedAt > 0 && eventTs >= _sseConnectedAt - 500'),
  'SSE log handler must use isNew variable',
);
assert.ok(
  html.includes('if (isNew)'),
  'SSE log handler must gate addAgentStreamLog behind isNew',
);
// Replayed events (isNew===false) must NOT reach addAgentStreamLog — verified by the structure:
// addAgentStreamLog call must be inside the if(isNew) block
const sseBlock = html.match(/es\.addEventListener\(['"]log['"][\s\S]*?es\.addEventListener\(['"]done['"]/);
assert.ok(sseBlock, 'SSE log handler block must exist');
const logHandlerBody = sseBlock[0];
assert.ok(
  logHandlerBody.includes('if (isNew)') && logHandlerBody.includes('addAgentStreamLog'),
  'addAgentStreamLog must be inside if(isNew) block',
);
// The old always-call pattern must be gone
assert.ok(
  !logHandlerBody.includes('}\n      if (typeof window.addAgentStreamLog'),
  'addAgentStreamLog must NOT be called unconditionally after the isNew guard',
);
console.log('  PASS: SSE log — 新着のみ(isNew)ASLに追記、リプレイ除外');

console.log('\n✅ v113.3.102 clip右配置/soundBadgeクリック/SSE新着のみ smoke PASSED');
