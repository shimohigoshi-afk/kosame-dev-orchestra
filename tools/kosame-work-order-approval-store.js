#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { stripBase64Payloads } = require('./kosame-attachment-store');

const DEFAULT_APPROVAL_LOG_PATH = path.join(os.homedir(), '.kosame', 'work-orders.jsonl');
const APPROVAL_LOG_PATH_ENV = 'KOSAME_WORK_ORDER_APPROVAL_LOG_PATH';
const MAX_PROMPT_LENGTH = 12000;
const MAX_TEXT_LENGTH = 220;
const ALLOWED_TARGET_REPOS = new Set([
  '/home/lavie/repos/transcriber',
  '/home/lavie/kosame-dev-orchestra',
  '/home/lavie/repos/kosame-sales-dx',
]);
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/i,
  /\bapi[_-]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\.env\b/i,
  /\bcredentials?\b/i,
  /\bpassword\b/i,
  /\bauthorization\b/i,
  /\bbearer\b/i,
];
const PROMPT_SAFE_LINES = [
  /Secret\/\.env\/credentials\/API keyを読まない/i,
  /機密情報.*環境変数ファイル.*認証情報.*APIキーは読まない/i,
  /git add \. \/ git add -Aは禁止/i,
  /commit\/tag\/pushは未実行で止める/i,
  /外部APIを呼ばない/i,
  /対象repo以外を触らない/i,
  /git status -sb/i,
  /\.env\s+(?:path|fix|修正|パス|load|read)/i,
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(text, maxLength = MAX_TEXT_LENGTH) {
  const value = normalizeText(text);
  if (!value) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0 || value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeTextList(value, maxItems = 12, maxLength = 240) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];
  return source
    .map((item) => truncate(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function hasSecretLikeText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function getApprovalLogPath(options = {}) {
  return path.resolve(String(
    options.workOrderApprovalLogPath
    || process.env[APPROVAL_LOG_PATH_ENV]
    || DEFAULT_APPROVAL_LOG_PATH,
  ));
}

function readJsonlRecords(filePath, limit = 200) {
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
        // skip malformed approval rows
      }
    }
    return records;
  } catch {
    return [];
  }
}

function sanitizeApprovalWorkOrder(input = {}) {
  const workOrder = input.work_order && typeof input.work_order === 'object'
    ? input.work_order
    : input && typeof input === 'object'
      ? input
      : {};

  const title = truncate(workOrder.title, 120);
  const agent = truncate(workOrder.agent, 60);
  const targetRepo = normalizeText(workOrder.target_repo);
  const riskLevel = truncate(workOrder.risk_level || 'low', 24);
  const prompt = stripBase64Payloads(normalizeText(workOrder.body || workOrder.prompt)).text;
  const originalRequest = truncate(stripBase64Payloads(workOrder.originalRequest || workOrder.original_request || '').text, 12000);
  const selectedProjectId = truncate(workOrder.selectedProjectId || workOrder.selected_project_id || '', 60);
  const selectedProjectPath = normalizeText(workOrder.selectedProjectPath || workOrder.selected_project_path || '');
  const selectedProjectLabel = truncate(workOrder.selectedProjectLabel || workOrder.selected_project_label || '', 120);
  const safetyConditions = normalizeTextList(workOrder.safetyConditions || workOrder.safety_conditions, 20, 240);
  const reportItems = normalizeTextList(workOrder.reportItems || workOrder.report_items, 20, 240);
  const executionHost = truncate(workOrder.executionHost || workOrder.execution_host || '', 60);
  const executionSource = truncate(workOrder.executionSource || workOrder.execution_source || '', 60);
  const executionHostAllowed = workOrder.executionHostAllowed !== false;
  const interactiveHostBlocked = !!workOrder.interactiveHostBlocked;
  const noYesGateRuntime = workOrder.noYesGateRuntime !== false;
  const safeSpawnActive = workOrder.safeSpawnActive !== false;
  const manualCodeUiAllowed = workOrder.manualCodeUiAllowed === true;
  const officialRoute = truncate(workOrder.officialRoute || 'Console → Handoff → Runner', 80);
  const promptType = truncate(workOrder.promptType || '', 40);
  const promptOrigin = truncate(workOrder.promptOrigin || '', 60);
  const blockedReason = truncate(workOrder.blockedReason || '', 120);
  const userInputRequired = workOrder.userInputRequired === true;
  const body = truncate(stripBase64Payloads(workOrder.body || workOrder.prompt || '').text, MAX_PROMPT_LENGTH);
  const requiresHumanConfirmation = workOrder.requires_human_confirmation !== false;
  const promptSource = [prompt, originalRequest, body]
    .map((block) => String(block || '').split(/\r?\n/))
    .flat()
    .filter((line) => !PROMPT_SAFE_LINES.some((pattern) => pattern.test(line)))
    .join('\n');

  if (!title) throw new Error('title が必要です。');
  if (!agent) throw new Error('agent が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) throw new Error('target_repo が不明です。');
  if (!prompt) throw new Error('prompt が必要です。');
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error('prompt が長すぎます。');

  const rawText = [
    title,
    agent,
    targetRepo,
    riskLevel,
    selectedProjectId,
    selectedProjectPath,
    selectedProjectLabel,
    ...safetyConditions,
    ...reportItems,
    executionHost,
    executionSource,
    officialRoute,
    promptType,
    promptOrigin,
    blockedReason,
    promptSource,
  ].join('\n');
  if (hasSecretLikeText(rawText)) {
    throw new Error('secret っぽい内容は保存できません。');
  }

  return {
    title,
    agent,
    target_repo: targetRepo,
    risk_level: riskLevel,
    prompt,
    body,
    originalRequest,
    selectedProjectId,
    selectedProjectPath,
    selectedProjectLabel,
    safetyConditions,
    reportItems,
    executionHost,
    execution_host: executionHost,
    executionSource,
    execution_source: executionSource,
    executionHostAllowed,
    execution_host_allowed: executionHostAllowed,
    interactiveHostBlocked,
    interactive_host_blocked: interactiveHostBlocked,
    noYesGateRuntime,
    no_yes_gate_runtime: noYesGateRuntime,
    safeSpawnActive,
    safe_spawn_active: safeSpawnActive,
    manualCodeUiAllowed,
    manual_code_ui_allowed: manualCodeUiAllowed,
    officialRoute,
    official_route: officialRoute,
    promptType,
    prompt_type: promptType,
    promptOrigin,
    prompt_origin: promptOrigin,
    blockedReason,
    blocked_reason: blockedReason,
    userInputRequired,
    user_input_required: userInputRequired,
    target: {
      id: selectedProjectId,
      label: selectedProjectLabel,
      path: targetRepo,
    },
    requires_human_confirmation: !!requiresHumanConfirmation,
  };
}

function normalizeApprovedWorkOrder(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.status !== 'approved') return null;
  const workOrder = record.work_order && typeof record.work_order === 'object' ? record.work_order : record;
  const targetRepo = normalizeText(workOrder.target_repo);
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) return null;
  const title = truncate(workOrder.title, 120);
  const agent = truncate(workOrder.agent, 60);
  const riskLevel = truncate(workOrder.risk_level || 'low', 24);
  const prompt = normalizeText(workOrder.prompt);
  if (!title || !agent || !prompt) return null;
  return {
    approval_id: normalizeText(record.approval_id || record.id || ''),
    status: 'approved',
    approved_at: normalizeText(record.approved_at || record.timestamp || ''),
    approved_by: truncate(record.approved_by || 'じゅんやさん', 60),
    title,
    agent,
    target_repo: targetRepo,
    risk_level: riskLevel,
    prompt,
    body: truncate(workOrder.body || workOrder.prompt || prompt, MAX_PROMPT_LENGTH),
    originalRequest: truncate(workOrder.originalRequest || workOrder.original_request || '', 12000),
    selectedProjectId: truncate(workOrder.selectedProjectId || workOrder.selected_project_id || '', 60),
    selectedProjectPath: normalizeText(workOrder.selectedProjectPath || workOrder.selected_project_path || ''),
    selectedProjectLabel: truncate(workOrder.selectedProjectLabel || workOrder.selected_project_label || '', 120),
    safetyConditions: normalizeTextList(workOrder.safetyConditions || workOrder.safety_conditions, 20, 240),
    reportItems: normalizeTextList(workOrder.reportItems || workOrder.report_items, 20, 240),
    executionHost: truncate(workOrder.executionHost || workOrder.execution_host || '', 60),
    executionSource: truncate(workOrder.executionSource || workOrder.execution_source || '', 60),
    executionHostAllowed: workOrder.executionHostAllowed !== false,
    interactiveHostBlocked: !!workOrder.interactiveHostBlocked,
    noYesGateRuntime: workOrder.noYesGateRuntime !== false,
    safeSpawnActive: workOrder.safeSpawnActive !== false,
    manualCodeUiAllowed: workOrder.manualCodeUiAllowed === true,
    officialRoute: truncate(workOrder.officialRoute || 'Console → Handoff → Runner', 80),
    codexYesHellGuard: workOrder.codexYesHellGuard || 'active',
    codexAutoApproveMode: workOrder.codexAutoApproveMode || 'active',
    userYesRequired: workOrder.userYesRequired === true,
    interactivePromptBlocked: workOrder.interactivePromptBlocked === true,
    safetyStopGuard: workOrder.safetyStopGuard || 'active',
    promptType: truncate(workOrder.promptType || '', 40),
    promptOrigin: truncate(workOrder.promptOrigin || '', 60),
    blockedReason: truncate(workOrder.blockedReason || '', 120),
    userInputRequired: workOrder.userInputRequired === true,
    target: workOrder.target && typeof workOrder.target === 'object'
      ? {
          id: truncate(workOrder.target.id || workOrder.target.projectId || '', 60),
          label: truncate(workOrder.target.label || workOrder.target.name || '', 120),
          path: normalizeText(workOrder.target.path || workOrder.target.repo || targetRepo),
        }
      : {
          id: truncate(workOrder.selectedProjectId || workOrder.selected_project_id || '', 60),
          label: truncate(workOrder.selectedProjectLabel || workOrder.selected_project_label || '', 120),
          path: targetRepo,
        },
    requires_human_confirmation: true,
    source: truncate(record.source || 'kosame-console', 40),
  };
}

function readLatestApprovedWorkOrder(options = {}) {
  const approvalLogPath = getApprovalLogPath(options);
  const records = readJsonlRecords(approvalLogPath, Number(options.limit || 200));
  const targetRepo = normalizeText(options.targetRepo || options.target_repo || '');
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeApprovedWorkOrder(records[index]);
    if (normalized && (!targetRepo || normalized.target_repo === targetRepo)) {
      return {
        ok: true,
        approvalLogPath,
        latestApprovedWorkOrder: normalized,
      };
    }
  }
  return {
    ok: true,
    approvalLogPath,
    latestApprovedWorkOrder: null,
  };
}

function approveWorkOrder(input = {}, options = {}) {
  const approvalLogPath = getApprovalLogPath(options);
  const workOrder = sanitizeApprovalWorkOrder(input);
  const now = new Date().toISOString();
  const record = {
    approval_id: crypto.randomUUID(),
    status: 'approved',
    timestamp: now,
    approved_at: now,
    approved_by: truncate(options.approvedBy || 'じゅんやさん', 60),
    source: 'kosame-console',
    work_order: workOrder,
    title: workOrder.title,
    agent: workOrder.agent,
    target_repo: workOrder.target_repo,
    risk_level: workOrder.risk_level,
    executionHost: workOrder.executionHost,
    execution_host: workOrder.execution_host,
    executionSource: workOrder.executionSource,
    execution_source: workOrder.execution_source,
    executionHostAllowed: workOrder.executionHostAllowed,
    execution_host_allowed: workOrder.execution_host_allowed,
    interactiveHostBlocked: workOrder.interactiveHostBlocked,
    interactive_host_blocked: workOrder.interactive_host_blocked,
    noYesGateRuntime: workOrder.noYesGateRuntime,
    no_yes_gate_runtime: workOrder.no_yes_gate_runtime,
    safeSpawnActive: workOrder.safeSpawnActive,
    safe_spawn_active: workOrder.safe_spawn_active,
    manualCodeUiAllowed: workOrder.manualCodeUiAllowed,
    manual_code_ui_allowed: workOrder.manual_code_ui_allowed,
    officialRoute: workOrder.officialRoute,
    official_route: workOrder.official_route,
    codexYesHellGuard: workOrder.codexYesHellGuard || 'active',
    codex_yes_hell_guard: workOrder.codex_yes_hell_guard || workOrder.codexYesHellGuard || 'active',
    codexAutoApproveMode: workOrder.codexAutoApproveMode || 'active',
    codex_auto_approve_mode: workOrder.codex_auto_approve_mode || workOrder.codexAutoApproveMode || 'active',
    userYesRequired: workOrder.userYesRequired === true,
    user_yes_required: workOrder.user_yes_required === true,
    interactivePromptBlocked: workOrder.interactivePromptBlocked === true,
    interactive_prompt_blocked: workOrder.interactive_prompt_blocked === true,
    safetyStopGuard: workOrder.safetyStopGuard || 'active',
    safety_stop_guard: workOrder.safety_stop_guard || workOrder.safetyStopGuard || 'active',
    promptType: workOrder.promptType,
    prompt_type: workOrder.prompt_type,
    promptOrigin: workOrder.promptOrigin,
    prompt_origin: workOrder.prompt_origin,
    blockedReason: workOrder.blockedReason,
    blocked_reason: workOrder.blocked_reason,
    userInputRequired: workOrder.userInputRequired,
    user_input_required: workOrder.user_input_required,
  };

  fs.mkdirSync(path.dirname(approvalLogPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(approvalLogPath, `${JSON.stringify(record)}\n`, 'utf8');

  return {
    ok: true,
    approvalLogPath,
    approval: {
      approval_id: record.approval_id,
      status: record.status,
      approved_at: record.approved_at,
      approved_by: record.approved_by,
      title: workOrder.title,
      agent: workOrder.agent,
      target_repo: workOrder.target_repo,
      risk_level: workOrder.risk_level,
      prompt: workOrder.prompt,
      body: workOrder.body,
      originalRequest: workOrder.originalRequest,
      selectedProjectId: workOrder.selectedProjectId,
      selectedProjectPath: workOrder.selectedProjectPath,
      selectedProjectLabel: workOrder.selectedProjectLabel,
      safetyConditions: workOrder.safetyConditions,
      reportItems: workOrder.reportItems,
      executionHost: workOrder.executionHost,
      executionSource: workOrder.executionSource,
    executionHostAllowed: workOrder.executionHostAllowed,
    interactiveHostBlocked: workOrder.interactiveHostBlocked,
    noYesGateRuntime: workOrder.noYesGateRuntime,
    safeSpawnActive: workOrder.safeSpawnActive,
    manualCodeUiAllowed: workOrder.manualCodeUiAllowed,
    officialRoute: workOrder.officialRoute,
    codexYesHellGuard: workOrder.codexYesHellGuard,
    codexAutoApproveMode: workOrder.codexAutoApproveMode,
    userYesRequired: workOrder.userYesRequired,
    interactivePromptBlocked: workOrder.interactivePromptBlocked,
    safetyStopGuard: workOrder.safetyStopGuard,
    promptType: workOrder.promptType,
      promptOrigin: workOrder.promptOrigin,
      blockedReason: workOrder.blockedReason,
      userInputRequired: workOrder.userInputRequired,
      codexYesHellGuard: workOrder.codexYesHellGuard || 'active',
      codexAutoApproveMode: workOrder.codexAutoApproveMode || 'active',
      userYesRequired: workOrder.userYesRequired === true,
      interactivePromptBlocked: workOrder.interactivePromptBlocked === true,
      safetyStopGuard: workOrder.safetyStopGuard || 'active',
      target: workOrder.target,
      requires_human_confirmation: workOrder.requires_human_confirmation,
    },
    latestApprovedWorkOrder: normalizeApprovedWorkOrder(record),
  };
}

module.exports = {
  APPROVAL_LOG_PATH_ENV,
  DEFAULT_APPROVAL_LOG_PATH,
  approveWorkOrder,
  getApprovalLogPath,
  hasSecretLikeText,
  normalizeApprovedWorkOrder,
  readLatestApprovedWorkOrder,
  sanitizeApprovalWorkOrder,
};
