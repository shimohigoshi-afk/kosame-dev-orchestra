#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEV_ORCHESTRA_REPO = ROOT;
const SALES_DX_REPO = '/home/lavie/repos/kosame-sales-dx';
const DEFAULT_PROJECT_REGISTRY_PATH = path.join(ROOT, 'config', 'kosame-projects.json');
const DEFAULT_ACTIVITY_LOG_PATH = path.join(os.homedir(), '.kosame', 'activity-events.jsonl');
const PACKAGE = require('../package.json');
const { buildAutoSaveSnapshot } = require('./kosame-autosave-state');
const { buildApiCostSnapshot } = require('./kosame-cost-meter');
const { buildTaskFeederSnapshot } = require('./kosame-task-feeder');
const { readShellAgentActivity } = require('./kosame-shell-agent-activity');
const { buildConsoleContextSummary } = require('./kosame-cockpit-context');
const { readLatestApprovedWorkOrder } = require('./kosame-work-order-approval-store');
const { readLatestWorkOrderHandoff } = require('./kosame-work-order-handoff-store');
const { readLatestWorkOrderResult, readWorkOrderResultHistory } = require('./kosame-work-order-result-store');
const { buildWorkOrderResultDecision } = require('./kosame-work-order-result-decision');
const { getConfig: getProviderConfig } = require('../providers/provider-config');

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

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function readJsonlRecords(filePath, limit = 120) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const slice = typeof limit === 'number' && limit > 0 ? lines.slice(-limit) : lines;
    const records = [];
    for (const line of slice) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === 'object') records.push(parsed);
      } catch {
        // skip malformed activity rows
      }
    }
    return records;
  } catch {
    return [];
  }
}

function formatAgo(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const delta = Date.now() - date.getTime();
  const abs = Math.abs(delta);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  if (abs < minute) return `約${Math.max(1, Math.round(abs / 1000))}秒前`;
  if (abs < hour) return `約${Math.max(1, Math.round(abs / minute))}分前`;
  return `約${Math.max(1, Math.round(abs / hour))}時間前`;
}

function summarizeProjectName(project) {
  return String(project && (project.statusTitle || project.shortName || project.name || project.id) || '').trim();
}

function normalizeEventKind(event) {
  const type = String((event && event.eventType) || '').toLowerCase();
  const status = String((event && event.status) || '').toLowerCase();
  if (status === 'blocked' || type.includes('blocked')) return 'BLOCKED';
  if (type.includes('human_gate')) return 'HUMAN_GATE';
  if (type.includes('verify_passed') || type.includes('review_passed')) return 'VERIFY_PASS';
  if (type.includes('verify_failed') || type.includes('review_failed') || type.includes('task_failed')) return 'ERROR';
  if (type.includes('verify_started')) return 'VERIFY';
  if (type.includes('review_started')) return 'WAITING';
  if (type.includes('task_completed')) return 'DONE';
  if (type.includes('task_started') || type.includes('agent_assigned')) return 'START';
  if (type.includes('agent_started') || type.includes('repair_started') || type.includes('file_changed') || type.includes('fallback_started')) return 'RUNNING';
  if (type.includes('file_read')) return 'RUNNING';
  if (status === 'pass') return 'VERIFY_PASS';
  if (status === 'fail') return 'ERROR';
  return 'RUNNING';
}

function buildAgentEventTemplate(event) {
  const kind = normalizeEventKind(event);
  const actor = String((event && (event.agent || event.provider || event.project)) || 'KOSAME').trim() || 'KOSAME';
  const project = String((event && event.project) || '').trim();
  const taskId = String((event && event.taskId) || '').trim();
  const timestamp = String((event && event.timestamp) || '').trim();
  const baseMessages = {
    START: 'これやります',
    RUNNING: '進めています',
    VERIFY: 'verifyを確認しています',
    VERIFY_PASS: 'PASSしました',
    HUMAN_GATE: '確認が必要ですね',
    DONE: '完了しました',
    ERROR: '止まりました。確認が必要です',
    WAITING: '応答待ちです',
    BLOCKED: 'ここで止まっています',
  };
  const message = baseMessages[kind] || '実行中です';
  const severity = {
    START: 'running',
    RUNNING: 'running',
    VERIFY: 'running',
    VERIFY_PASS: 'done',
    HUMAN_GATE: 'human_gate',
    DONE: 'done',
    ERROR: 'error',
    WAITING: 'waiting',
    BLOCKED: 'blocked',
  }[kind] || 'running';
  const speech = `${actor}「${message}」`;

  return {
    kind,
    actor,
    message,
    text: speech,
    speech,
    severity,
    project,
    taskId,
    timestamp,
  };
}

function buildAgentEventFeed(activityEvents, context = {}) {
  const events = Array.isArray(activityEvents) ? activityEvents : [];
  const latest = events
    .slice(-24)
    .map(buildAgentEventTemplate)
    .reverse();
  const fallbackTasks = [];
  const taskFeeder = context.taskFeeder || {};
  const selectedTasks = Array.isArray(taskFeeder.selectedTasks) ? taskFeeder.selectedTasks : [];
  const humanGateTasks = Array.isArray(taskFeeder.humanGateTasks) ? taskFeeder.humanGateTasks : [];
  const blockedTasks = Array.isArray(taskFeeder.blockedTasks) ? taskFeeder.blockedTasks : [];

  const templates = [
    ['START', 'Codex', 'これやります', selectedTasks[0]],
    ['RUNNING', 'Claude Code', '進めています', selectedTasks[1] || selectedTasks[0]],
    ['VERIFY', 'Claude Code', 'verifyを確認しています', selectedTasks[2] || selectedTasks[0]],
    ['VERIFY_PASS', 'GitHub Actions', 'PASSしました', selectedTasks[0]],
    ['HUMAN_GATE', 'KOSAME', '確認が必要ですね', humanGateTasks[0] || selectedTasks[0]],
    ['DONE', 'KOSAME', '完了しました', selectedTasks[0]],
    ['ERROR', 'KOSAME', '止まりました。確認が必要です', blockedTasks[0] || selectedTasks[0]],
    ['WAITING', 'KOSAME', '応答待ちです', selectedTasks[0]],
    ['BLOCKED', 'KOSAME', 'ここで止まっています', blockedTasks[0] || selectedTasks[0]],
  ];

  const items = [...latest];
  const kindsPresent = new Set(items.map((item) => item.kind));
  for (const [kind, actor, message, task] of templates) {
    if (kindsPresent.has(kind)) continue;
    if (!task && kind !== 'VERIFY_PASS') continue;
    const item = {
      kind,
      actor,
      message,
      text: `${actor}「${message}」`,
      speech: `${actor}「${message}」`,
      severity: ['DONE', 'VERIFY_PASS'].includes(kind) ? 'done' : kind === 'ERROR' ? 'error' : kind === 'HUMAN_GATE' ? 'human_gate' : kind === 'WAITING' || kind === 'BLOCKED' ? 'waiting' : 'running',
      project: String(task && (task.project || task.relatedProject) || '').trim(),
      taskId: String(task && (task.taskId || task.wishlistId || task.title) || '').trim(),
      timestamp: '',
    };
    fallbackTasks.push(item);
    items.push(item);
  }

  const countSource = events.length ? events.map(buildAgentEventTemplate) : items;
  const counts = countSource.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});

  return {
    status: items.length ? 'ok' : 'missing',
    templateLevel: 'L2',
    totalCount: events.length,
    lastUpdatedAt: items[0] ? items[0].timestamp || null : null,
    items,
    counts,
    warnings: [],
  };
}

function buildProjectStrip(projects, context = {}) {
  const taskFeeder = context.taskFeeder || {};
  const agentEventFeed = context.agentEventFeed || {};
  const rawEvents = Array.isArray(context.activityEvents) ? context.activityEvents : [];
  const selectedProjectId = String(context.selectedProjectId || '').trim();
  const projectEntries = Array.isArray(projects) ? projects : [];
  const strip = projectEntries.map((project) => {
    const projectKey = normalizeKey(project.id || project.name || project.shortName);
    const eventsForProject = rawEvents.filter((event) => normalizeKey(event.project) === projectKey || normalizeKey(event.project || event.relatedProject) === projectKey);
    const projectTasks = [
      ...(Array.isArray(taskFeeder.selectedTasks) ? taskFeeder.selectedTasks : []),
      ...(Array.isArray(taskFeeder.humanGateTasks) ? taskFeeder.humanGateTasks : []),
      ...(Array.isArray(taskFeeder.blockedTasks) ? taskFeeder.blockedTasks : []),
    ].filter((task) => normalizeKey(task.project || task.relatedProject) === projectKey);

    const runningCount = eventsForProject.filter((event) => {
      const kind = normalizeEventKind(event);
      return kind === 'START' || kind === 'RUNNING';
    }).length || projectTasks.filter((task) => ['running', 'in_progress', 'active'].includes(normalizeKey(task.status))).length;
    const humanGateCount = eventsForProject.filter((event) => normalizeEventKind(event) === 'HUMAN_GATE').length
      || projectTasks.filter((task) => task.humanGateRequired || ['human_gate', 'approval_required', 'waiting_human'].includes(normalizeKey(task.status))).length;
    const warningCount = Number(project.warningCount || 0)
      + eventsForProject.filter((event) => ['ERROR', 'BLOCKED'].includes(normalizeEventKind(event))).length;
    const latestActivity = eventsForProject
      .map((event) => event.timestamp || '')
      .filter(Boolean)
      .sort()
      .at(-1)
      || '';
    const statusClass = project.availability && project.availability !== 'available'
      ? 'warn'
      : warningCount > 0
        ? 'warn'
        : project.dirty
          ? 'warn'
          : 'ok';

    return {
      ...project,
      selected: project.id === selectedProjectId,
      runningCount,
      humanGateCount,
      warningCount,
      lastUpdatedAt: latestActivity || context.generatedAt || '',
      lastUpdatedLabel: latestActivity ? formatLocalTimestamp(latestActivity) || latestActivity : context.generatedAtLocal || '—',
      statusClass,
      eventSummary: [
        `running=${runningCount}`,
        `humanGate=${humanGateCount}`,
        `warnings=${warningCount}`,
      ].join(' / '),
      selectedHint: project.id === selectedProjectId ? 'selected' : '',
    };
  });

  return {
    status: strip.length ? 'ok' : 'missing',
    selectedProjectId: selectedProjectId || strip[0]?.id || '',
    generatedAt: context.generatedAt || '',
    items: strip,
  };
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

function buildAiRoster(providerConfig, codexWatch, latestHandoffWorkOrder) {
  const cw = codexWatch || {};
  const handoffTitle = latestHandoffWorkOrder && latestHandoffWorkOrder.title
    ? String(latestHandoffWorkOrder.title).slice(0, 40)
    : null;
  return [
    {
      id: 'codex',
      name: 'Codex',
      status: cw.running ? 'running' : 'idle',
      task: cw.running ? (handoffTitle ? `実行中: ${handoffTitle}` : 'dispatch実行中') : '待機中',
      tier: 'A',
    },
    {
      id: 'claude',
      name: 'Claude',
      status: 'running',
      task: 'KOSAME Console主担当',
      tier: 'A',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      status: providerConfig.geminiKeyPresent ? 'idle' : 'missing',
      task: providerConfig.geminiKeyPresent ? '待機中' : '未設定',
      tier: 'B',
    },
    {
      id: 'grok',
      name: 'Grok',
      status: 'missing',
      task: '未設定',
      tier: 'C',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      status: providerConfig.deepseekKeyPresent ? 'idle' : 'missing',
      task: providerConfig.deepseekKeyPresent ? '待機中' : '未設定',
      tier: 'B',
    },
    {
      id: 'llama',
      name: 'Llama',
      status: providerConfig.llamaKeyPresent ? 'idle' : 'missing',
      task: providerConfig.llamaKeyPresent ? 'audit lane' : '未設定',
      tier: 'C',
    },
  ];
}

function detectCodexWatch() {
  try {
    const { execFileSync: _exec } = require('node:child_process');
    const out = _exec('pgrep', ['-f', 'kosame-codex-dispatch-watcher'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = String(out || '').trim().split(/\s+/).filter(Boolean).map(Number).filter(n => n > 0);
    return { running: pids.length > 0, pid: pids[0] || null };
  } catch {
    return { running: false, pid: null };
  }
}

function formatLocalTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute || !parts.second) return '';
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} JST`;
  } catch {
    return date.toISOString();
  }
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
  const providerConfig = getProviderConfig();
  const devRepoPath = options.devRepoPath || DEV_ORCHESTRA_REPO;
  const salesRepoPath = options.salesRepoPath || SALES_DX_REPO;
  const activeRepoPath = options.activeRepoPath || devRepoPath;
  const projectRegistry = loadProjectRegistry(options.projectRegistryPath);
  const versionContext = resolveVersionContext();
  const activityEventLogPath = options.activityEventLogPath
    ? path.resolve(String(options.activityEventLogPath))
    : DEFAULT_ACTIVITY_LOG_PATH;
  const activityEvents = readJsonlRecords(activityEventLogPath, Number(options.activityEventLimit || 96));
  const shellAgentActivity = readShellAgentActivity({
    shellAgentActivityLogPath: options.shellAgentActivityLogPath,
    shellAgentActivityLimit: options.shellAgentActivityLimit,
  });
  const latestApprovedWorkOrder = readLatestApprovedWorkOrder({
    workOrderApprovalLogPath: options.workOrderApprovalLogPath,
    limit: options.workOrderApprovalLimit,
  });
  const latestWorkOrderHandoff = readLatestWorkOrderHandoff({
    workOrderApprovalLogPath: options.workOrderApprovalLogPath,
    workOrderHandoffLogPath: options.workOrderHandoffLogPath,
    limit: options.workOrderHandoffLimit,
    approvalLimit: options.workOrderApprovalLimit,
  });
  const latestWorkOrderResult = readLatestWorkOrderResult({
    workOrderApprovalLogPath: options.workOrderApprovalLogPath,
    workOrderHandoffLogPath: options.workOrderHandoffLogPath,
    workOrderResultLogPath: options.workOrderResultLogPath,
    approvalLimit: options.workOrderApprovalLimit,
    latestHandoffWorkOrder: latestWorkOrderHandoff.latestHandoffWorkOrder || null,
  });
  const workOrderResultHistory = readWorkOrderResultHistory({
    workOrderApprovalLogPath: options.workOrderApprovalLogPath,
    workOrderResultLogPath: options.workOrderResultLogPath,
    approvalLimit: options.workOrderApprovalLimit,
    limit: options.workOrderResultHistoryLimit || 3,
  });
  const mergedLatestHandoffWorkOrder = latestWorkOrderResult.latestHandoffWorkOrder
    || latestWorkOrderHandoff.latestHandoffWorkOrder
    || null;
  const latestWorkOrderDecision = buildWorkOrderResultDecision({
    latestWorkOrderResult: latestWorkOrderResult.latestWorkOrderResult || null,
    latestHandoffWorkOrder: mergedLatestHandoffWorkOrder || latestWorkOrderHandoff.latestHandoffWorkOrder || null,
    latestApprovedWorkOrder: latestWorkOrderResult.latestApprovedWorkOrder || latestApprovedWorkOrder.latestApprovedWorkOrder || null,
  });
  const mergedWorkOrderHandoffQueue = mergedLatestHandoffWorkOrder ? [mergedLatestHandoffWorkOrder] : [];
  const workOrderDecisionQueue = latestWorkOrderDecision ? [latestWorkOrderDecision] : [];
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
  const generatedAt = new Date().toISOString();
  const generatedAtLocal = formatLocalTimestamp(generatedAt);
  const agentEventFeed = buildAgentEventFeed(activityEvents, {
    taskFeeder,
    currentVersion: versionContext.currentVersion,
    generatedAt: generatedAt,
  });
  const selectedProjectId = (activeRepoPath === salesRepoPath ? 'sales-dx' : 'dev-orchestra');
  const projectStrip = buildProjectStrip(projects, {
    taskFeeder,
    agentEventFeed,
    activityEvents,
    selectedProjectId,
    generatedAt,
    generatedAtLocal,
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
    'この Console は read-only 監視専用です。git add / commit / push / tag / reset / checkout は使いません。',
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

  const codexWatchState = detectCodexWatch();

  const humanGate = [
    '書き込み操作の前には必ず人間承認が必要です。',
    'commit 候補に進む前に changed files と staged files を確認してください。',
    'DeepSeek / opencode はこの Console では使いません。',
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
    projectStrip,
    devOrchestra,
    salesDx,
    monitoredRepos: [devOrchestra, salesDx],
    taskFeeder,
    wishlist: taskFeeder.wishlist,
    memoryVault,
    autoSave,
    apiCost,
    agentEventFeed,
    shellAgentActivity,
    latestApprovedWorkOrder: latestApprovedWorkOrder.latestApprovedWorkOrder,
    latestHandoffWorkOrder: mergedLatestHandoffWorkOrder,
    workOrderHandoffQueue: mergedWorkOrderHandoffQueue,
    latestWorkOrderResult: latestWorkOrderResult.latestWorkOrderResult,
    workOrderResultQueue: latestWorkOrderResult.latestWorkOrderResult ? [latestWorkOrderResult.latestWorkOrderResult] : [],
    workOrderResultHistory: workOrderResultHistory.items || [],
    latestWorkOrderDecision,
    workOrderDecisionQueue,
    confirmationBridge: options.confirmationBridge || null,
    humanGate,
    warnings,
    selectedProjectId: projectStrip.selectedProjectId,
    generatedAt,
    generatedAtLocal,
  });

  const nextAction = taskFeeder.selectedTasks.length > 0
    ? taskFeeder.nextAction
    : warnings.some(w => w.includes('unavailable') || w.includes('missing'))
      ? 'read-only のまま、取得できないフィードの状態を確認してください。'
      : (devOrchestra.dirty || salesDx.dirty)
      ? 'changed files と staged files を見直し、書き込み前の人間承認を待ってください。'
      : '引き続き passive monitoring を続けてください。この Console からの書き込みはできません。';

  return {
    version: PACKAGE.version,
    generatedAt,
    generatedAtLocal: formatLocalTimestamp(generatedAt),
    currentMission: '☂️ KOSAME Console',
    mode: 'Readonly',
    activeRepo: {
      label: projects.find((project) => project.repoPath === activeRepoPath)?.name
        || (activeRepoPath === salesRepoPath ? 'Sales DX' : 'KOSAME Dev Orchestra'),
      path: activeRepoPath,
    },
    projectRegistryPath: options.projectRegistryPath ? path.resolve(String(options.projectRegistryPath)) : DEFAULT_PROJECT_REGISTRY_PATH,
    projects,
    projectStrip,
    monitoredRepos: [devOrchestra, salesDx],
    devOrchestra,
    salesDx,
    taskVault,
    autoSave,
    apiCost,
    taskFeeder,
    wishlist: taskFeeder.wishlist,
    memoryVault,
    agentEventFeed,
    shellAgentActivity,
    latestApprovedWorkOrder: latestApprovedWorkOrder.latestApprovedWorkOrder,
    latestHandoffWorkOrder: mergedLatestHandoffWorkOrder,
    workOrderHandoffQueue: mergedWorkOrderHandoffQueue,
    latestWorkOrderResult: latestWorkOrderResult.latestWorkOrderResult,
    workOrderResultQueue: latestWorkOrderResult.latestWorkOrderResult ? [latestWorkOrderResult.latestWorkOrderResult] : [],
    workOrderResultHistory: workOrderResultHistory.items || [],
    latestWorkOrderDecision,
    workOrderDecisionQueue,
    chatStatus: {
      ai: 'connected',
      context: consoleContext.status === 'ok' ? 'loaded' : 'missing',
      memory: memoryVault?.status || 'missing',
      llamaAudit: providerConfig.llamaAuditLane?.status || (providerConfig.llamaKeyPresent ? 'configured' : 'missing'),
    },
    confirmationBridge: options.confirmationBridge || null,
    consoleContextSummary: consoleContext.summary,
    consoleContextStatus: consoleContext.status,
    currentVersion: versionContext.currentVersion,
    packageVersion: versionContext.packageVersion,
    latestTag: versionContext.latestTag,
    headCommit: versionContext.headCommit,
    versionSource: versionContext.source,
    codexWatch: codexWatchState,
    aiRoster: buildAiRoster(providerConfig, codexWatchState, mergedLatestHandoffWorkOrder),
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
  buildAiRoster,
  READ_ONLY_COMMANDS,
  loadProjectRegistry,
};
