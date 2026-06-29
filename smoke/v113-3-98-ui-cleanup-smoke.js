'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.98 UI cleanup smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 98),
  `package version must be >= 113.3.98 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-98'], 'smoke:v113-3-98 must exist in package.json');
assert.ok(
  pkg.scripts['verify:dev-os'] && pkg.scripts['verify:dev-os'].includes('smoke:v113-3-98'),
  'verify:dev-os must include smoke:v113-3-98',
);
console.log('  PASS: version >= 113.3.98');

const html = read('public/kosame-live-cockpit.html');

// ── ① clip icon removed ───────────────────────────────────────────────────────
assert.ok(
  !html.includes('id="chat-attach-btn"'),
  'chat-attach-btn must be removed from HTML',
);
assert.ok(
  !html.includes('id="chat-file-input"'),
  'chat-file-input must be removed from HTML',
);
// textarea still present
assert.ok(html.includes('id="chat-input"'), 'chat-input textarea must remain');
console.log('  PASS: clip icon (chat-attach-btn) removed, textarea remains');

// ── ② chat font size restored ─────────────────────────────────────────────────
assert.ok(
  /\.chat-bubble-text\s*\{[^}]*font-size:\s*15px/.test(html),
  '.chat-bubble-text font-size must be 15px',
);
console.log('  PASS: .chat-bubble-text font-size = 15px');

// ── ③ notification sound UI: ON/OFF buttons (short labels) ───────────────────
assert.ok(
  html.includes("{ label: 'ON', enabled: true }"),
  "sound ON button label must be 'ON' (not '通知音をONにする')",
);
assert.ok(
  html.includes("{ label: 'OFF', enabled: false }"),
  "sound OFF button label must be 'OFF' (not '通知音をOFFにする')",
);
assert.ok(
  !html.includes('通知音をONにする'),
  'old ON button label must be gone',
);
assert.ok(
  !html.includes('通知音をOFFにする'),
  'old OFF button label must be gone',
);
// Order: powerRow (ON/OFF) before modeDetails (音色 Soft/Clear/テスト)
const onIdx = html.indexOf("{ label: 'ON', enabled: true }");
const softIdx = html.indexOf("{ label: 'Soft', mode: 'soft' }");
assert.ok(onIdx > 0 && softIdx > 0 && onIdx < softIdx, '[ON][OFF] row must appear before Soft/Clear row');
console.log('  PASS: 通知音UI — [ON][OFF] → 音色:[Soft][Clear][テスト] 順序確認');

// ── queue.jsonl: target 7 IDs gone ───────────────────────────────────────────
const REMOVED_IDS = new Set([
  'handoff-110-84-30-live',
  'af91bee5-8cfd-4f28-8270-8fd208057b31',
  'a1ec4cce-b750-41a9-aba8-5b4e2123eedd',
  'chat-1782311688803',
  'chat-1782323923783',
  'chat-1782327170827',
  'chat-1782352652541',
]);
const queuePath = path.join(ROOT, '.kosame-handoff', 'queue.jsonl');
if (fs.existsSync(queuePath)) {
  const lines = fs.readFileSync(queuePath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const r = JSON.parse(line);
    assert.ok(!REMOVED_IDS.has(r.id), `ID must be removed from queue: ${r.id}`);
  }
  console.log(`  PASS: queue.jsonl — 7件削除済み (残 ${lines.length} 件)`);
}

console.log('\n✅ v113.3.98 UI cleanup smoke PASSED');
