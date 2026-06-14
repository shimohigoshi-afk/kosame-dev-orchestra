#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function include(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include "${needle}"`);
}

console.log('=== v110.84.3 persona smoke ===');

const personaPath = path.join(__dirname, '..', 'config', 'kosame-cockpit-chat-persona.md');
const contextPath = path.join(__dirname, '..', 'tools', 'kosame-cockpit-context.js');
const chatServerPath = path.join(__dirname, '..', 'tools', 'kosame-cockpit-chat-server.js');

mustExist(personaPath);
mustExist(contextPath);
mustExist(chatServerPath);
console.log('  PASS: required files exist');

assert.ok(pkg.version >= '110.84.3', `package version must be >= 110.84.3 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-3'], 'smoke:v110-84-3 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-3'), 'verify must include smoke:v110-84-3');
console.log('  PASS: package.json version and script wiring');

const personaText = read(personaPath);
include(personaText, 'こさめ', 'persona');
include(personaText, 'じゅんやさん', 'persona');
include(personaText, '柔らかい可愛い敬語', 'persona');
include(personaText, 'ですっ', 'persona');
include(personaText, '男性語', 'persona');
include(personaText, '危険ゲート', 'persona');
include(personaText, 'Task Vault', 'persona');
include(personaText, '良い例', 'persona');
include(personaText, '次の一手', 'persona');
include(personaText, '現在地', 'persona');
include(personaText, 'DeepSeek', 'persona');
assert.ok(!personaText.includes('私') || personaText.includes('禁止'), 'persona must prohibit 私');
assert.ok(!personaText.includes('事務的すぎる') || personaText.includes('禁止'), 'persona must prohibit overly formal tone');
console.log('  PASS: persona content matches v110.84.3 spec');

const contextSource = read(contextPath);
include(contextSource, 'nextCandidates', 'context source');
include(contextSource, 'selectedTasks', 'context source');
include(contextSource, 'laterIdeas', 'context source');
include(contextSource, 'ideaTitles', 'context source');
console.log('  PASS: context source includes task title logic');

const mockSnapshot = {
  version: '110.84.3',
  currentMission: 'v110.84.3 Persona Update',
  taskFeeder: {
    selectedTasks: [
      {
        title: '営業DX v0.3.0 スモーク整備',
        project: 'kosame-sales-dx',
        relatedVersion: '0.3.0',
        priority: 'P1',
        status: 'ready',
      },
    ],
    readyTaskCount: 1,
    blockedCount: 0,
    humanGateWaitingCount: 0,
    wishlist: {
      pendingCount: 0,
      suggestedCount: 1,
      laterIdeas: [{ title: 'transcriber v2.1.0 要件整理', wishlistId: 'w-001', status: 'pending' }],
      totalCount: 1,
    },
  },
  confirmationBridge: { detected: false },
  humanGate: [],
  warnings: [],
};

const ctx = buildConsoleContextSummary(mockSnapshot);
assert.equal(ctx.status, 'ok', 'context status must be ok');
assert.ok(ctx.summary.includes('taskFeeder='), 'context must include taskFeeder key');
assert.ok(ctx.summary.includes('nextCandidates='), 'context must include nextCandidates with task titles');
assert.ok(ctx.summary.includes('営業DX v0.3.0 スモーク整備'), 'context must include selected task title');
assert.ok(ctx.summary.includes('wishlist='), 'context must include wishlist key');
assert.ok(ctx.summary.includes('laterIdeas='), 'context must include laterIdeas with titles');
assert.ok(ctx.summary.includes('transcriber v2.1.0 要件整理'), 'context must include wishlist item title');
assert.ok(!ctx.summary.includes('OPENAI_API_KEY'), 'context must not leak API key name');
assert.ok(!ctx.summary.includes('Secret'), 'context must not contain Secret');
console.log('  PASS: context summary includes task/wishlist titles');

const chatServerSource = read(chatServerPath);
include(chatServerSource, 'loadPersona', 'chat server');
include(chatServerSource, 'contextSummary', 'chat server');
include(chatServerSource, 'process.env.OPENAI_API_KEY', 'chat server');
assert.ok(!/writeFileSync/.test(chatServerSource), 'chat server must not write files');
assert.ok(!/DeepSeek|opencode/.test(chatServerSource), 'chat server must not use DeepSeek/opencode');
console.log('  PASS: chat server source safety checks');

console.log('✅ v110.84.3 persona smoke PASSED');
