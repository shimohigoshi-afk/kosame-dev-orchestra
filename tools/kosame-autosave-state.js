#!/usr/bin/env node
'use strict';

const PACKAGE = require('../package.json');
const {
  resolveTaskVaultDir,
  getTaskVaultPaths,
  readTaskVaultOverview,
  saveAutoSaveSnapshot,
  saveCheckpointSnapshot,
  writeHandoffMarkdown,
  saveCurrentState,
  appendTaskRecord,
  appendDecisionRecord,
} = require('./kosame-task-vault');

const AUTOSAVE_INTERVAL_MINUTES = 10;
const CHECKPOINT_INTERVAL_MINUTES = 50;

function parseTimestamp(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

function addMinutes(isoValue, minutes) {
  const base = parseTimestamp(isoValue);
  if (!base) return null;
  return new Date(base.getTime() + (minutes * 60 * 1000)).toISOString();
}

function pickTimestamp(...values) {
  for (const value of values) {
    if (value) return value;
  }
  return null;
}

function deriveStatus(overview, snapshot = {}) {
  if (snapshot.status) return snapshot.status;
  if (!overview.exists) return 'warning';
  if (overview.warningCount > 0) return 'warning';
  if (!overview.currentState) return 'warning';
  return 'ok';
}

function buildAutoSaveSnapshot(options = {}) {
  const taskVaultDir = resolveTaskVaultDir(options.taskVaultDir);
  const overview = options.taskVault || readTaskVaultOverview(taskVaultDir);
  const now = options.savedAt || new Date().toISOString();

  const lastSavedAt = pickTimestamp(
    options.lastSavedAt,
    overview.lastSavedAt,
    overview.currentState?.lastSavedAt,
    overview.currentState?.savedAt,
    now,
  );
  const latestAutosaveAt = pickTimestamp(
    options.latestAutosaveAt,
    overview.latestAutosaveAt,
    overview.currentState?.latestAutosaveAt,
    lastSavedAt,
  );
  const latestCheckpointAt = pickTimestamp(
    options.latestCheckpointAt,
    overview.latestCheckpointAt,
    overview.currentState?.latestCheckpointAt,
    overview.currentState?.lastCheckpointAt,
    lastSavedAt,
  );

  const nextAutosaveAt = addMinutes(lastSavedAt, AUTOSAVE_INTERVAL_MINUTES);
  const nextCheckpointAt = addMinutes(latestCheckpointAt || lastSavedAt, CHECKPOINT_INTERVAL_MINUTES);

  const taskVault = {
    root: overview.root,
    exists: overview.exists,
    status: deriveStatus(overview, options.taskVault || {}),
    warningCount: overview.warningCount,
    safetyWarnings: overview.safetyWarnings,
    currentTaskCount: overview.currentTaskCount,
    currentMission: overview.currentMission,
    targetRepo: overview.targetRepo,
    assignedAI: overview.assignedAI,
    handoffExists: overview.handoffExists,
    handoffPath: overview.handoffPath,
    currentStatePath: overview.currentStatePath,
    tasksJsonlPath: overview.tasksJsonlPath,
    decisionsJsonlPath: overview.decisionsJsonlPath,
    lastGitStatus: overview.lastGitStatus,
    lastVerifyResult: overview.lastVerifyResult,
    lastSavedAt,
    latestAutosaveAt,
    latestCheckpointAt,
  };

  const autoSave = {
    version: PACKAGE.version,
    savedAt: now,
    status: taskVault.status,
    taskVaultDir,
    saveTarget: taskVaultDir,
    autoSaveIntervalMinutes: AUTOSAVE_INTERVAL_MINUTES,
    checkpointIntervalMinutes: CHECKPOINT_INTERVAL_MINUTES,
    lastSavedAt,
    latestAutosaveAt,
    latestCheckpointAt,
    nextAutosaveAt,
    nextCheckpointAt,
    currentTaskCount: overview.currentTaskCount,
    warningCount: overview.warningCount,
    handoffExists: overview.handoffExists,
    safetyWarnings: overview.safetyWarnings,
  };

  return {
    version: PACKAGE.version,
    generatedAt: now,
    taskVault,
    autoSave,
  };
}

function saveAutoSaveState(taskVaultDir, input = {}) {
  const snapshot = buildAutoSaveSnapshot({
    ...input,
    taskVaultDir,
    savedAt: input.savedAt || new Date().toISOString(),
  });
  const saved = saveAutoSaveSnapshot(taskVaultDir, snapshot);
  return {
    snapshot,
    saved,
  };
}

function saveCheckpointState(taskVaultDir, input = {}) {
  const snapshot = buildAutoSaveSnapshot({
    ...input,
    taskVaultDir,
    savedAt: input.savedAt || new Date().toISOString(),
  });
  const saved = saveCheckpointSnapshot(taskVaultDir, snapshot);
  return {
    snapshot,
    saved,
  };
}

function writeAutoSaveHandoff(taskVaultDir, text) {
  return writeHandoffMarkdown(taskVaultDir, text);
}

module.exports = {
  AUTOSAVE_INTERVAL_MINUTES,
  CHECKPOINT_INTERVAL_MINUTES,
  buildAutoSaveSnapshot,
  saveAutoSaveState,
  saveCheckpointState,
  writeAutoSaveHandoff,
  saveCurrentState,
  appendTaskRecord,
  appendDecisionRecord,
  getTaskVaultPaths,
  resolveTaskVaultDir,
  readTaskVaultOverview,
};

if (require.main === module) {
  const taskVaultDir = resolveTaskVaultDir();
  const snapshot = buildAutoSaveSnapshot({ taskVaultDir });
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}
