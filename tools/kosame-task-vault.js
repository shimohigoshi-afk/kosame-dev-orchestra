#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE = require('../package.json');
const securityPolicy = require('./kosame-worker-security-policy');

const DEFAULT_TASK_VAULT_DIR = path.join(os.homedir(), '.kosame', 'task-vault');
const JSONL_NAMES = {
  tasks: 'tasks.jsonl',
  decisions: 'decisions.jsonl',
  wishlist: 'wishlist.jsonl',
};

const REDACTION_RULES = [
  { category: 'secret', regex: /(?:OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|GROK_API_KEY|API[_-]?KEY|SECRET|CREDENTIALS?|PASSWORD|TOKEN|BEARER|sk-[A-Za-z0-9_-]{12,})/i },
  { category: 'customer', regex: /(?:customer(?:[_\s-]?(?:data|info|name|id))?|顧客(?:情報|データ)?|個人情報|pii|patient)/i },
  { category: 'voice', regex: /(?:音声データ|voice(?:\s+data)?|audio|transcript|recording)/i },
  { category: 'sales_dx', regex: /(?:営業DX|sales[-_\s]?dx|transcriber)/i },
  { category: 'insurance', regex: /(?:保険|insurance|告知義務|契約|契約者)/i },
  { category: 'pricing', regex: /(?:pricing|価格戦略|price strategy|料金戦略|収益モデル|課金)/i },
  { category: 'temperature', regex: /(?:temperature|温度判定|温度\s*=|temperature\s*=)/i },
];

const REDACT_KEY_RE = /(?:api[_-]?key|secret|credential|password|bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|customer|顧客|voice|audio|transcript|transcriber|sales[_-]?dx|insurance|pricing|temperature|prompt)/i;

function resolveTaskVaultDir(dir = process.env.KOSAME_TASK_VAULT_DIR || DEFAULT_TASK_VAULT_DIR) {
  return path.resolve(String(dir || DEFAULT_TASK_VAULT_DIR));
}

function getTaskVaultPaths(taskVaultDir = resolveTaskVaultDir()) {
  const root = resolveTaskVaultDir(taskVaultDir);
  return {
    root,
    currentState: path.join(root, 'current-state.json'),
    tasksJsonl: path.join(root, JSONL_NAMES.tasks),
    decisionsJsonl: path.join(root, JSONL_NAMES.decisions),
    wishlistJsonl: path.join(root, JSONL_NAMES.wishlist),
    costLedgerJsonl: path.join(root, 'cost-ledger.jsonl'),
    costSummaryJson: path.join(root, 'cost-summary.json'),
    autosavesDir: path.join(root, 'autosaves'),
    checkpointsDir: path.join(root, 'checkpoints'),
    handoffDir: path.join(root, 'handoff'),
    latestHandoff: path.join(root, 'handoff', 'latest-handoff.md'),
  };
}

function ensureTaskVaultLayout(taskVaultDir = resolveTaskVaultDir()) {
  const paths = getTaskVaultPaths(taskVaultDir);
  fs.mkdirSync(paths.root, { recursive: true });
  fs.mkdirSync(paths.autosavesDir, { recursive: true });
  fs.mkdirSync(paths.checkpointsDir, { recursive: true });
  fs.mkdirSync(paths.handoffDir, { recursive: true });
  return paths;
}

function timestampStamp(date = new Date()) {
  return new Date(date).toISOString().replace(/[:]/g, '-');
}

function appendJsonl(filePath, record) {
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMarkdown(filePath, text) {
  fs.writeFileSync(filePath, `${String(text || '').trimEnd()}\n`, 'utf8');
}

function sanitizePlainText(text) {
  const warnings = [];
  const sanitized = sanitizeValue(String(text || ''), warnings, []);
  return {
    value: typeof sanitized === 'string' ? sanitized : String(sanitized || ''),
    warnings,
  };
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonlRecords(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function newestEntryTime(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let latest = null;
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (!latest || stat.mtimeMs > latest.mtimeMs) {
        latest = stat;
      }
    } catch {
      // ignore
    }
  }
  return latest ? latest.mtime.toISOString() : null;
}

function detectRedaction(text) {
  const value = String(text || '');
  const matched = [];

  for (const rule of REDACTION_RULES) {
    if (rule.regex.test(value)) matched.push(rule.category);
  }

  return [...new Set(matched)];
}

function sanitizeValue(value, warnings, currentPath = []) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const categories = detectRedaction(value);
    if (categories.length > 0) {
      warnings.push({
        path: currentPath.join('.'),
        categories,
      });
      return `[REDACTED:${categories[0]}]`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, warnings, currentPath.concat(String(index))));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const keyPath = currentPath.concat(key);
      if (REDACT_KEY_RE.test(key)) {
        const categories = detectRedaction(`${key} ${typeof item === 'string' ? item : JSON.stringify(item)}`);
        const category = categories[0] || 'secret';
        warnings.push({
          path: keyPath.join('.'),
          categories: categories.length ? categories : [category],
        });
        output[key] = `[REDACTED:${category}]`;
        continue;
      }
      output[key] = sanitizeValue(item, warnings, keyPath);
    }
    return output;
  }
  return value;
}

function sanitizeRecord(record) {
  const warnings = [];
  const sanitized = sanitizeValue(record, warnings, []);
  return {
    value: sanitized,
    warnings,
    warningCount: warnings.length,
  };
}

function createTaskLists(input = {}) {
  const source = input.tasks || input.taskLists || {};
  const normalize = (value) => (Array.isArray(value) ? value : []);
  return {
    pending: normalize(source.pending),
    inProgress: normalize(source.inProgress),
    completed: normalize(source.completed),
    hold: normalize(source.hold),
  };
}

function countCurrentTasks(taskLists) {
  return (taskLists.pending.length || 0)
    + (taskLists.inProgress.length || 0)
    + (taskLists.hold.length || 0);
}

function buildCurrentStateRecord(input = {}) {
  const taskLists = createTaskLists(input);
  const now = new Date().toISOString();
  const taskVaultDir = resolveTaskVaultDir(input.taskVaultDir);
  const nextAction = input.nextAction || input.next_action || '次にやることを確認してください。';

  const record = {
    version: input.version || PACKAGE.version,
    recordType: 'current_state',
    savedAt: input.savedAt || now,
    latestCheckpointAt: input.latestCheckpointAt || null,
    taskVaultDir,
    currentMission: input.currentMission || 'KOSAME Task Vault & Auto Save',
    targetRepo: input.targetRepo || input.activeRepo || input.repo || 'unknown',
    assignedAI: input.assignedAI || input.assignedAi || 'unknown',
    nextAction,
    dangerGates: Array.isArray(input.dangerGates) ? input.dangerGates : [],
    verifyResult: input.verifyResult || null,
    lastGitStatus: input.lastGitStatus || null,
    lastVerifyResult: input.lastVerifyResult || null,
    handoffMemo: input.handoffMemo || '',
    plannedFiles: Array.isArray(input.plannedFiles) ? input.plannedFiles : [],
    taskLists,
    wishlistCount: Number.isFinite(Number(input.wishlistCount)) ? Number(input.wishlistCount) : 0,
    decisions: Array.isArray(input.decisions) ? input.decisions : [],
    safetyWarnings: Array.isArray(input.safetyWarnings) ? input.safetyWarnings : [],
    currentTaskCount: countCurrentTasks(taskLists),
    lastCheckpointNote: input.lastCheckpointNote || null,
    lastCheckpointAt: input.lastCheckpointAt || null,
    lastSavedAt: input.lastSavedAt || input.savedAt || now,
    latestAutosaveAt: input.latestAutosaveAt || input.savedAt || now,
  };

  const sanitized = sanitizeRecord(record);
  return {
    ...sanitized.value,
    safetyWarnings: [
      ...(Array.isArray(sanitized.value.safetyWarnings) ? sanitized.value.safetyWarnings : []),
      ...sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
    ],
    warningCount: sanitized.warnings.length + (Array.isArray(sanitized.value.safetyWarnings) ? sanitized.value.safetyWarnings.length : 0),
  };
}

function saveCurrentState(taskVaultDir, state) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const record = buildCurrentStateRecord({ ...state, taskVaultDir: paths.root });
  writeJson(paths.currentState, record);
  return { path: paths.currentState, record };
}

function appendTaskRecord(taskVaultDir, taskRecord) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const now = new Date().toISOString();
  const sanitized = sanitizeRecord(taskRecord || {});
  const record = {
    version: PACKAGE.version,
    recordType: 'task',
    savedAt: now,
    ...sanitized.value,
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
  };
  appendJsonl(paths.tasksJsonl, record);
  return { path: paths.tasksJsonl, record };
}

function appendDecisionRecord(taskVaultDir, decisionRecord) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const now = new Date().toISOString();
  const sanitized = sanitizeRecord(decisionRecord || {});
  const record = {
    version: PACKAGE.version,
    recordType: 'decision',
    savedAt: now,
    ...sanitized.value,
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
  };
  appendJsonl(paths.decisionsJsonl, record);
  return { path: paths.decisionsJsonl, record };
}

function saveSnapshotFile(taskVaultDir, subdir, prefix, snapshot) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const savedAt = new Date().toISOString();
  const fileName = `${timestampStamp(savedAt)}-${prefix}.json`;
  const filePath = path.join(paths[subdir], fileName);
  const sanitized = sanitizeRecord(snapshot || {});
  const record = {
    version: PACKAGE.version,
    snapshotType: prefix,
    savedAt,
    ...sanitized.value,
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
  };
  writeJson(filePath, record);
  return { path: filePath, record };
}

function saveAutoSaveSnapshot(taskVaultDir, snapshot) {
  return saveSnapshotFile(taskVaultDir, 'autosavesDir', 'autosave', snapshot);
}

function saveCheckpointSnapshot(taskVaultDir, snapshot) {
  return saveSnapshotFile(taskVaultDir, 'checkpointsDir', 'checkpoint', snapshot);
}

function writeHandoffMarkdown(taskVaultDir, handoffText) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const sanitized = sanitizePlainText(handoffText);
  writeMarkdown(paths.latestHandoff, sanitized.value);
  return {
    path: paths.latestHandoff,
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
  };
}

function readTaskVaultOverview(taskVaultDir = resolveTaskVaultDir()) {
  const root = resolveTaskVaultDir(taskVaultDir);
  const paths = getTaskVaultPaths(root);
  const currentState = readJson(paths.currentState);
  const taskLists = currentState?.taskLists || createTaskLists(currentState || {});
  const wishlistRecords = readJsonlRecords(paths.wishlistJsonl);
  const warnings = [
    ...(Array.isArray(currentState?.safetyWarnings) ? currentState.safetyWarnings : []),
  ];

  if (!fs.existsSync(root)) warnings.push('task vault directory is missing');
  if (!currentState) warnings.push('current-state.json is missing');

  const latestAutosaveAt = currentState?.latestAutosaveAt || newestEntryTime(paths.autosavesDir);
  const latestCheckpointAt = currentState?.latestCheckpointAt || newestEntryTime(paths.checkpointsDir);
  const handoffExists = fs.existsSync(paths.latestHandoff);
  const currentTaskCount = countCurrentTasks(taskLists);
  const wishlistCount = currentState?.wishlistCount || wishlistRecords.length;
  const warningCount = warnings.length;

  const status = !fs.existsSync(root)
    ? 'warning'
    : warningCount > 0
      ? 'warning'
      : 'ok';

  return {
    root,
    paths,
    exists: fs.existsSync(root),
    status,
    warningCount,
    safetyWarnings: warnings,
    currentTaskCount,
    taskLists,
    wishlistCount,
    currentState,
    currentMission: currentState?.currentMission || 'KOSAME Task Vault & Auto Save',
    targetRepo: currentState?.targetRepo || 'unknown',
    assignedAI: currentState?.assignedAI || 'unknown',
    lastGitStatus: currentState?.lastGitStatus || null,
    lastVerifyResult: currentState?.lastVerifyResult || null,
    wishlistCount: currentState?.wishlistCount || 0,
    lastSavedAt: currentState?.lastSavedAt || currentState?.savedAt || null,
    latestCheckpointAt,
    latestAutosaveAt,
    handoffExists,
    handoffPath: paths.latestHandoff,
    currentStatePath: paths.currentState,
    tasksJsonlPath: paths.tasksJsonl,
    decisionsJsonlPath: paths.decisionsJsonl,
    wishlistJsonlPath: paths.wishlistJsonl,
    costLedgerPath: paths.costLedgerJsonl,
    costSummaryPath: paths.costSummaryJson,
  };
}

function appendWishlistRecord(taskVaultDir, wishlistRecord) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  const now = new Date().toISOString();
  const sanitized = sanitizeRecord(wishlistRecord || {});
  const record = {
    version: PACKAGE.version,
    recordType: 'wishlist',
    savedAt: now,
    status: sanitized.value.status || 'pending',
    ...sanitized.value,
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
  };
  appendJsonl(paths.wishlistJsonl, record);
  return { path: paths.wishlistJsonl, record };
}

function readTaskRecords(taskVaultDir = resolveTaskVaultDir()) {
  const root = resolveTaskVaultDir(taskVaultDir);
  const paths = getTaskVaultPaths(root);
  const taskRecords = readJsonlRecords(paths.tasksJsonl);
  if (taskRecords.length > 0) return taskRecords;

  const currentState = readJson(paths.currentState);
  const taskLists = currentState?.taskLists || createTaskLists(currentState || {});
  const fallbackRecords = [];
  const addRecords = (items, status) => {
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      if (item == null) return;
      if (typeof item === 'object') {
        fallbackRecords.push({
          recordType: 'task',
          taskId: String(item.taskId || item.id || `${status}-${index + 1}`),
          ...item,
          status: item.status || status,
        });
        return;
      }
      fallbackRecords.push({
        recordType: 'task',
        taskId: `${status}-${index + 1}`,
        title: String(item),
        status,
      });
    });
  };

  addRecords(taskLists.pending, 'ready');
  addRecords(taskLists.inProgress, 'in_progress');
  addRecords(taskLists.hold, 'blocked');
  addRecords(taskLists.completed, 'done');
  return fallbackRecords;
}

function readWishlistRecords(taskVaultDir = resolveTaskVaultDir()) {
  const root = resolveTaskVaultDir(taskVaultDir);
  const paths = getTaskVaultPaths(root);
  return readJsonlRecords(paths.wishlistJsonl);
}

function createTaskVault(taskVaultDir = resolveTaskVaultDir()) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  return {
    paths,
    saveCurrentState: (state) => saveCurrentState(paths.root, state),
    appendTaskRecord: (taskRecord) => appendTaskRecord(paths.root, taskRecord),
    appendDecisionRecord: (decisionRecord) => appendDecisionRecord(paths.root, decisionRecord),
    appendWishlistRecord: (wishlistRecord) => appendWishlistRecord(paths.root, wishlistRecord),
    saveAutoSaveSnapshot: (snapshot) => saveAutoSaveSnapshot(paths.root, snapshot),
    saveCheckpointSnapshot: (snapshot) => saveCheckpointSnapshot(paths.root, snapshot),
    writeHandoffMarkdown: (text) => writeHandoffMarkdown(paths.root, text),
    readOverview: () => readTaskVaultOverview(paths.root),
    readTaskRecords: () => readTaskRecords(paths.root),
    readWishlistRecords: () => readWishlistRecords(paths.root),
  };
}

module.exports = {
  DEFAULT_TASK_VAULT_DIR,
  JSONL_NAMES,
  REDACTION_RULES,
  resolveTaskVaultDir,
  getTaskVaultPaths,
  ensureTaskVaultLayout,
  sanitizeRecord,
  createTaskLists,
  countCurrentTasks,
  buildCurrentStateRecord,
  saveCurrentState,
  appendTaskRecord,
  appendDecisionRecord,
  appendWishlistRecord,
  saveAutoSaveSnapshot,
  saveCheckpointSnapshot,
  writeHandoffMarkdown,
  sanitizePlainText,
  readTaskVaultOverview,
  readJsonlRecords,
  readTaskRecords,
  readWishlistRecords,
  createTaskVault,
};

if (require.main === module) {
  const overview = readTaskVaultOverview();
  process.stdout.write(`${JSON.stringify(overview, null, 2)}\n`);
}
