'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.106 chat-dispatch source保持 / claudeChatExecutor実行 smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 106),
  `package version must be >= 113.3.106 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-106'], 'smoke:v113-3-106 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-106'), 'verify:dev-os must include smoke:v113-3-106');
console.log('  PASS: version >= 113.3.106');

const bridge = read('tools/kosame-codex-handoff-bridge-server.js');
const launcher = read('tools/kosame-claude-auto-launch.js');
const queue = read('tools/kosame-runner-queue.js');

// ── ① saveHandoffInbox が source を上書きしない ───────────────────────────────
// Old bad pattern: `source: 'kosame_console'` (hardcoded, overwrites chat-dispatch)
assert.ok(
  !bridge.includes("source: 'kosame_console'"),
  "saveHandoffInbox must NOT hardcode source: 'kosame_console' (overwrites chat-dispatch source)",
);
// New correct pattern: preserve safe.source
assert.ok(
  bridge.includes("source: safe.source || 'kosame_console'"),
  "saveHandoffInbox must use `source: safe.source || 'kosame_console'` to preserve chat-dispatch source",
);
console.log('  PASS: saveHandoffInbox — source: safe.source || kosame_console (chat-dispatch保持)');

// ── ② defaultExecutor が kosame-chat-dispatch を claudeChatExecutor に回す ─────
assert.ok(
  queue.includes("ticket.source === 'kosame-chat-dispatch'") && queue.includes('claudeChatExecutor'),
  "defaultExecutor must dispatch kosame-chat-dispatch tickets to claudeChatExecutor",
);
console.log('  PASS: defaultExecutor — kosame-chat-dispatch → claudeChatExecutor');

// ── ③ saveHandoffInbox round-trip: source preserved ──────────────────────────
const { saveHandoffInbox, readHandoffQueue } = require('../tools/kosame-codex-handoff-bridge-server');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v113-3-106-smoke-'));
const testPayload = {
  id: `smoke-v113-3-106-${Date.now()}`,
  title: 'test.htmlにHello Worldを作って',
  prompt_text: 'test.htmlにHello Worldを作って',
  target_repo: '/home/lavie/kosame-dev-orchestra',
  assigned_agent: 'claude_code',
  source: 'kosame-chat-dispatch',
  created_at: new Date().toISOString(),
};
try {
  const saveResult = saveHandoffInbox(testPayload, { handoffDir: tmpDir });
  assert.ok(saveResult.ok, 'saveHandoffInbox must return ok:true');
  const saved = saveResult.latestHandoff;
  assert.strictEqual(saved.source, 'kosame-chat-dispatch', `source must be preserved (got: ${saved.source})`);
  console.log('  PASS: saveHandoffInbox round-trip — source: kosame-chat-dispatch 保持');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ── ④ preamble に public/ ルールが追加されている ──────────────────────────────
assert.ok(
  launcher.includes('HTMLファイルは必ず public/ フォルダに作成する'),
  'DISPATCH_SAFETY_PREAMBLE must include public/ folder rule for HTML files',
);
assert.ok(
  launcher.includes("public/test.html"),
  'preamble example must show public/test.html',
);
console.log('  PASS: DISPATCH_SAFETY_PREAMBLE — HTML → public/ フォルダルール追加');

// ── ⑤ public/test.html が実際に存在する（end-to-end 確認） ─────────────────────
const testHtmlPath = path.join(ROOT, 'public', 'test.html');
assert.ok(
  fs.existsSync(testHtmlPath),
  `public/test.html must exist after end-to-end execution (not found at ${testHtmlPath})`,
);
const testHtmlContent = fs.readFileSync(testHtmlPath, 'utf8');
assert.ok(
  testHtmlContent.includes('Hello World'),
  'public/test.html must contain "Hello World"',
);
console.log('  PASS: public/test.html — end-to-end で生成済み (Hello World含む)');

console.log('\n✅ v113.3.106 chat-dispatch source保持 / claudeChatExecutor実行 smoke PASSED');
