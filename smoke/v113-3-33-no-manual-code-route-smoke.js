#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.33 no manual code route smoke =====');

const bat = read('KOSAME.bat');
assert.ok(!/Claude Code対話窓|Codex Code対話窓|Claude Codeに投げてください|Codexに投げてください/.test(bat), 'main launcher must not expose manual code UI');
assert.ok(/Runner watcher/.test(bat), 'main launcher should name the runner watcher');
assert.ok(/npm run runner:watch/.test(bat), 'launcher should launch the runner watcher script');

const chatServer = read('tools/kosame-cockpit-chat-server.js');
assert.ok(chatServer.includes('official route'), 'chat server must describe official route');
assert.ok(chatServer.includes("executionHost: 'kosame-console'"), 'chat server must annotate console host');
assert.ok(chatServer.includes('manualCodeUiAllowed'), 'chat server must carry manualCodeUiAllowed');

const bridgeServer = read('tools/kosame-codex-handoff-bridge-server.js');
assert.ok(bridgeServer.includes('Runner Queue / Runner watcher') || bridgeServer.includes('Runner Queue が official route'), 'handoff bridge should describe runner queue dispatch');
assert.ok(bridgeServer.includes('official route'), 'handoff bridge should describe official route');

const liveServer = read('tools/kosame-live-cockpit-server.js');
assert.ok(liveServer.includes('blocked_interactive_host'), 'live server should preserve blocked interactive host results');
assert.ok(liveServer.includes('blocked_by_interactive_prompt'), 'live server should preserve blocked prompt results');

const html = read('public/kosame-live-cockpit.html');
assert.ok(html.includes('Runner Queue が official route で自動実行します。'), 'UI should say runner queue official route');
assert.ok(html.includes('executionHostAllowed'), 'UI should display execution host status');
assert.ok(html.includes('interactiveHostBlocked'), 'UI should display interactive host quarantine');
assert.ok(!html.includes('Claude Codeに投げてください'), 'UI must not instruct manual Claude routing');
assert.ok(!html.includes('結果を貼り戻してください'), 'UI must not instruct manual paste back');

console.log('  PASS: manual code route language removed from official route files');
