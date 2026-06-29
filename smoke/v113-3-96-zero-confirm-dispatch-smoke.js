'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.96 zero-confirm dispatch smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 96),
  `package version must be >= 113.3.96 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-96'], 'smoke:v113-3-96 must exist in package.json');
assert.ok(
  pkg.scripts['verify:dev-os'] && pkg.scripts['verify:dev-os'].includes('smoke:v113-3-96'),
  'verify:dev-os must include smoke:v113-3-96',
);

// ── HTML: zero-confirm dispatch ────────────────────────────────────────────────
const html = read('public/kosame-live-cockpit.html');

// 1. _zeroConfirmDispatch defined
assert.ok(html.includes('async function _zeroConfirmDispatch('), '_zeroConfirmDispatch must be defined');

// 2. Posts to /api/runner-dispatch with route: 'zero-confirm'
assert.ok(html.includes("route: 'zero-confirm'"), "_zeroConfirmDispatch must post route: 'zero-confirm'");

// 3. chat-proceed button calls _zeroConfirmDispatch
assert.ok(html.includes('_zeroConfirmDispatch(t)'), 'chat-proceed button must call _zeroConfirmDispatch');
assert.ok(!html.includes('submitPrioritizedChatInput(t);\n  });\n}'), 'chat-proceed must not call submitPrioritizedChatInput');

// 4. EXEC_TRIGGER_RE defined for trigger words
assert.ok(html.includes('EXEC_TRIGGER_RE'), 'EXEC_TRIGGER_RE must be defined');
assert.ok(html.includes('detectExecTrigger'), 'detectExecTrigger must be defined');
assert.ok(html.includes('実行して'), 'EXEC_TRIGGER_RE must include 実行して');
assert.ok(html.includes('進めて'), 'EXEC_TRIGGER_RE must include 進めて');

// 5. submitPrioritizedChatInput calls _zeroConfirmDispatch for trigger words
assert.ok(html.includes('detectExecTrigger(rawText)'), 'submitPrioritizedChatInput must check detectExecTrigger');

// 6. Button UI: single-column layout (below input, not to the right)
assert.ok(
  /\.chat-primary-row\s*\{[^}]*grid-template-columns:\s*1fr[^}]*\}/.test(html),
  '.chat-primary-row must use grid-template-columns: 1fr (single column)',
);
assert.ok(
  !html.includes('minmax(0, 1fr) minmax(180px, 250px)'),
  'chat-primary-row must not use 2-column layout for button',
);

console.log('  PASS: _zeroConfirmDispatch defined + calls /api/runner-dispatch with route:zero-confirm');
console.log('  PASS: chat-proceed button wired to _zeroConfirmDispatch');
console.log('  PASS: EXEC_TRIGGER_RE trigger words defined');
console.log('  PASS: submitPrioritizedChatInput trigger word detection added');
console.log('  PASS: .chat-primary-row single column (button below input)');

// ── Runner queue: streaming ───────────────────────────────────────────────────
const runner = read('tools/kosame-runner-queue.js');

assert.ok(
  runner.includes("stdio: ['ignore', 'inherit', 'pipe']"),
  "claudeChatExecutor must use stdio: ['ignore', 'inherit', 'pipe'] for real-time streaming",
);
assert.ok(runner.includes('[START]'), 'claudeChatExecutor must emit [START] to stdout');
assert.ok(runner.includes('[DONE]'), 'claudeChatExecutor must emit [DONE] to stdout');

console.log('  PASS: claudeChatExecutor streams via inherit stdout');

// ── Server: START/RUNNING/DONE SSE ────────────────────────────────────────────
const server = read('tools/kosame-live-cockpit-server.js');

assert.ok(server.includes('[START] zero-confirm dispatch'), 'runner-dispatch must emit [START] SSE');
assert.ok(server.includes('[RUNNING] Runner Queue'), 'runner-dispatch must emit [RUNNING] SSE');
assert.ok(server.includes('[DONE] zero-confirm dispatch'), 'runner-dispatch must emit [DONE] SSE');
assert.ok(server.includes('requestedRoute'), 'runner-dispatch must honor client-supplied route');

console.log('  PASS: server emits [START]/[RUNNING]/[DONE] SSE to AGENT STREAM LOG');
console.log('\n✅ v113.3.96 zero-confirm dispatch smoke PASSED');
