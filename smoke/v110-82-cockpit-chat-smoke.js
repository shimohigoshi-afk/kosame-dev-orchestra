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
include(chatSource, 'buildLocalReply', 'chat server source');
include(chatSource, 'normalizeChatRequest', 'chat server source');
include(chatSource, 'suggested_action', 'chat server source');
include(chatSource, 'created_at', 'chat server source');
assert.ok(!chatSource.includes('api.openai.com'), 'chat server must not call OpenAI');
assert.ok(!chatSource.includes('OPENAI_API_KEY'), 'chat server must not read OpenAI API keys');
assert.ok(!chatSource.includes('GEMINI_API_KEY'), 'chat server must not read Gemini API keys');
assert.ok(!chatSource.includes('ANTHROPIC_API_KEY'), 'chat server must not read Claude API keys');
assert.ok(!/https\.request/.test(chatSource), 'chat server must not execute external HTTPS calls');
assert.ok(!/execFileSync/.test(chatSource), 'chat server must not execute subprocesses');
assert.ok(!/writeFileSync/.test(chatSource), 'chat server must not write files synchronously except chat log append');
console.log('  PASS: chat server source safety checks');

const personaText = read(personaPath);
include(personaText, 'こさめ', 'persona');
include(personaText, 'じゅんやさん', 'persona');
include(personaText, '危険', 'persona');
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
include(html, 'chat-proceed', 'HTML');
include(html, 'chat-summarize', 'HTML');
include(html, 'こさめ', 'HTML');
include(html, '/api/chat', 'HTML');
include(html, 'sendChatMessage', 'HTML');
include(html, 'renderChatThread', 'HTML');
include(html, 'Enterで送信 / Shift+Enterで改行', 'HTML');
assert.ok(!html.includes('>送信<'), 'HTML must not include a visible send button');
assert.ok(!html.includes('OPENAI_API_KEY'), 'HTML must not reference OpenAI API keys');
console.log('  PASS: HTML has chat UI and safety checks pass');

const { handleChatRequest, loadPersona } = require('../tools/kosame-cockpit-chat-server');

(async () => {
  const result = await handleChatRequest({
    message: '今の状況を教えて',
    project: 'KOSAME Console',
    context: 'currentVersion=110.84.19; shellActivity=ok; taskFeeder=ok; confirmationBridge=none',
  });
  assert.equal(result.ok, true, 'status query must succeed');
  assert.equal(typeof result.reply, 'string', 'reply must be string');
  assert.equal(typeof result.suggested_action, 'string', 'suggested_action must be string');
  assert.equal(result.human_gate_required, false, 'local responder must not require human gate');
  assert.ok(!result.reply.includes('currentVersion='), 'status reply must not expose raw key/value');
  assert.ok(!result.reply.includes('changed='), 'status reply must not expose raw change counts');
  assert.ok(/確認中|未コミット|正本化/.test(result.reply), 'status reply must read naturally');
  assert.ok(/確認|表示/.test(result.suggested_action), 'status suggested_action must be helpful');
  assert.ok(/T/.test(result.created_at), 'created_at must be ISO-like');
  console.log('  PASS: handleChatRequest returns local response');

  const personaLoaded = loadPersona();
  assert.ok(personaLoaded.includes('こさめ'), 'loadPersona must return persona with こさめ');
  assert.ok(personaLoaded.includes('じゅんやさん'), 'loadPersona must return persona with じゅんやさん');
  console.log('  PASS: loadPersona returns valid persona text');

  const rejectedEmpty = await handleChatRequest({ message: '   ' });
  assert.equal(rejectedEmpty.ok, false, 'empty message must be rejected');
  assert.ok(rejectedEmpty.error.includes('message'), 'empty message error must mention message');

  const rejectedLong = await handleChatRequest({ message: 'a'.repeat(2001) });
  assert.equal(rejectedLong.ok, false, 'overlong message must be rejected');
  assert.ok(rejectedLong.error.includes('長すぎ'), 'long message error must mention length');

  const rejectedSecret = await handleChatRequest({ message: 'sk-test-1234567890abcdef' });
  assert.equal(rejectedSecret.ok, false, 'secret-like message must be rejected');
  assert.ok(rejectedSecret.error.includes('secret'), 'secret-like rejection must be clear');

  console.log('✅ v110.82 cockpit chat smoke PASSED');
})().catch((err) => {
  console.error('✗ FAIL:', err.message || err);
  process.exit(1);
});
