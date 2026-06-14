#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEV_ORCHESTRA_REPO = ROOT;
const SALES_DX_REPO = '/home/lavie/repos/kosame-sales-dx';
const PACKAGE = require('../package.json');
const { buildAutoSaveSnapshot } = require('./kosame-autosave-state');
const { buildApiCostSnapshot } = require('./kosame-cost-meter');
const { buildTaskFeederSnapshot } = require('./kosame-task-feeder');

const READ_ONLY_COMMANDS = new Set([
  'git status -sb',
  'git diff --name-only',
  'git diff --cached --name-only',
  'git log --oneline -5',
  'gh run list --limit 5',
]);

function runReadOnlyCommand(cwd, argv) {
  const commandKey = argv.join(' ');
  if (!READ_ONLY_COMMANDS.has(commandKey)) {
    throw new Error(`Blocked non-read-only command: ${commandKey}`);
  }

  try {
    const output = execFileSync(argv[0], argv.slice(1), {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
      ok: true,
      output: String(output || '').trim(),
      command: commandKey,
    };
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : '';
    const message = stderr || String(error && error.message ? error.message : error);
    return {
      ok: false,
      output: message,
      command: commandKey,
    };
  }
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);
}

function normalizeList(output) {
  return splitLines(output).filter(line => line !== 'No local changes');
}

function normalizeCommitLines(output) {
  return splitLines(output).map(line => {
    const [hash = '', ...rest] = line.split(' ');
    return {
      hash,
      summary: rest.join(' ').trim(),
      raw: line,
    };
  });
}

function buildRepoState({ name, label, cwd }) {
  const status = runReadOnlyCommand(cwd, ['git', 'status', '-sb']);
  const changed = runReadOnlyCommand(cwd, ['git', 'diff', '--name-only']);
  const staged = runReadOnlyCommand(cwd, ['git', 'diff', '--cached', '--name-only']);
  const commits = runReadOnlyCommand(cwd, ['git', 'log', '--oneline', '-5']);
  const actions = runReadOnlyCommand(cwd, ['gh', 'run', 'list', '--limit', '5']);

  const statusLines = splitLines(status.output);
  const changedFiles = normalizeList(changed.output);
  const stagedFiles = normalizeList(staged.output);
  const recentCommits = normalizeCommitLines(commits.output);
  const githubActions = splitLines(actions.output);
  const dirty = changedFiles.length > 0 || stagedFiles.length > 0;

  const warnings = [];
  if (!status.ok) warnings.push(`${label}: git status unavailable`);
  if (!changed.ok) warnings.push(`${label}: changed files unavailable`);
  if (!staged.ok) warnings.push(`${label}: staged files unavailable`);
  if (!commits.ok) warnings.push(`${label}: recent commits unavailable`);
  if (!actions.ok) warnings.push(`${label}: GitHub Actions unavailable`);
  if (!fs.existsSync(cwd)) warnings.push(`${label}: repo path missing`);

  return {
    name,
    label,
    path: cwd,
    statusLines,
    changedFiles,
    stagedFiles,
    recentCommits,
    githubActions,
    dirty,
    warnings,
    readOnlyCommands: [
      status.command,
      changed.command,
      staged.command,
      commits.command,
      actions.command,
    ],
    health: !warnings.length && !dirty ? 'clean' : dirty ? 'attention' : 'monitoring',
  };
}

function collectLiveCockpitSnapshot(options = {}) {
  const devRepoPath = options.devRepoPath || DEV_ORCHESTRA_REPO;
  const salesRepoPath = options.salesRepoPath || SALES_DX_REPO;
  const activeRepoPath = options.activeRepoPath || devRepoPath;
  const taskVaultDir = options.taskVaultDir;
  const taskVaultSnapshot = buildAutoSaveSnapshot({
    taskVaultDir,
    savedAt: options.savedAt,
  });
  const taskVault = taskVaultSnapshot.taskVault;
  const autoSave = taskVaultSnapshot.autoSave;
  const apiCost = buildApiCostSnapshot(taskVaultDir);
  const taskFeeder = buildTaskFeederSnapshot({
    taskVaultDir,
    currentVersion: PACKAGE.version,
    currentMission: '☂️ KOSAME Readonly Monitor',
  });

  const devOrchestra = buildRepoState({
    name: 'dev-orchestra',
    label: 'KOSAME Dev Orchestra',
    cwd: devRepoPath,
  });

  const salesDx = buildRepoState({
    name: 'sales-dx',
    label: 'kosame-sales-dx',
    cwd: salesRepoPath,
  });

  const warnings = [
    'この cockpit は read-only 監視専用です。git add / commit / push / tag / reset / checkout は使いません。',
    'Secret / API key / .env / credentials の中身は読みません。',
    taskVault.status !== 'ok'
      ? `Task Vault は ${taskVault.status.toUpperCase()} 状態です。`
      : null,
    taskVault.warningCount > 0
      ? `Task Vault に ${taskVault.warningCount} 件の保存禁止データ検出があります。`
      : null,
    apiCost.warningCount > 0
      ? `API Cost Meter に ${apiCost.warningCount} 件の警告があります。`
      : null,
    taskFeeder.warnings.length > 0
      ? `Task Feeder に ${taskFeeder.warnings.length} 件の警告があります。`
      : null,
    ...devOrchestra.warnings,
    ...salesDx.warnings,
  ].filter(Boolean);

  if (devOrchestra.dirty || salesDx.dirty) {
    warnings.push('監視対象のどちらかに未コミットまたはステージ済み変更があります。');
  }

  const humanGate = [
    '書き込み操作の前には必ず人間承認が必要です。',
    'commit 候補に進む前に changed files と staged files を確認してください。',
    'DeepSeek / opencode はこの cockpit では使いません。',
  ];

  const nextAction = taskFeeder.selectedTasks.length > 0
    ? taskFeeder.nextAction
    : warnings.some(w => w.includes('unavailable') || w.includes('missing'))
      ? 'read-only のまま、取得できないフィードの状態を確認してください。'
      : (devOrchestra.dirty || salesDx.dirty)
      ? 'changed files と staged files を見直し、書き込み前の人間承認を待ってください。'
      : '引き続き passive monitoring を続けてください。この cockpit からの書き込みはできません。';

  return {
    version: PACKAGE.version,
    generatedAt: new Date().toISOString(),
    currentMission: '☂️ KOSAME Readonly Monitor',
    activeRepo: {
      label: activeRepoPath === salesRepoPath ? 'kosame-sales-dx' : 'KOSAME Dev Orchestra',
      path: activeRepoPath,
    },
    monitoredRepos: [devOrchestra, salesDx],
    devOrchestra,
    salesDx,
    taskVault,
    autoSave,
    apiCost,
    taskFeeder,
    wishlist: taskFeeder.wishlist,
    humanGate,
    warnings,
    nextAction,
    readOnlyPolicy: Array.from(READ_ONLY_COMMANDS),
  };
}

if (require.main === module) {
  const snapshot = collectLiveCockpitSnapshot();
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

module.exports = {
  collectLiveCockpitSnapshot,
  READ_ONLY_COMMANDS,
};
