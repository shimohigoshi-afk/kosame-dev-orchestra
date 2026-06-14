#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PACKAGE = require('../package.json');
const taskVault = require('./kosame-task-vault');
const workerScorecard = require('./kosame-worker-scorecard');

const POLICY_PATH = path.join(__dirname, '..', 'config', 'kosame-task-feeder-policy.json');

const DEFAULT_POLICY = {
  version: PACKAGE.version,
  maxCandidates: 3,
  priorityOrder: {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3,
    default: 9,
  },
  riskOrder: {
    low: 0,
    medium: 1,
    high: 4,
    critical: 6,
    unknown: 2,
  },
  costTierOrder: {
    free: 0,
    ultra_low: 1,
    low: 2,
    medium: 3,
    high: 6,
    approval_required: 9,
    unknown: 3,
  },
  blockedStatuses: ['blocked', 'done', 'completed', 'closed', 'rejected', 'archived'],
  humanGateStatuses: ['human_gate', 'approval_required', 'waiting_human'],
  readyStatuses: ['ready'],
  suggestionKeywords: ['そろそろ', '次', 'next', 'soon', 'ready', '今', '提案'],
  sensitivitySignals: ['営業DX', 'sales-dx', 'transcriber', 'Secret', 'API key', '.env', 'credentials', '顧客', 'customer', 'DeepSeek', 'opencode'],
  avoidWorkers: ['DeepSeek', 'opencode'],
  currentVersionHint: PACKAGE.version,
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadPolicy() {
  return {
    ...DEFAULT_POLICY,
    ...(readJson(POLICY_PATH) || {}),
  };
}

function toSemverParts(value) {
  const text = String(value || '').trim().replace(/^v/i, '');
  const parts = text.split('.').map(part => Number.parseInt(part, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

function compareVersions(a, b) {
  const left = toSemverParts(a);
  const right = toSemverParts(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function versionGte(a, b) {
  return compareVersions(a, b) >= 0;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePriority(value, policy) {
  const text = normalizeText(value).toUpperCase();
  if (policy.priorityOrder[text] != null) return text;
  if (/^P[0-3]$/.test(text)) return text;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `P${Math.max(0, Math.min(3, Math.trunc(value)))}`;
  }
  return 'P2';
}

function normalizeRisk(value) {
  const text = normalizeText(value).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(text)) return text;
  return 'unknown';
}

function normalizeCostTier(value) {
  const text = normalizeText(value).toLowerCase();
  if (['free', 'ultra_low', 'low', 'medium', 'high', 'approval_required'].includes(text)) return text;
  return 'unknown';
}

function normalizeStatus(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return 'pending';
  return text;
}

function safeList(value) {
  if (Array.isArray(value)) return value.map(item => normalizeText(item)).filter(Boolean);
  if (value == null || value === '') return [];
  return [normalizeText(value)];
}

function normalizeItemList(value) {
  if (!Array.isArray(value)) return safeList(value);
  return value
    .map((item) => {
      if (item == null) return '';
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return normalizeText(item);
      if (typeof item === 'object') {
        return normalizeText(item.id || item.taskId || item.wishlistId || item.title || item.name || item.value || JSON.stringify(item));
      }
      return normalizeText(item);
    })
    .filter(Boolean);
}

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTaskId(task, index) {
  return normalizeText(task.taskId || task.id || task.key || task.slug || `task-${index + 1}`);
}

function extractWishlistId(item, index) {
  return normalizeText(item.wishlistId || item.id || item.key || item.slug || `wishlist-${index + 1}`);
}

function buildDependencyLookup(tasks) {
  const lookup = new Map();
  for (const task of tasks) {
    const id = extractTaskId(task, 0);
    if (id) lookup.set(id, task);
    if (task.title) lookup.set(normalizeText(task.title), task);
  }
  return lookup;
}

function isCompletedStatus(status) {
  const text = normalizeStatus(status);
  return ['done', 'completed', 'closed', 'rejected', 'archived'].includes(text);
}

function isBlockedStatus(status) {
  return ['blocked'].includes(normalizeStatus(status));
}

function hasUnresolvedDependency(task, lookup) {
  const dependencyEntries = Array.isArray(task.dependencies)
    ? task.dependencies
    : Array.isArray(task.dependencyIds)
      ? task.dependencyIds
      : [];

  if (!dependencyEntries.length) {
    if (task.dependenciesResolved === true) return false;
    if (task.dependencyStatus && ['resolved', 'ready', 'done'].includes(normalizeStatus(task.dependencyStatus))) return false;
    return false;
  }

  for (const dep of dependencyEntries) {
    if (dep == null) return true;
    if (typeof dep === 'object') {
      if (dep.resolved === true) continue;
      if (dep.status && isCompletedStatus(dep.status)) continue;
      return true;
    }

    const depId = normalizeText(dep).replace(/^#/, '');
    const linked = lookup.get(depId) || lookup.get(normalizeText(dep));
    if (!linked) return true;
    if (!isCompletedStatus(linked.status)) return true;
  }

  return false;
}

function collectScopeWarnings(task, policy) {
  const text = compactText(
    task.title,
    task.summary,
    task.sourceContext,
    task.relatedProject,
    task.repo,
    task.project,
    task.safetyWarnings,
  );
  const lowerText = text.toLowerCase();
  const warnings = [];

  if (policy.sensitivitySignals.some(signal => lowerText.includes(String(signal).toLowerCase()))) {
    warnings.push('DeepSeek / opencode / 機密・営業DX・transcriber・Secret 系の安全警告');
  }
  if (/(redacted|safetywarnings)/i.test(text) && /(sales_dx|secret|customer|transcriber)/i.test(lowerText)) {
    warnings.push('保存時に機密 / 営業DX / 顧客情報が redacted されています');
  }
  if (/(?:営業DX|sales[-_\s]?dx|transcriber)/i.test(text)) {
    warnings.push('営業DX / transcriber 範囲に触れるため慎重に扱う');
  }
  if (/(?:Secret|API key|\.env|credentials|顧客|customer)/i.test(text)) {
    warnings.push('Secret / 顧客情報 / credentials は raw 保存しない');
  }
  return [...new Set(warnings)];
}

function collectForbiddenWorkers(task, risk, costTier, policy, scopeWarnings) {
  const forbidden = new Set();
  const text = compactText(task.title, task.summary, task.sourceContext, task.relatedProject, task.repo, task.project, task.safetyWarnings).toLowerCase();

  if (scopeWarnings.length > 0 || policy.sensitivitySignals.some(signal => text.includes(String(signal).toLowerCase()))) {
    for (const worker of policy.avoidWorkers) forbidden.add(worker);
  }
  if (['high', 'critical'].includes(risk)) {
    forbidden.add('Autonomous execution');
  }
  if (costTier === 'approval_required') {
    forbidden.add('GPT-5.5');
  }
  if (task.humanGateRequired === true) {
    forbidden.add('No auto-dispatch');
  }

  return [...forbidden];
}

function buildWorkerRecommendation(task, context = {}) {
  const recommendation = workerScorecard.recommendWorkerForTask(task, context);
  return {
    worker: `${recommendation.workerName} (${recommendation.modelId})`,
    modelId: recommendation.modelId,
    taskType: recommendation.taskType,
    approvalRequired: recommendation.approvalRequired === true,
    sanitizedOnly: recommendation.sanitizedOnly === true,
  };
}

function buildTaskRecord(task, index, lookup, policy) {
  const taskId = extractTaskId(task, index);
  const status = normalizeStatus(task.status);
  const priority = normalizePriority(task.priority, policy);
  const risk = normalizeRisk(task.risk || task.riskLevel);
  const costTierEstimate = normalizeCostTier(task.costTierEstimate || task.costTier || task.costTierHint);
  const humanGateRequired = task.humanGateRequired === true
    || status === 'human_gate'
    || costTierEstimate === 'approval_required'
    || ['high', 'critical'].includes(risk);
  const dependencyUnresolved = hasUnresolvedDependency(task, lookup);
  const scopeWarnings = collectScopeWarnings(task, policy);
  const forbiddenWorkers = collectForbiddenWorkers(task, risk, costTierEstimate, policy, scopeWarnings);
  const worker = buildWorkerRecommendation(task, {
    taskId,
    taskType: task.taskType,
    project: task.project,
    specText: compactText(task.title, task.summary, task.sourceContext),
  });

  const whyNowPieces = [];
  if (status === 'ready') whyNowPieces.push('status=ready');
  if (priority === 'P0' || priority === 'P1') whyNowPieces.push(`priority=${priority}`);
  if (!dependencyUnresolved) whyNowPieces.push('dependencies resolved');
  if (!humanGateRequired) whyNowPieces.push('human gate不要');
  if (risk === 'low' || risk === 'medium') whyNowPieces.push(`risk=${risk}`);
  if (costTierEstimate === 'low' || costTierEstimate === 'medium') whyNowPieces.push(`costTier=${costTierEstimate}`);

  const nextQuestionForJunya = humanGateRequired
    ? 'このタスクは人間承認が必要です。今すぐ進めてよいですか？'
    : 'この候補を今やる順番で進めてよいですか？';

  const recommendedAction = humanGateRequired
    ? 'human gate に寄せる'
    : '今やる候補として 1 件進める';

  const safetyWarnings = [
    ...scopeWarnings,
    dependencyUnresolved ? 'dependency 未解決' : null,
    isBlockedStatus(status) ? 'blocked task' : null,
    ['high', 'critical'].includes(risk) ? `risk=${risk}` : null,
    costTierEstimate === 'high' || costTierEstimate === 'approval_required' ? `costTier=${costTierEstimate}` : null,
    worker.approvalRequired ? '明示承認が必要な worker' : null,
  ].filter(Boolean);

  return {
    taskId,
    title: normalizeText(task.title || task.summary || taskId),
    project: normalizeText(task.project || task.relatedProject || 'unknown'),
    repo: normalizeText(task.repo || task.targetRepo || task.project || 'unknown'),
    priority,
    status,
    risk,
    costTierEstimate,
    recommendedWorker: worker.worker,
    forbiddenWorkers,
    whyNow: whyNowPieces.length ? whyNowPieces.join(' / ') : '今やる候補として扱えるが、追加確認がある場合は human gate へ。',
    nextQuestionForJunya,
    recommendedAction,
    safetyWarnings,
    humanGateRequired,
    dependencies: normalizeItemList(task.dependencies || task.dependencyIds || task.requires),
    allowedFiles: safeList(task.allowedFiles || task.file_scope || task.files),
    expectedOutput: normalizeText(task.expectedOutput || task.expectedOutputFormat || task.output || '短い実装差分 + 簡潔な検証結果'),
    summary: normalizeText(task.summary || task.description || ''),
    sourceContext: normalizeText(task.sourceContext || task.context || ''),
    relatedVersion: normalizeText(task.relatedVersion || task.version || ''),
    relatedProject: normalizeText(task.relatedProject || task.project || ''),
    timingHint: normalizeText(task.timingHint || task.nextTimingHint || ''),
    whyNotNow: normalizeText(task.whyNotNow || task.holdReason || ''),
    suggestedAfter: normalizeText(task.suggestedAfter || task.afterVersion || ''),
    relatedCapabilities: safeList(task.relatedCapabilities || task.capabilities),
    createdAt: normalizeText(task.createdAt || task.savedAt || task.addedAt || ''),
    updatedAt: normalizeText(task.updatedAt || task.savedAt || task.modifiedAt || ''),
    humanGateRequired,
    dependencyUnresolved,
    workerType: worker.modelId,
    taskType: worker.taskType,
  };
}

function taskScore(task, policy) {
  const priorityScore = policy.priorityOrder[task.priority] ?? policy.priorityOrder.default;
  const riskScore = policy.riskOrder[task.risk] ?? policy.riskOrder.unknown;
  const costScore = policy.costTierOrder[task.costTierEstimate] ?? policy.costTierOrder.unknown;
  const humanPenalty = task.humanGateRequired ? 40 : 0;
  const dependencyPenalty = task.dependencyUnresolved ? 100 : 0;
  const blockedPenalty = isBlockedStatus(task.status) ? 200 : 0;
  return priorityScore * 100 + riskScore * 10 + costScore + humanPenalty + dependencyPenalty + blockedPenalty;
}

function shouldSurfaceWishlistItem(item, currentVersion, policy) {
  if (!item) return false;
  if (!['pending', 'suggested'].includes(item.status)) return false;
  if (item.suggestedAfter && versionGte(currentVersion, item.suggestedAfter)) return true;
  const hint = compactText(item.timingHint).toLowerCase();
  if (!hint) return false;
  if (policy.suggestionKeywords.some(keyword => hint.includes(keyword.toLowerCase()))) return true;
  if (/v\d+\.\d+\.\d+/.test(hint) && hint.includes(currentVersion)) return true;
  return false;
}

function buildWishlistRecord(item, index, policy, currentVersion) {
  const wishlistId = extractWishlistId(item, index);
  const status = normalizeStatus(item.status || 'pending');
  const risk = normalizeRisk(item.risk || item.riskLevel);
  const costTierEstimate = normalizeCostTier(item.costTierEstimate || item.costTier || 'medium');
  const timingHint = normalizeText(item.timingHint || '');
  const suggestedAfter = normalizeText(item.suggestedAfter || '');
  const surfaceNow = shouldSurfaceWishlistItem({ status, timingHint, suggestedAfter }, currentVersion, policy);
  const safetyWarnings = collectScopeWarnings({
    title: item.title,
    summary: item.summary,
    sourceContext: item.sourceContext,
    relatedProject: item.relatedProject,
    repo: item.repo,
    project: item.project,
  }, policy);

  if (risk === 'high' || risk === 'critical') {
    safetyWarnings.push(`risk=${risk}`);
  }
  if (costTierEstimate === 'high' || costTierEstimate === 'approval_required') {
    safetyWarnings.push(`costTier=${costTierEstimate}`);
  }

  return {
    wishlistId,
    title: normalizeText(item.title || wishlistId),
    summary: normalizeText(item.summary || ''),
    sourceContext: normalizeText(item.sourceContext || ''),
    relatedVersion: normalizeText(item.relatedVersion || ''),
    relatedProject: normalizeText(item.relatedProject || item.project || ''),
    status,
    priority: normalizePriority(item.priority, policy),
    timingHint,
    whyNotNow: normalizeText(item.whyNotNow || ''),
    suggestedAfter,
    relatedCapabilities: safeList(item.relatedCapabilities || item.capabilities),
    risk,
    costTierEstimate,
    createdAt: normalizeText(item.createdAt || item.savedAt || ''),
    updatedAt: normalizeText(item.updatedAt || item.savedAt || ''),
    surfaceNow,
    safetyWarnings,
  };
}

function buildWishlistSnapshot(taskVaultDir, options = {}) {
  const currentVersion = String(options.currentVersion || PACKAGE.version);
  const policy = loadPolicy();
  const items = taskVault.readWishlistRecords(taskVaultDir);
  const normalized = items.map((item, index) => buildWishlistRecord(item, index, policy, currentVersion));
  const groups = {
    pending: normalized.filter(item => item.status === 'pending'),
    suggested: normalized.filter(item => item.status === 'suggested'),
    accepted: normalized.filter(item => item.status === 'accepted'),
    rejected: normalized.filter(item => item.status === 'rejected'),
    archived: normalized.filter(item => item.status === 'archived'),
  };
  const nextSuggestions = [
    ...groups.pending.filter(item => item.surfaceNow),
    ...groups.suggested.filter(item => item.surfaceNow),
  ];

  return {
    policyVersion: policy.version || PACKAGE.version,
    currentVersion,
    totalCount: normalized.length,
    pendingCount: groups.pending.length,
    suggestedCount: groups.suggested.length,
    acceptedCount: groups.accepted.length,
    rejectedCount: groups.rejected.length,
    archivedCount: groups.archived.length,
    pending: groups.pending,
    suggested: groups.suggested,
    accepted: groups.accepted,
    rejected: groups.rejected,
    archived: groups.archived,
    nextSuggestionCandidates: nextSuggestions,
    laterIdeas: nextSuggestions,
    warnings: normalized
      .flatMap(item => item.safetyWarnings || [])
      .filter(Boolean),
    lastUpdatedAt: normalized
      .map(item => item.updatedAt || item.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
  };
}

function buildTaskFeederSnapshot(options = {}) {
  const taskVaultDir = taskVault.resolveTaskVaultDir(options.taskVaultDir);
  const policy = loadPolicy();
  const currentVersion = String(options.currentVersion || PACKAGE.version);
  const currentMission = normalizeText(options.currentMission || 'KOSAME Task Vault & Auto Save');
  const now = new Date().toISOString();
  const taskRecords = taskVault.readTaskRecords(taskVaultDir);
  const lookup = buildDependencyLookup(taskRecords);
  const normalizedTasks = taskRecords.map((task, index) => buildTaskRecord(task, index, lookup, policy));

  const readyTasks = normalizedTasks.filter(task =>
    policy.readyStatuses.includes(task.status)
    && !task.dependencyUnresolved
    && !isBlockedStatus(task.status)
    && !task.humanGateRequired
    && task.risk !== 'high'
    && task.risk !== 'critical'
  );

  const humanGateTasks = normalizedTasks.filter(task =>
    task.humanGateRequired
    || policy.humanGateStatuses.includes(task.status)
    || task.risk === 'high'
    || task.risk === 'critical'
    || task.costTierEstimate === 'approval_required'
  );

  const blockedTasks = normalizedTasks.filter(task =>
    isBlockedStatus(task.status)
    || task.dependencyUnresolved
  );

  const selectedTasks = readyTasks
    .slice()
    .sort((left, right) => {
      const scoreDelta = taskScore(left, policy) - taskScore(right, policy);
      if (scoreDelta !== 0) return scoreDelta;
      const createdLeft = left.createdAt || '';
      const createdRight = right.createdAt || '';
      return createdLeft.localeCompare(createdRight);
    })
    .slice(0, policy.maxCandidates || 3);

  const wishlist = buildWishlistSnapshot(taskVaultDir, {
    currentVersion,
  });

  const warnings = [
    ...selectedTasks.flatMap(task => task.safetyWarnings || []),
    ...humanGateTasks.flatMap(task => task.safetyWarnings || []),
    ...blockedTasks.flatMap(task => task.safetyWarnings || []),
    ...wishlist.warnings,
  ];

  return {
    version: PACKAGE.version,
    currentVersion,
    generatedAt: now,
    lastFeedGeneratedAt: now,
    taskVaultDir,
    currentMission,
    policy,
    readyTaskCount: readyTasks.length,
    blockedCount: blockedTasks.length,
    humanGateWaitingCount: humanGateTasks.length,
    selectedCount: selectedTasks.length,
    selectedTasks,
    humanGateTasks,
    blockedTasks,
    wishlist,
    warnings: [...new Set(warnings)].filter(Boolean),
    nextAction: selectedTasks.length
      ? `NEXT TASK FEED から ${selectedTasks.length} 件を選んで進めます。`
      : '今やる候補が見つかりません。WISHLIST か human gate を確認してください。',
  };
}

function saveWishlistRecord(taskVaultDir, wishlistRecord) {
  return taskVault.appendWishlistRecord(taskVaultDir, wishlistRecord);
}

if (require.main === module) {
  const snapshot = buildTaskFeederSnapshot();
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

module.exports = {
  POLICY_PATH,
  DEFAULT_POLICY,
  loadPolicy,
  compareVersions,
  versionGte,
  normalizePriority,
  normalizeRisk,
  normalizeCostTier,
  normalizeStatus,
  buildTaskFeederSnapshot,
  buildWishlistSnapshot,
  saveWishlistRecord,
  shouldSurfaceWishlistItem,
};
