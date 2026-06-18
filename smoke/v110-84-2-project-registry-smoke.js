#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const chatServer = require('../tools/kosame-cockpit-chat-server');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const CONFIG_PATH = path.join(ROOT, 'config', 'kosame-projects.json');
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-project-registry-'));
const TEMP_CONFIG = path.join(TEMP_DIR, 'projects.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

console.log('=== v110.84.2 project registry smoke ===');

mustExist(CONFIG_PATH);
mustExist(HTML_PATH);
assert.ok(isVersionAtLeast(pkg.version, '110.84.2'), `package version must be >= 110.84.2 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-2'], 'smoke:v110-84-2 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-2'), 'verify must include smoke:v110-84-2');
console.log('  PASS: package wiring and base files exist');

const registry = JSON.parse(read(CONFIG_PATH));
assert.ok(Array.isArray(registry), 'config/kosame-projects.json must be an array');
assert.equal(registry.length, 2, 'project registry must contain 2 projects');
assert.equal(registry[0].id, 'dev-orchestra', 'first project must be dev-orchestra');
assert.equal(registry[1].id, 'sales-dx', 'second project must be sales-dx');
console.log('  PASS: project registry config is valid');

const snapshot = collectLiveCockpitSnapshot({
  projectRegistryPath: CONFIG_PATH,
  taskVaultDir: path.join(TEMP_DIR, 'vault'),
});
assert.ok(Array.isArray(snapshot.projects), 'snapshot.projects must be an array');
assert.ok(snapshot.projects.length >= 2, 'snapshot.projects must include configured projects');
assert.equal(snapshot.currentMission, '☂️ KOSAME Console', 'snapshot currentMission must be branding title');
assert.equal(snapshot.mode, 'Readonly', 'snapshot mode must be Readonly');
assert.ok(snapshot.projects.some((project) => project.statusTitle === 'DEV ORCHESTRA STATUS'), 'DEV ORCHESTRA STATUS must surface from registry');
assert.ok(snapshot.projects.some((project) => project.statusTitle === 'SALES DX STATUS'), 'SALES DX STATUS must surface from registry');
assert.ok(snapshot.devOrchestra && snapshot.salesDx, 'compatibility keys must remain available');
assert.equal(snapshot.devOrchestra.statusTitle, 'DEV ORCHESTRA STATUS', 'devOrchestra must keep statusTitle');
assert.equal(snapshot.salesDx.statusTitle, 'SALES DX STATUS', 'salesDx must keep statusTitle');
console.log('  PASS: snapshot exposes projects and compatibility keys');

const fallbackSnapshot = collectLiveCockpitSnapshot({
  projectRegistryPath: path.join(TEMP_DIR, 'missing-projects.json'),
  taskVaultDir: path.join(TEMP_DIR, 'fallback-vault'),
});
assert.ok(Array.isArray(fallbackSnapshot.projects), 'fallback snapshot projects must exist');
assert.ok(fallbackSnapshot.projects.some((project) => project.id === 'dev-orchestra'), 'fallback must include dev-orchestra');
assert.ok(fallbackSnapshot.projects.some((project) => project.id === 'sales-dx'), 'fallback must include sales-dx');
console.log('  PASS: missing config falls back to default project registry');

const customConfig = [
  {
    id: 'custom-project',
    name: 'Custom Project',
    shortName: 'CUSTOM',
    statusTitle: 'CUSTOM STATUS',
    repoPath: path.join(TEMP_DIR, 'missing-repo'),
    type: 'product',
    enabled: true,
  },
];
fs.writeFileSync(TEMP_CONFIG, `${JSON.stringify(customConfig, null, 2)}\n`, 'utf8');
const customSnapshot = collectLiveCockpitSnapshot({
  projectRegistryPath: TEMP_CONFIG,
  taskVaultDir: path.join(TEMP_DIR, 'custom-vault'),
});
assert.ok(customSnapshot.projects.length === 1, 'custom registry snapshot must include 1 project');
assert.equal(customSnapshot.projects[0].availability, 'not_found', 'missing repoPath must be marked not_found');
assert.ok(customSnapshot.projects[0].warnings.some((line) => line.includes('repoPath not_found')), 'missing repoPath must warn');
assert.ok(customSnapshot.projects[0].health === 'monitoring', 'missing repoPath must not become ERROR');
console.log('  PASS: missing repoPath is handled as warning/unavailable');

const html = read(HTML_PATH);
assert.ok(html.includes('☂️ KOSAME Console'), 'HTML must include new cockpit title');
assert.ok(html.includes('Dev Orchestra Command Center'), 'HTML must include subtitle');
assert.ok(html.includes('Readonly'), 'HTML must keep mode display');
assert.ok(!html.includes('☂️ KOSAME Readonly Monitor'), 'HTML must not keep old main title');
assert.ok(html.includes('DEV ORCHESTRA STATUS'), 'HTML must include dev-orchestra status title');
assert.ok(html.includes('SALES DX STATUS'), 'HTML must include sales-dx status title');
assert.ok(html.includes('NEXT TASK FEED'), 'HTML must keep task feeder section');
assert.ok(html.includes('WISHLIST / LATER IDEAS'), 'HTML must keep wishlist section');
assert.ok(html.includes('API COST METER'), 'HTML must keep cost meter section');
assert.ok(html.includes('sound-toggle'), 'HTML must keep notification sound toggle');
assert.ok(html.includes('sound-test'), 'HTML must keep notification sound test');
assert.ok(html.includes('buildChatPayload'), 'HTML must include chat payload helper');
assert.ok(html.includes('playNotificationChime'), 'HTML must include improved chime helper');
assert.ok(
  html.includes("payload.contextSummary = String(latestSnapshot.consoleContextSummary || '').slice(0, 800);"),
  'HTML must keep console context summary with safe truncation'
);
console.log('  PASS: HTML branding and existing features remain in place');

assert.equal(typeof chatServer.normalizeChatRequest, 'function', 'chat server must export normalizeChatRequest');
assert.equal(typeof buildConsoleContextSummary, 'function', 'context helper must be exported');
const messageForms = [
  { message: 'hello' },
  { text: 'hello' },
  { input: 'hello' },
  { prompt: 'hello' },
  { content: 'hello' },
  { messages: [{ role: 'user', content: 'hello' }] },
];
for (const form of messageForms) {
  const normalized = chatServer.normalizeChatRequest(form);
  assert.ok(Array.isArray(normalized.messages), 'normalized messages must be an array');
  assert.ok(normalized.messages.length >= 1, 'normalized messages must include content');
  assert.equal(normalized.messages[0].content, 'hello', 'normalized content must preserve message text');
  assert.equal(typeof normalized.contextSummary, 'string', 'normalized contextSummary must exist');
}
const blankNormalized = chatServer.normalizeChatRequest({ message: '   ' });
assert.equal(blankNormalized.messages.length, 0, 'blank message must normalize to empty');
assert.equal(blankNormalized.confirmationContext, '', 'blank confirmationContext must normalize to empty');
assert.equal(blankNormalized.contextSummary, '', 'blank contextSummary must normalize to empty');
console.log('  PASS: chat payload normalization accepts multiple input shapes');

const contextSnapshot = collectLiveCockpitSnapshot({
  projectRegistryPath: CONFIG_PATH,
  taskVaultDir: path.join(TEMP_DIR, 'context-vault'),
});
const consoleContext = buildConsoleContextSummary(contextSnapshot);
assert.equal(consoleContext.status, 'ok', 'console context summary must be ok');
assert.ok(consoleContext.summary.includes('KOSAME Console'), 'context summary must mention KOSAME Console');
assert.ok(consoleContext.summary.includes('taskFeeder='), 'context summary must include taskFeeder');
assert.ok(consoleContext.summary.includes('wishlist='), 'context summary must include wishlist');
assert.ok(consoleContext.summary.includes('memoryVault='), 'context summary must include memoryVault');
assert.ok(consoleContext.summary.includes('autoSave='), 'context summary must include autoSave');
assert.ok(consoleContext.summary.includes('cost='), 'context summary must include cost');
assert.ok(consoleContext.summary.includes('confirmationBridge='), 'context summary must include confirmationBridge');
assert.ok(consoleContext.summary.includes(`releaseTag=v${pkg.version}`), 'context summary must include release tag');
assert.ok(!consoleContext.summary.includes('OPENAI_API_KEY'), 'context summary must not contain API key name');
assert.ok(!consoleContext.summary.includes('Secret'), 'context summary must not contain Secret');
assert.ok(!consoleContext.summary.includes('.env'), 'context summary must not contain .env');
assert.ok(!consoleContext.summary.includes('credentials'), 'context summary must not contain credentials');
assert.ok(!consoleContext.summary.includes('customer@example.com'), 'context summary must not contain customer data');
console.log('  PASS: context summary helper keeps secrets out');

Promise.resolve(chatServer.handleChatRequest({
  message: '今の状況を教えて',
  project: 'KOSAME Console',
  context: 'currentVersion=110.84.19; shellActivity=ok; taskFeeder=ok; confirmationBridge=none',
}))
  .then((result) => {
    assert.equal(result.ok, true, 'local chat handler must succeed');
    assert.equal(typeof result.reply, 'string', 'local chat handler must return reply');
    assert.equal(typeof result.suggested_action, 'string', 'local chat handler must return suggested_action');
    assert.equal(result.human_gate_required, false, 'local chat handler must keep human_gate_required false');
    assert.ok(!result.reply.includes('currentVersion='), 'reply must not expose raw key/value');
    assert.ok(!result.reply.includes('changed='), 'reply must not expose raw change counts');
    assert.ok(/確認中|未コミット|正本化/.test(result.reply), 'reply must read naturally');
    console.log('  PASS: chat handler returns local status reply');
  })
  .catch((error) => {
    throw error;
  });

console.log('✅ v110.84.2 project registry smoke PASSED');
