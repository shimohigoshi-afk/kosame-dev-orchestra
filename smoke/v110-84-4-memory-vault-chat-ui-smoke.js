#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { bootstrapMemoryVault } = require('../tools/kosame-memory-vault-bootstrap');
const {
  createTaskVault,
  readTaskVaultOverview,
  getTaskVaultPaths,
  saveCurrentState,
} = require('../tools/kosame-task-vault');
const { buildAutoSaveSnapshot } = require('../tools/kosame-autosave-state');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const BOOTSTRAP_TOOL_PATH = path.join(ROOT, 'tools', 'kosame-memory-vault-bootstrap.js');
const DEFAULT_VAULT = path.join(os.homedir(), '.kosame', 'task-vault');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-memory-vault-'));

const secretPhrase = 'OPENAI_API_KEY=sk-memory-vault-123456';
const customerPhrase = '顧客情報: 山田太郎 / customer@example.com';

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');
}

console.log('=== v110.84.4 memory vault / chat ui smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.4'), `package version must be >= 110.84.4 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-4'], 'smoke:v110-84-4 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-4'), 'verify must include smoke:v110-84-4');
mustExist(BOOTSTRAP_TOOL_PATH);
console.log('  PASS: package wiring for v110.84.4');

const defaultVaultExistedBefore = fs.existsSync(DEFAULT_VAULT);

process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;

const vault = createTaskVault(TEMP_VAULT);
assert.equal(vault.paths.root, TEMP_VAULT, 'createTaskVault must honor KOSAME_TASK_VAULT_DIR');
assert.equal(getTaskVaultPaths(TEMP_VAULT).memorySummaryJson, path.join(TEMP_VAULT, 'memory-summary.json'), 'memory summary path must be present');

const bootstrapResult = bootstrapMemoryVault(TEMP_VAULT, {
  currentMission: '☂️ KOSAME Console',
  targetRepo: ROOT,
  assignedAI: 'Codex',
  nextAction: 'Memory Vault を初期化して、チャット UI を確認する',
  currentState: {
    currentMission: '☂️ KOSAME Console',
    targetRepo: ROOT,
    assignedAI: 'Codex',
    nextAction: '次の一手を確認する',
    taskLists: {
      pending: ['作業記憶の確認'],
      inProgress: ['状態記憶の保存'],
      completed: [],
      hold: [],
    },
    handoffMemo: `${secretPhrase} / ${customerPhrase}`,
    safetyWarnings: [secretPhrase, customerPhrase],
    lastGitStatus: '## main...origin/main',
    lastVerifyResult: 'PASS',
  },
  memorySummary: {
    note: `${secretPhrase} / ${customerPhrase}`,
  },
  wishlistCount: 2,
});

assert.ok(Array.isArray(bootstrapResult.createdFiles), 'bootstrap must return createdFiles array');
assert.ok(bootstrapResult.createdFiles.some((file) => file.endsWith('memory-summary.json')), 'bootstrap must create memory-summary.json');

const currentStatePath = path.join(TEMP_VAULT, 'current-state.json');
const memorySummaryPath = path.join(TEMP_VAULT, 'memory-summary.json');
const tasksPath = path.join(TEMP_VAULT, 'tasks.jsonl');
const wishlistPath = path.join(TEMP_VAULT, 'wishlist.jsonl');
const decisionsPath = path.join(TEMP_VAULT, 'decisions.jsonl');
const handoffPath = path.join(TEMP_VAULT, 'handoff', 'latest-handoff.md');

[currentStatePath, memorySummaryPath, tasksPath, wishlistPath, decisionsPath, handoffPath].forEach(mustExist);
mustExist(path.join(TEMP_VAULT, 'autosaves'));
mustExist(path.join(TEMP_VAULT, 'checkpoints'));

const currentStateText = readText(currentStatePath);
const memorySummaryText = readText(memorySummaryPath);
assert.ok(!currentStateText.includes(secretPhrase), 'current-state.json must not contain raw secret phrase');
assert.ok(!currentStateText.includes(customerPhrase), 'current-state.json must not contain raw customer phrase');
assert.ok(!memorySummaryText.includes(secretPhrase), 'memory-summary.json must not contain raw secret phrase');
assert.ok(!memorySummaryText.includes(customerPhrase), 'memory-summary.json must not contain raw customer phrase');
assert.ok(currentStateText.includes('[REDACTED'), 'current-state.json must redact sensitive values');
assert.ok(memorySummaryText.includes('[REDACTED') || memorySummaryText.includes('memory_summary'), 'memory-summary.json must be safe and bootstrapped');

const overview = readTaskVaultOverview(TEMP_VAULT);
assert.ok(overview.memoryVault, 'overview must include memoryVault');
assert.ok(['ready', 'warning', 'missing'].includes(overview.memoryVault.status), 'memoryVault status must be present');
assert.equal(overview.memoryVault.workMemory.count, 2, 'work memory count must reflect pending/inProgress tasks');
assert.equal(overview.memoryVault.wishlistMemory.count, 2, 'wishlist memory count must reflect bootstrap input');
assert.ok(overview.memoryVault.stateMemory.lastUpdatedAt, 'state memory must include lastUpdatedAt');

const savedState = saveCurrentState(TEMP_VAULT, {
  currentMission: '☂️ KOSAME Console',
  targetRepo: ROOT,
  assignedAI: 'Codex',
  nextAction: 'Memory Vault を更新する',
  taskLists: {
    pending: ['作業記憶の確認'],
    inProgress: ['状態記憶の保存'],
    completed: ['bootstrap 完了'],
    hold: [],
  },
  wishlistCount: 3,
  lastGitStatus: '## main...origin/main',
  lastVerifyResult: 'PASS',
});
mustExist(savedState.path);
const refreshedOverview = readTaskVaultOverview(TEMP_VAULT);
assert.equal(refreshedOverview.memoryVault.workMemory.count, 2, 'saveCurrentState must keep work memory count in sync');
assert.equal(refreshedOverview.memoryVault.wishlistMemory.count, 3, 'saveCurrentState must keep wishlist count in sync');

const autoSnapshot = buildAutoSaveSnapshot({ taskVaultDir: TEMP_VAULT, savedAt: '2026-06-14T09:30:00.000Z' });
assert.ok(autoSnapshot.taskVault.memoryVault, 'autosave snapshot must include memoryVault');
assert.ok(autoSnapshot.autoSave.nextAutosaveAt, 'autosave snapshot must include nextAutosaveAt');

const cockpit = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  savedAt: '2026-06-14T09:35:00.000Z',
});
assert.ok(cockpit.memoryVault, 'cockpit snapshot must include memoryVault');
assert.ok(cockpit.chatStatus, 'cockpit snapshot must include chatStatus');
const chatAiStatus = normalizeStatus(cockpit.chatStatus.ai);
const chatContextStatus = normalizeStatus(cockpit.chatStatus.context);
const chatMemoryStatus = normalizeStatus(cockpit.chatStatus.memory);
assert.ok(['connected', 'missing'].includes(chatAiStatus), 'chat AI status must be connected or missing');
assert.ok(['loaded', 'missing'].includes(chatContextStatus), 'chat context status must be loaded or missing');
assert.ok(['ready', 'warning', 'missing'].includes(chatMemoryStatus), 'chat memory status must be surfaced');

const consoleContext = buildConsoleContextSummary(cockpit);
assert.ok(consoleContext.summary.includes('memoryVault='), 'console context must include memoryVault');
assert.ok(!consoleContext.summary.includes(secretPhrase), 'console context must not include raw secret phrase');
assert.ok(!consoleContext.summary.includes(customerPhrase), 'console context must not include raw customer phrase');
assert.ok(!consoleContext.summary.includes('OPENAI_API_KEY'), 'console context must not include API key name');

const html = readText(HTML_PATH);
assert.ok(html.includes('MEMORY VAULT'), 'HTML must include MEMORY VAULT');
assert.ok(html.includes('作業記憶'), 'HTML must include 作業記憶');
assert.ok(html.includes('状態記憶'), 'HTML must include 状態記憶');
assert.ok(html.includes('やりたいこと記憶'), 'HTML must include やりたいこと記憶');
assert.ok(html.includes('chat-bubble-user'), 'HTML must include user bubble class');
assert.ok(html.includes('chat-bubble-ai'), 'HTML must include assistant bubble class');
assert.ok(html.includes('chat-status-badges'), 'HTML must include chat status badges');
assert.ok(html.includes('chat-quick-actions'), 'HTML must include quick action buttons');
assert.ok(html.includes('chat-ai-badge'), 'HTML must include AI badge');
assert.ok(html.includes('chat-context-badge'), 'HTML must include Context badge');
assert.ok(html.includes('chat-memory-badge'), 'HTML must include Memory badge');
assert.ok(html.includes('chat-sound-badge'), 'HTML must include Sound badge');
assert.ok(html.includes('Enterで送信、Shift+Enterで改行'), 'HTML must document Enter / Shift+Enter behavior');
assert.ok(html.includes('こさめ考え中…☂️'), 'HTML must show thinking status');
assert.ok(html.includes('payload.contextSummary = latestSnapshot.consoleContextSummary;'), 'chat payload hotfix must remain');
assert.ok(html.includes('playNotificationChime'), 'notification chime must remain');
assert.ok(html.includes('DEV ORCHESTRA STATUS'), 'project registry status title must remain');
assert.ok(html.includes('SALES DX STATUS'), 'project registry status title must remain');

if (!defaultVaultExistedBefore) {
  assert.ok(!fs.existsSync(DEFAULT_VAULT), 'bootstrap must not create default ~/.kosame/task-vault when temp vault is used');
}

console.log('✅ v110.84.4 memory vault / chat ui smoke PASSED');
