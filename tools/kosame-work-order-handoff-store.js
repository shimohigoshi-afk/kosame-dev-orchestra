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
  const prompt = normalizeText(workOrder.prompt || approved?.prompt || '');
  const safePromptSummary = summarizePrompt(
    input.safe_prompt_summary
    || workOrder.safe_prompt_summary
    || prompt,
  );
  const filteredPrompt = prompt
    .split(/\r?\n/)
    .filter((line) => !PROMPT_SAFE_LINES.some((pattern) => pattern.test(line)))
    .join('\n');

  if (!approvalId) throw new Error('approval_id または work_order_id が必要です。');
  if (!title) throw new Error('title が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (targetRepo !== HANDOFF_TARGET_REPO) throw new Error('target_repo は KOSAME Dev Orchestra のみです。');
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
    safePromptSummary,
    filteredPrompt,
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
    safe_prompt_summary: safePromptSummary,
    prompt: prompt,
    source: truncate(input.source || workOrder.source || approved?.source || 'kosame-console', 40),
  };
}

function normalizeWorkOrderHandoffRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const status = normalizeText(record.status || record.handoff_status || '').toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) return null;
  const targetRepo = normalizeText(record.target_repo || '');
  if (targetRepo !== HANDOFF_TARGET_REPO) return null;
  const title = truncate(record.title || '', 120);
  const assignedAgent = truncate(record.assigned_agent || record.agent || '', 60);
  const recommendedAgent = truncate(record.recommended_agent || record.agent || assignedAgent, 60);
  const safePromptSummary = summarizePrompt(record.safe_prompt_summary || record.prompt_summary || record.prompt || '');
  const approvalId = normalizeText(record.approval_id || record.work_order_id || record.id || '');
  if (!approvalId || !title || !assignedAgent) return null;
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
    safe_prompt_summary: summarizePrompt(latestApprovedWorkOrder.prompt),
    prompt: latestApprovedWorkOrder.prompt,
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
    .filter((record) => record && record.target_repo === HANDOFF_TARGET_REPO)
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
