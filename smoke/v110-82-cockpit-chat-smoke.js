#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function include(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include "${needle}"`);
}

console.log('=== v110.82 cockpit chat smoke ===');

const chatServerPath = path.join(__dirname, '..', 'tools', 'kosame-cockpit-chat-server.js');
const personaPath = path.join(__dirname, '..', 'config', 'kosame-cockpit-chat-persona.md');
const serverPath = path.join(__dirname, '..', 'tools', 'kosame-live-cockpit-server.js');
const htmlPath = path.join(__dirname, '..', 'public', 'kosame-live-cockpit.html');

mustExist(chatServerPath);
mustExist(personaPath);
mustExist(serverPath);
mustExist(htmlPath);
console.log('  PASS: required files exist');

assert.ok(pkg.version >= '110.82.0', `package version must be >= 110.82.0 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-82'], 'smoke:v110-82 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-82'), 'verify must include smoke:v110-82');
console.log('  PASS: package.json version and script entries');

const chatSource = read(chatServerPath);
include(chatSource, 'handleChatRequest', 'chat server source');
include(chatSource, 'loadPersona', 'chat server source');
include(chatSource, 'OPENAI_MODEL', 'chat server source');
include(chatSource, 'gpt-4o-mini', 'chat server source');
include(chatSource, 'process.env.OPENAI_API_KEY', 'chat server source');
include(chatSource, 'noKey', 'chat server source');
assert.ok(!/writeFileSync/.test(chatSource), 'chat server must not write files');
assert.ok(!/execFileSync/.test(chatSource), 'chat server must not execute subprocesses');
assert.ok(!/process\.stdin/.test(chatSource), 'chat server must not touch process.stdin');
assert.ok(!/DeepSeek|opencode/.test(chatSource), 'chat server must not use DeepSeek or opencode');
assert.ok(!/git add|git commit|git push|git tag|git reset/.test(chatSource), 'chat server must not execute git write operations');
assert.ok(!/console\.log.*apiKey|console\.log.*OPENAI_API_KEY/.test(chatSource), 'chat server must not log API key');
console.log('  PASS: chat server source safety checks');

const personaText = read(personaPath);
include(personaText, 'こさめ', 'persona');
include(personaText, 'じゅんやさん', 'persona');
include(personaText, '危険', 'persona');
include(personaText, 'DeepSeek', 'persona');
include(personaText, 'git add', 'persona');
console.log('  PASS: persona file content checks');

const serverSource = read(serverPath);
include(serverSource, '/api/chat', 'server source');
include(serverSource, 'kosame-cockpit-chat-server', 'server source');
include(serverSource, 'handleChatRequest', 'server source');
assert.ok(!/writeFileSync/.test(serverSource), 'server must not write files');
console.log('  PASS: cockpit server has /api/chat integration');

const html = read(htmlPath);
include(html, 'chat-thread', 'HTML');
include(html, 'chat-input', 'HTML');
include(html, 'chat-send', 'HTML');
include(html, 'chat-summarize', 'HTML');
include(html, 'こさめ', 'HTML');
include(html, 'APIキー未設定', 'HTML');
include(html, '/api/chat', 'HTML');
include(html, 'sendChatMessage', 'HTML');
include(html, 'renderChatThread', 'HTML');
include(html, 'confirmationContext', 'HTML');
assert.ok(!html.includes('onclick='), 'HTML must not include inline click handlers');
assert.ok(!html.includes('git add'), 'HTML must not mention git add');
assert.ok(!html.includes('git commit'), 'HTML must not mention git commit');
assert.ok(!html.includes('git push'), 'HTML must not mention git push');
assert.ok(!html.includes('OPENAI_API_KEY'), 'HTML must not reference OPENAI_API_KEY');
assert.ok(!html.includes('process.stdin'), 'HTML must not touch process.stdin');
assert.ok(!html.includes('execFileSync'), 'HTML must not execute subprocesses');
console.log('  PASS: HTML has chat UI and safety checks pass');

(async () => {
  const { handleChatRequest, loadPersona } = require('../tools/kosame-cockpit-chat-server');

  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const noKeyResult = await handleChatRequest({});
    assert.ok(noKeyResult.noKey === true, 'must return noKey=true when OPENAI_API_KEY is absent');
    assert.ok(typeof noKeyResult.reply === 'string', 'must return reply string');
    assert.ok(noKeyResult.reply.includes('APIキー未設定'), 'reply must use safe API-key-unset wording');
    assert.ok(!noKeyResult.reply.includes('OPENAI_API_KEY'), 'reply must not expose OPENAI_API_KEY');
    assert.ok(!(savedKey && noKeyResult.reply.includes(savedKey)), 'reply must not contain API key value');
    console.log('  PASS: handleChatRequest returns safe noKey response when API key absent');
  } finally {
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  }

  const personaLoaded = loadPersona();
  assert.ok(personaLoaded.includes('こさめ'), 'loadPersona must return persona with こさめ');
  assert.ok(personaLoaded.includes('じゅんやさん'), 'loadPersona must return persona with じゅんやさん');
  console.log('  PASS: loadPersona returns valid persona text');

  console.log('✅ v110.82 cockpit chat smoke PASSED');
})().catch((err) => {
  console.error('✗ FAIL:', err.message || err);
  process.exit(1);
});
