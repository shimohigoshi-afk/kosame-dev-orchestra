#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEV_ORCHESTRA_REPO = ROOT;
const SALES_DX_REPO = '/home/lavie/repos/kosame-sales-dx';
const DEFAULT_PROJECT_REGISTRY_PATH = path.join(ROOT, 'config', 'kosame-projects.json');
const PACKAGE = require('../package.json');
const { buildAutoSaveSnapshot } = require('./kosame-autosave-state');
const { buildApiCostSnapshot } = require('./kosame-cost-meter');
const { buildTaskFeederSnapshot } = require('./kosame-task-feeder');
const { buildConsoleContextSummary } = require('./kosame-cockpit-context');

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

function runGitReadOnly(argv) {
  try {
    const output = execFileSync('git', argv, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return String(output || '').trim();
  } catch {
    return '';
  }
}

function resolveVersionContext() {
  const packageVersion = String(PACKAGE.version || 'unknown');
  const headCommit = runGitReadOnly(['rev-parse', '--short', 'HEAD']) || 'unknown';
  const exactTag = runGitReadOnly(['describe', '--tags', '--exact-match', 'HEAD']);
  const latestTag = exactTag || runGitReadOnly(['describe', '--tags', '--abbrev=0']) || `v${packageVersion}`;
  return {
    packageVersion,
    currentVersion: packageVersion,
    latestTag,
    headCommit,
    source: exactTag ? 'git-tag' : 'package.json',
  };
}

function fallbackProjectRegistry() {
  return [
    {
      id: 'dev-orchestra',
      name: 'KOSAME Dev Orchestra',
      shortName: 'DEV ORCHESTRA',
      statusTitle: 'DEV ORCHESTRA STATUS',
      repoPath: DEV_ORCHESTRA_REPO,
      type: 'dev-os',
      enabled: true,
    },
    {
      id: 'sales-dx',
      name: 'Sales DX',
      shortName: 'SALES DX',
      statusTitle: 'SALES DX STATUS',
      repoPath: SALES_DX_REPO,
      type: 'product',
      enabled: true,
    },
  ];
}

function normalizeProjectEntry(entry, index = 0) {
  const id = String(entry && entry.id ? entry.id : `project-${index + 1}`);
  const shortName = entry && entry.shortName ? String(entry.shortName) : id.toUpperCase();
  return {
    id,
    name: entry && entry.name ? String(entry.name) : shortName,
    shortName,
    statusTitle: entry && entry.statusTitle ? String(entry.statusTitle) : `${shortName} STATUS`,
    repoPath: entry && entry.repoPath ? String(entry.repoPath) : '',
    type: entry && entry.type ? String(entry.type) : 'unknown',
    enabled: entry && entry.enabled !== false,
  };
}

function loadProjectRegistry(projectRegistryPath = DEFAULT_PROJECT_REGISTRY_PATH) {
  const registryPath = projectRegistryPath ? path.resolve(String(projectRegistryPath)) : DEFAULT_PROJECT_REGISTRY_PATH;
  try {
    if (!fs.existsSync(registryPath)) return fallbackProjectRegistry();
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const entries = Array.isArray(raw) ? raw : Array.isArray(raw && raw.projects) ? raw.projects : [];
    const normalized = entries.map((entry, index) => normalizeProjectEntry(entry, index)).filter(Boolean);
    return normalized.length ? normalized : fallbackProjectRegistry();
  } catch {
    return fallbackProjectRegistry();
  }
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
  const availability = fs.existsSync(cwd) ? 'available' : 'not_found';

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
    availability,
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

function buildProjectState(project, options = {}) {
  const repoPath = project.repoPath || '';
  const repoState = buildRepoState({
    name: project.id,
    label: project.name || project.shortName || project.statusTitle || project.id,
    cwd: repoPath || path.join(ROOT, '__missing__', project.id),
  });
  const missingRepo = !repoPath || !fs.existsSync(repoPath);
  const warnings = [...(repoState.warnings || [])];
  if (missingRepo) {
    warnings.unshift(`${project.statusTitle || project.name || project.id}: repoPath not_found`);
  }

  return {
    ...project,
    repoPath: repoPath || project.repoPath || '',
    statusTitle: project.statusTitle || `${project.shortName || project.name || project.id} STATUS`,
    availability: missingRepo ? 'not_found' : 'available',
    warnings,
    warningCount: warnings.length,
    dirty: repoState.dirty,
    statusLines: repoState.statusLines,
    changedFiles: repoState.changedFiles,
    stagedFiles: repoState.stagedFiles,
    recentCommits: repoState.recentCommits,
    githubActions: repoState.githubActions,
    readOnlyCommands: repoState.readOnlyCommands,
    health: missingRepo ? 'monitoring' : repoState.health,
    path: repoPath || repoState.path,
    label: project.name || project.shortName || project.statusTitle || project.id,
  };
}

function collectLiveCockpitSnapshot(options = {}) {
  const devRepoPath = options.devRepoPath || DEV_ORCHESTRA_REPO;
  const salesRepoPath = options.salesRepoPath || SALES_DX_REPO;
  const activeRepoPath = options.activeRepoPath || devRepoPath;
  const projectRegistry = loadProjectRegistry(options.projectRegistryPath);
  const versionContext = resolveVersionContext();
  const projects = projectRegistry
    .filter((project) => project.enabled !== false)
    .map((project) => buildProjectState(project, options));
  const findProject = (id) => projects.find((project) => project.id === id || project.name === id || project.shortName === id);
  const taskVaultDir = options.taskVaultDir;
  const taskVaultSnapshot = buildAutoSaveSnapshot({
    taskVaultDir,
    savedAt: options.savedAt,
  });
  const taskVault = taskVaultSnapshot.taskVault;
  const autoSave = taskVaultSnapshot.autoSave;
  const memoryVault = taskVault.memoryVault || taskVaultSnapshot.memoryVault || null;
  const apiCost = buildApiCostSnapshot(taskVaultDir);
  const taskFeeder = buildTaskFeederSnapshot({
    taskVaultDir,
    currentVersion: versionContext.currentVersion,
    currentMission: '☂️ KOSAME Console',
  });
  const devOrchestra = findProject('dev-orchestra') || buildProjectState({
    id: 'dev-orchestra',
    name: 'KOSAME Dev Orchestra',
    shortName: 'DEV ORCHESTRA',
    statusTitle: 'DEV ORCHESTRA STATUS',
    repoPath: devRepoPath,
    type: 'dev-os',
    enabled: true,
  }, options);
  const salesDx = findProject('sales-dx') || buildProjectState({
    id: 'sales-dx',
    name: 'Sales DX',
    shortName: 'SALES DX',
    statusTitle: 'SALES DX STATUS',
    repoPath: salesRepoPath,
    type: 'product',
    enabled: true,
  }, options);

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
    memoryVault && memoryVault.status && memoryVault.status !== 'ready'
      ? `Memory Vault は ${String(memoryVault.status).toUpperCase()} 状態です。`
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

  const consoleContext = buildConsoleContextSummary({
    version: versionContext.currentVersion,
    currentVersion: versionContext.currentVersion,
    packageVersion: versionContext.packageVersion,
    latestTag: versionContext.latestTag,
    headCommit: versionContext.headCommit,
    versionSource: versionContext.source,
    currentMission: '☂️ KOSAME Console',
    mode: 'Readonly',
    projectRegistryPath: options.projectRegistryPath ? path.resolve(String(options.projectRegistryPath)) : DEFAULT_PROJECT_REGISTRY_PATH,
    projects,
    devOrchestra,
    salesDx,
    monitoredRepos: [devOrchestra, salesDx],
    taskFeeder,
    wishlist: taskFeeder.wishlist,
    memoryVault,
    autoSave,
    apiCost,
    confirmationBridge: options.confirmationBridge || null,
    humanGate,
    warnings,
  });

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
    currentMission: '☂️ KOSAME Console',
    mode: 'Readonly',
    activeRepo: {
      label: projects.find((project) => project.repoPath === activeRepoPath)?.name
        || (activeRepoPath === salesRepoPath ? 'Sales DX' : 'KOSAME Dev Orchestra'),
      path: activeRepoPath,
    },
    projectRegistryPath: options.projectRegistryPath ? path.resolve(String(options.projectRegistryPath)) : DEFAULT_PROJECT_REGISTRY_PATH,
    projects,
    monitoredRepos: [devOrchestra, salesDx],
    devOrchestra,
    salesDx,
    taskVault,
    autoSave,
    apiCost,
    taskFeeder,
    wishlist: taskFeeder.wishlist,
    memoryVault,
    chatStatus: {
      ai: process.env.OPENAI_API_KEY ? 'connected' : 'missing',
      context: consoleContext.status === 'ok' ? 'loaded' : 'missing',
      memory: memoryVault?.status || 'missing',
    },
    confirmationBridge: options.confirmationBridge || null,
    consoleContextSummary: consoleContext.summary,
    consoleContextStatus: consoleContext.status,
    currentVersion: versionContext.currentVersion,
    packageVersion: versionContext.packageVersion,
    latestTag: versionContext.latestTag,
    headCommit: versionContext.headCommit,
    versionSource: versionContext.source,
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
  loadProjectRegistry,
};
