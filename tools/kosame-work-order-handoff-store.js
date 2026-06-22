#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  APPROVAL_LOG_PATH_ENV,
  DEFAULT_APPROVAL_LOG_PATH,
  hasSecretLikeText,
  readLatestApprovedWorkOrder,
} = require('./kosame-work-order-approval-store');

const DEFAULT_HANDOFF_LOG_PATH = path.join(os.homedir(), '.kosame', 'work-order-handoffs.jsonl');
const HANDOFF_LOG_PATH_ENV = 'KOSAME_WORK_ORDER_HANDOFF_LOG_PATH';
const HANDOFF_TARGET_REPO = '/home/lavie/kosame-dev-orchestra';
const ALLOWED_TARGET_REPOS = new Set([
  HANDOFF_TARGET_REPO,
  '/home/lavie/repos/kosame-sales-dx',
]);
const MAX_PROMPT_LENGTH = 12000;
const MAX_PROMPT_SUMMARY_LENGTH = 260;
const MAX_TEXT_LENGTH = 220;
const ALLOWED_STATUSES = new Set(['approved', 'ready_to_handoff', 'handed_to_agent', 'waiting_result']);
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

function maskHandoffText(value, maxLength = MAX_TEXT_LENGTH) {
  return truncate(value || '', maxLength)
    .replace(/\.env\b/gi, '[env]')
    .replace(/\bAPI[_-]?KEY\b/gi, 'API_KEY');
}

function readJsonlRecords(filePath, limit = 80) {
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
        // skip malformed work order handoff rows
      }
    }
    return records;
  } catch {
    return [];
  }
}

function getHandoffLogPath(options = {}) {
  return path.resolve(String(
    options.workOrderHandoffLogPath
    || process.env[HANDOFF_LOG_PATH_ENV]
    || DEFAULT_HANDOFF_LOG_PATH,
  ));
}

function normalizeWorkOrderHandoffStatus(value) {
  const status = normalizeText(value).toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`Invalid work order handoff status: ${status || '(empty)'}`);
  }
  return status;
}

function summarizePrompt(prompt) {
  const lines = normalizeText(prompt)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !PROMPT_SAFE_LINES.some((pattern) => pattern.test(line)));
  if (!lines.length) return '';
  return truncate(lines.slice(0, 4).join(' / '), MAX_PROMPT_SUMMARY_LENGTH);
}

function hasSecretLikePromptText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function resolveWorkOrderSource(input = {}) {
  const workOrder = input.work_order && typeof input.work_order === 'object'
    ? input.work_order
    : input && typeof input === 'object'
      ? input
      : {};
  const approved = workOrder.approval_record && typeof workOrder.approval_record === 'object'
    ? workOrder.approval_record
    : input.latestApprovedWorkOrder && typeof input.latestApprovedWorkOrder === 'object'
      ? input.latestApprovedWorkOrder
      : null;

  const approvalId = normalizeText(
    workOrder.approval_id
    || approved?.approval_id
    || input.work_order_id
    || input.approval_id
    || '',
  );
  const title = truncate(workOrder.title || approved?.title || '', 120);
  const targetRepo = normalizeText(workOrder.target_repo || approved?.target_repo || input.target_repo || '');
  const assignedAgent = truncate(
    input.assigned_agent
    || workOrder.assigned_agent
    || workOrder.agent
    || approved?.agent
    || 'Codex',
    60,
  );
  const recommendedAgent = truncate(workOrder.recommended_agent || approved?.agent || assignedAgent, 60);
  const riskLevel = truncate(workOrder.risk_level || approved?.risk_level || 'low', 24);
  const humanGateRequired = workOrder.requires_human_confirmation !== false
    && approved?.requires_human_confirmation !== false;
  const prompt = normalizeText(workOrder.body || workOrder.prompt || approved?.body || approved?.prompt || '');
  const originalRequest = truncate(
    workOrder.originalRequest
    || workOrder.original_request
    || approved?.originalRequest
    || approved?.original_request
    || '',
    12000,
  );
  const selectedProjectId = truncate(
    workOrder.selectedProjectId
    || workOrder.selected_project_id
    || approved?.selectedProjectId
    || approved?.selected_project_id
    || '',
    60,
  );
  const selectedProjectPath = normalizeText(
    workOrder.selectedProjectPath
    || workOrder.selected_project_path
    || approved?.selectedProjectPath
    || approved?.selected_project_path
    || '',
  );
  const selectedProjectLabel = truncate(
    workOrder.selectedProjectLabel
    || workOrder.selected_project_label
    || approved?.selectedProjectLabel
    || approved?.selected_project_label
    || '',
    120,
  );
  const safetyConditions = normalizeTextList(
    workOrder.safetyConditions
    || workOrder.safety_conditions
    || approved?.safetyConditions
    || approved?.safety_conditions,
    20,
    240,
  ).map((line) => maskHandoffText(line));
  const reportItems = normalizeTextList(
    workOrder.reportItems
    || workOrder.report_items
    || approved?.reportItems
    || approved?.report_items,
    20,
    240,
  ).map((line) => maskHandoffText(line));
  const executionHost = truncate(
    workOrder.executionHost
    || workOrder.execution_host
    || approved?.executionHost
    || approved?.execution_host
    || '',
    60,
  );
  const executionSource = truncate(
    workOrder.executionSource
    || workOrder.execution_source
    || approved?.executionSource
    || approved?.execution_source
    || '',
    60,
  );
  const executionHostAllowed = (workOrder.executionHostAllowed ?? approved?.executionHostAllowed) !== false;
  const interactiveHostBlocked = !!(workOrder.interactiveHostBlocked ?? approved?.interactiveHostBlocked);
  const noYesGateRuntime = (workOrder.noYesGateRuntime ?? approved?.noYesGateRuntime) !== false;
  const safeSpawnActive = (workOrder.safeSpawnActive ?? approved?.safeSpawnActive) !== false;
  const manualCodeUiAllowed = (workOrder.manualCodeUiAllowed ?? approved?.manualCodeUiAllowed) === true;
  const officialRoute = truncate(workOrder.officialRoute || approved?.officialRoute || 'Console → Handoff → Runner', 80);
  const promptType = truncate(workOrder.promptType || approved?.promptType || '', 40);
  const promptOrigin = truncate(workOrder.promptOrigin || approved?.promptOrigin || '', 60);
  const blockedReason = truncate(workOrder.blockedReason || approved?.blockedReason || '', 120);
  const userInputRequired = (workOrder.userInputRequired ?? approved?.userInputRequired) === true;
  const safePromptSummary = summarizePrompt(
    input.safe_prompt_summary
    || workOrder.safe_prompt_summary
    || prompt,
  );
  const maskedOriginalRequest = maskHandoffText(originalRequest, MAX_PROMPT_LENGTH);
  const filteredPrompt = prompt
    .split(/\r?\n/)
    .filter((line) => !PROMPT_SAFE_LINES.some((pattern) => pattern.test(line)))
    .join('\n');

  if (!approvalId) throw new Error('approval_id または work_order_id が必要です。');
  if (!title) throw new Error('title が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) throw new Error('target_repo が不明です。');
  if (!assignedAgent) throw new Error('assigned_agent が必要です。');
  if (!safePromptSummary) throw new Error('safe prompt summary が必要です。');
  if (prompt && hasSecretLikePromptText(filteredPrompt)) {
    throw new Error('secret っぽい内容は保存できません。');
  }
  const rawForSecretCheck = [
    title,
    targetRepo,
    assignedAgent,
    recommendedAgent,
    riskLevel,
    maskHandoffText(originalRequest),
    selectedProjectId,
    selectedProjectPath,
    selectedProjectLabel,
    ...safetyConditions.map((line) => maskHandoffText(line)),
    ...reportItems.map((line) => maskHandoffText(line)),
    maskHandoffText(safePromptSummary, MAX_PROMPT_SUMMARY_LENGTH),
    maskHandoffText(filteredPrompt),
  ].join('\n');
  if (hasSecretLikeText(rawForSecretCheck)) {
    throw new Error('secret っぽい内容は保存できません。');
  }

  return {
    approval_id: approvalId,
    work_order_id: approvalId,
    title,
    target_repo: targetRepo,
    assigned_agent: assignedAgent,
    recommended_agent: recommendedAgent,
    risk_level: riskLevel,
    human_gate_required: !!humanGateRequired,
    safe_prompt_summary: maskHandoffText(safePromptSummary),
    prompt,
    body: workOrder.body || workOrder.prompt || prompt,
    originalRequest: maskedOriginalRequest,
    selectedProjectId,
    selectedProjectPath,
    selectedProjectLabel,
    safetyConditions: safetyConditions.map((line) => maskHandoffText(line)),
    reportItems: reportItems.map((line) => maskHandoffText(line)),
    executionHost,
    executionSource,
    executionHostAllowed,
    interactiveHostBlocked,
    noYesGateRuntime,
    safeSpawnActive,
    manualCodeUiAllowed,
    officialRoute,
    promptType,
    promptOrigin,
    blockedReason,
    userInputRequired,
    target: {
      id: selectedProjectId,
      label: selectedProjectLabel,
      path: targetRepo,
    },
    source: truncate(input.source || workOrder.source || approved?.source || 'kosame-console', 40),
  };
}

function normalizeWorkOrderHandoffRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const status = normalizeText(record.status || record.handoff_status || '').toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) return null;
  const targetRepo = normalizeText(record.target_repo || '');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) return null;
  const title = truncate(record.title || '', 120);
  const assignedAgent = truncate(record.assigned_agent || record.agent || '', 60);
  const recommendedAgent = truncate(record.recommended_agent || record.agent || assignedAgent, 60);
  const safePromptSummary = summarizePrompt(record.safe_prompt_summary || record.prompt_summary || record.prompt || '');
  const approvalId = normalizeText(record.approval_id || record.work_order_id || record.id || '');
  if (!approvalId || !title || !assignedAgent) return null;
  const attachments = Array.isArray(record.attachments) ? record.attachments.slice(0, 20) : [];
  return {
    handoff_id: normalizeText(record.handoff_id || record.id || approvalId),
    work_order_id: approvalId,
    approval_id: approvalId,
    status,
    title,
    target_repo: targetRepo,
    assigned_agent: assignedAgent,
    recommended_agent: recommendedAgent,
    risk_level: truncate(record.risk_level || 'low', 24),
    human_gate_required: record.human_gate_required !== false,
    safe_prompt_summary: safePromptSummary,
    prompt: normalizeText(record.prompt || record.body || ''),
    body: normalizeText(record.body || record.prompt || ''),
    originalRequest: truncate(record.originalRequest || record.original_request || '', 12000),
    selectedProjectId: truncate(record.selectedProjectId || record.selected_project_id || '', 60),
    selectedProjectPath: normalizeText(record.selectedProjectPath || record.selected_project_path || ''),
    selectedProjectLabel: truncate(record.selectedProjectLabel || record.selected_project_label || '', 120),
    safetyConditions: normalizeTextList(record.safetyConditions || record.safety_conditions, 20, 240),
    reportItems: normalizeTextList(record.reportItems || record.report_items, 20, 240),
    executionHost: truncate(record.executionHost || record.execution_host || '', 60),
    executionSource: truncate(record.executionSource || record.execution_source || '', 60),
    executionHostAllowed: record.executionHostAllowed !== false,
    interactiveHostBlocked: !!record.interactiveHostBlocked,
    noYesGateRuntime: record.noYesGateRuntime !== false,
    safeSpawnActive: record.safeSpawnActive !== false,
    manualCodeUiAllowed: record.manualCodeUiAllowed === true,
    officialRoute: truncate(record.officialRoute || 'Console → Handoff → Runner', 80),
    promptType: truncate(record.promptType || '', 40),
    promptOrigin: truncate(record.promptOrigin || '', 60),
    blockedReason: truncate(record.blockedReason || '', 120),
    userInputRequired: record.userInputRequired === true,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      displayName: normalizeText(attachment.displayName || attachment.name || attachment.originalName || ''),
    })),
    attachmentCount: Number.isFinite(Number(record.attachmentCount || record.attachment_count)) ? Number(record.attachmentCount || record.attachment_count) : attachments.length,
    attachment_count: Number.isFinite(Number(record.attachmentCount || record.attachment_count)) ? Number(record.attachmentCount || record.attachment_count) : attachments.length,
    attachmentSummary: Array.isArray(record.attachmentSummary) ? record.attachmentSummary : Array.isArray(record.attachment_summary) ? record.attachment_summary : [],
    attachment_manifest_path: normalizeText(record.attachment_manifest_path || record.attachmentManifestPath || ''),
    attachmentManifestPath: normalizeText(record.attachmentManifestPath || record.attachment_manifest_path || ''),
    attachment_dir: normalizeText(record.attachment_dir || record.attachmentDir || ''),
    attachmentDir: normalizeText(record.attachmentDir || record.attachment_dir || ''),
    target: record.target && typeof record.target === 'object'
      ? {
          id: truncate(record.target.id || record.target.projectId || '', 60),
          label: truncate(record.target.label || record.target.name || '', 120),
          path: normalizeText(record.target.path || record.target.repo || targetRepo),
        }
      : {
          id: truncate(record.selectedProjectId || record.selected_project_id || '', 60),
          label: truncate(record.selectedProjectLabel || record.selected_project_label || '', 120),
          path: targetRepo,
        },
    timestamp: normalizeText(record.timestamp || record.created_at || ''),
    updated_at: normalizeText(record.updated_at || record.timestamp || record.created_at || ''),
    source: truncate(record.source || 'kosame-console', 40),
  };
}

function synthesizeLatestHandoff(latestApprovedWorkOrder) {
  if (!latestApprovedWorkOrder || typeof latestApprovedWorkOrder !== 'object') return null;
  return normalizeWorkOrderHandoffRecord({
    handoff_id: latestApprovedWorkOrder.approval_id || latestApprovedWorkOrder.id || crypto.randomUUID(),
    approval_id: latestApprovedWorkOrder.approval_id || latestApprovedWorkOrder.id || '',
    work_order_id: latestApprovedWorkOrder.approval_id || latestApprovedWorkOrder.id || '',
    status: 'ready_to_handoff',
    title: latestApprovedWorkOrder.title,
    target_repo: latestApprovedWorkOrder.target_repo,
    assigned_agent: latestApprovedWorkOrder.agent,
    recommended_agent: latestApprovedWorkOrder.agent,
    risk_level: latestApprovedWorkOrder.risk_level,
    human_gate_required: latestApprovedWorkOrder.requires_human_confirmation !== false,
    safe_prompt_summary: summarizePrompt(latestApprovedWorkOrder.body || latestApprovedWorkOrder.prompt),
    prompt: latestApprovedWorkOrder.prompt,
    body: latestApprovedWorkOrder.body || latestApprovedWorkOrder.prompt,
    originalRequest: latestApprovedWorkOrder.originalRequest || latestApprovedWorkOrder.original_request || '',
    selectedProjectId: latestApprovedWorkOrder.selectedProjectId || latestApprovedWorkOrder.selected_project_id || '',
    selectedProjectPath: latestApprovedWorkOrder.selectedProjectPath || latestApprovedWorkOrder.selected_project_path || '',
    selectedProjectLabel: latestApprovedWorkOrder.selectedProjectLabel || latestApprovedWorkOrder.selected_project_label || '',
    safetyConditions: latestApprovedWorkOrder.safetyConditions || latestApprovedWorkOrder.safety_conditions || [],
    reportItems: latestApprovedWorkOrder.reportItems || latestApprovedWorkOrder.report_items || [],
    executionHost: latestApprovedWorkOrder.executionHost || latestApprovedWorkOrder.execution_host || '',
    executionSource: latestApprovedWorkOrder.executionSource || latestApprovedWorkOrder.execution_source || '',
    executionHostAllowed: latestApprovedWorkOrder.executionHostAllowed !== false,
    interactiveHostBlocked: !!latestApprovedWorkOrder.interactiveHostBlocked,
    noYesGateRuntime: latestApprovedWorkOrder.noYesGateRuntime !== false,
    safeSpawnActive: latestApprovedWorkOrder.safeSpawnActive !== false,
    manualCodeUiAllowed: latestApprovedWorkOrder.manualCodeUiAllowed === true,
    officialRoute: latestApprovedWorkOrder.officialRoute || 'Console → Handoff → Runner',
    promptType: latestApprovedWorkOrder.promptType || '',
    promptOrigin: latestApprovedWorkOrder.promptOrigin || '',
    blockedReason: latestApprovedWorkOrder.blockedReason || '',
    userInputRequired: latestApprovedWorkOrder.userInputRequired === true,
    target: latestApprovedWorkOrder.target || {
      id: latestApprovedWorkOrder.selectedProjectId || latestApprovedWorkOrder.selected_project_id || '',
      label: latestApprovedWorkOrder.selectedProjectLabel || latestApprovedWorkOrder.selected_project_label || '',
      path: latestApprovedWorkOrder.target_repo,
    },
    timestamp: latestApprovedWorkOrder.approved_at || latestApprovedWorkOrder.timestamp || '',
    updated_at: latestApprovedWorkOrder.approved_at || latestApprovedWorkOrder.timestamp || '',
    source: latestApprovedWorkOrder.source || 'kosame-console',
  });
}

function readLatestWorkOrderHandoff(options = {}) {
  const handoffLogPath = getHandoffLogPath(options);
  const approvalLogPath = options.workOrderApprovalLogPath
    || process.env[APPROVAL_LOG_PATH_ENV]
    || DEFAULT_APPROVAL_LOG_PATH;
  const records = readJsonlRecords(handoffLogPath, Number(options.limit || 80));
  const normalizedRecords = records
    .map(normalizeWorkOrderHandoffRecord)
    .filter((record) => record && ALLOWED_TARGET_REPOS.has(record.target_repo))
    .sort((a, b) => String(a.timestamp || a.updated_at || '').localeCompare(String(b.timestamp || b.updated_at || '')));
  const latestRecorded = normalizedRecords.length ? normalizedRecords[normalizedRecords.length - 1] : null;
  const latestApproved = readLatestApprovedWorkOrder({
    workOrderApprovalLogPath: approvalLogPath,
    limit: Number(options.approvalLimit || 200),
    targetRepo: HANDOFF_TARGET_REPO,
  }).latestApprovedWorkOrder;
  const synthesized = synthesizeLatestHandoff(latestApproved);
  const latestHandoffWorkOrder = latestApproved
    ? (latestRecorded && latestRecorded.approval_id === latestApproved.approval_id ? latestRecorded : synthesized)
    : latestRecorded;
  const workOrderHandoffQueue = latestHandoffWorkOrder ? [latestHandoffWorkOrder] : [];
  return {
    ok: true,
    handoffLogPath,
    workOrderHandoffQueue,
    latestHandoffWorkOrder,
    latestApprovedWorkOrder: latestApproved || null,
  };
}

function recordWorkOrderHandoff(input = {}, options = {}) {
  const handoffLogPath = getHandoffLogPath(options);
  const source = resolveWorkOrderSource({
    ...input,
    latestApprovedWorkOrder: options.latestApprovedWorkOrder,
  });
  const now = new Date().toISOString();
  const record = {
    handoff_id: crypto.randomUUID(),
    approval_id: source.approval_id,
    work_order_id: source.work_order_id,
    status: normalizeWorkOrderHandoffStatus(input.status || source.status || 'ready_to_handoff'),
    timestamp: now,
    updated_at: now,
    title: source.title,
    target_repo: source.target_repo,
    assigned_agent: source.assigned_agent,
    recommended_agent: source.recommended_agent,
    risk_level: source.risk_level,
    human_gate_required: source.human_gate_required,
    safe_prompt_summary: source.safe_prompt_summary,
    prompt: source.prompt,
    body: source.body,
    originalRequest: source.originalRequest,
    selectedProjectId: source.selectedProjectId,
    selectedProjectPath: source.selectedProjectPath,
    selectedProjectLabel: source.selectedProjectLabel,
    safetyConditions: source.safetyConditions,
    reportItems: source.reportItems,
    executionHost: source.executionHost,
    executionSource: source.executionSource,
    executionHostAllowed: source.executionHostAllowed,
    interactiveHostBlocked: source.interactiveHostBlocked,
    noYesGateRuntime: source.noYesGateRuntime,
    safeSpawnActive: source.safeSpawnActive,
    manualCodeUiAllowed: source.manualCodeUiAllowed,
    officialRoute: source.officialRoute,
    promptType: source.promptType,
    promptOrigin: source.promptOrigin,
    blockedReason: source.blockedReason,
    userInputRequired: source.userInputRequired,
    target: source.target,
    source: source.source,
  };

  fs.mkdirSync(path.dirname(handoffLogPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(handoffLogPath, `${JSON.stringify(record)}\n`, 'utf8');

  return {
    ok: true,
    handoffLogPath,
    latestHandoffWorkOrder: normalizeWorkOrderHandoffRecord(record),
  };
}

module.exports = {
  HANDOFF_LOG_PATH_ENV,
  DEFAULT_HANDOFF_LOG_PATH,
  HANDOFF_TARGET_REPO,
  getHandoffLogPath,
  normalizeWorkOrderHandoffStatus,
  readLatestWorkOrderHandoff,
  recordWorkOrderHandoff,
  synthesizeLatestHandoff,
};
