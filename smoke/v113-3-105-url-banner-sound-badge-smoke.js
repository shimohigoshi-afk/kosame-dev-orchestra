'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.105 URLバナー非表示修正/補助パネル常時展開 smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 105),
  `package version must be >= 113.3.105 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-105'], 'smoke:v113-3-105 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-105'), 'verify:dev-os must include smoke:v113-3-105');
console.log('  PASS: version >= 113.3.105');

const html = read('public/kosame-live-cockpit.html');

// ── ① .chat-url-banner[hidden] { display: none } が追加されている ────────────
// display:flex overrides UA [hidden]{display:none} — must explicitly override
assert.ok(
  html.includes('.chat-url-banner[hidden]') && html.includes('display: none'),
  '.chat-url-banner[hidden] must have display: none to override display:flex',
);
// The banner HTML must still have hidden attribute (initial state: not visible)
assert.ok(
  html.includes('id="chat-url-detected"') && html.includes('class="chat-url-banner" hidden'),
  '#chat-url-detected must still carry the hidden attribute in initial HTML',
);
console.log('  PASS: .chat-url-banner[hidden] — display:none追加、hidden属性初期値保持');

// ── ② chat-assist-shell <details> はデフォルト open ─────────────────────────
assert.ok(
  html.includes('class="chat-action-drawer chat-assist-shell"') &&
  html.includes('class="chat-action-drawer chat-assist-shell" aria-label="アシストパネル" open'),
  'chat-assist-shell details must have open attribute by default',
);
console.log('  PASS: chat-assist-shell — デフォルトopen（補助パネル常時展開）');

// ── ③ Sound badge click handler still intact (scrollIntoView + selectAssistTab) ─
assert.ok(
  html.includes("querySelector('.chat-assist-shell')"),
  'sound badge handler must still querySelector .chat-assist-shell',
);
assert.ok(
  html.includes("selectAssistTab('notifications')"),
  "sound badge handler must still call selectAssistTab('notifications')",
);
assert.ok(
  html.includes("getElementById('assist-menu-strip')") && html.includes('scrollIntoView'),
  'sound badge handler must still scroll #assist-menu-strip into view',
);
console.log('  PASS: sound badge click — selectAssistTab+scrollIntoView保持');

console.log('\n✅ v113.3.105 URLバナー非表示修正/補助パネル常時展開 smoke PASSED');
