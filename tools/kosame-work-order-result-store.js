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
const {
  buildWorkOrderResultDecision,
  normalizeOutcome,
} = require('./kosame-work-order-result-decision');

const DEFAULT_RESULT_LOG_PATH = path.join(os.homedir(), '.kosame', 'work-order-results.jsonl');
const RESULT_LOG_PATH_ENV = 'KOSAME_WORK_ORDER_RESULT_LOG_PATH';
const HANDOFF_TARGET_REPO = '/home/lavie/kosame-dev-orchestra';
const MAX_TEXT_LENGTH = 260;
const MAX_NOTE_LENGTH = 400;
const ALLOWED_RESULT_STATUSES = new Set(['success', 'failed', 'needs_fix']);
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
        // skip malformed work order result rows
      }
    }
    return records;
  } catch {
    return [];
  }
}

function readWorkOrderResultHistory(options = {}) {
  const resultLogPath = getResultLogPath(options);
  const approvalLogPath = options.workOrderApprovalLogPath
    || process.env[APPROVAL_LOG_PATH_ENV]
    || DEFAULT_APPROVAL_LOG_PATH;
  const limit = Number(options.limit || 10);
  const targetRepoFilter = normalizeText(options.targetRepo || options.target_repo || HANDOFF_TARGET_REPO);
  const records = readJsonlRecords(resultLogPath, Number.isFinite(limit) && limit > 0 ? limit : 3);
  const items = records
    .map(normalizeWorkOrderResultRecord)
    .filter((record) => record && (!targetRepoFilter || record.target_repo === targetRepoFilter))
    .sort((a, b) => String(a.timestamp || a.updated_at || '').localeCompare(String(b.timestamp || b.updated_at || '')))
    .map((record, index) => ({
      ...record,
      run_number: index + 1,
      runNumber: index + 1,
    }));
  return {
    ok: true,
    resultLogPath,
    approvalLogPath,
    items,
  };
}

function getResultLogPath(options = {}) {
  return path.resolve(String(
    options.workOrderResultLogPath
    || process.env[RESULT_LOG_PATH_ENV]
    || DEFAULT_RESULT_LOG_PATH,
  ));
}

function normalizeResultStatus(value) {
  const status = normalizeText(value).toLowerCase();
  if (!ALLOWED_RESULT_STATUSES.has(status)) {
    throw new Error(`Invalid work order result status: ${status || '(empty)'}`);
  }
  return status;
}

function normalizeChangedFiles(value) {
  const rawItems = Array.isArray(value)
    ? value
    : normalizeText(value)
      .split(/[\r\n,]+/)
      .map((line) => line.trim());
  const items = [];
  for (const item of rawItems) {
    const text = normalizeText(item);
    if (!text) continue;
    if (hasSecretLikeText(text)) {
      throw new Error('secret っぽいファイル名は保存できません。');
    }
    items.push(truncate(text, 140));
    if (items.length >= 20) break;
  }
  return items;
}

function summarizeChangedFiles(items) {
  return Array.isArray(items) && items.length ? items.join(' | ') : '—';
}

function buildNextRecommendedAction(resultStatus, smokeResult, verifyResult) {
  return buildWorkOrderResultDecision({
    latestWorkOrderResult: {
      result_status: resultStatus,
      smoke_result: smokeResult,
      verify_result: verifyResult,
    },
  }).nextRecommendedAction;
}

function buildSafeResultText(input = {}) {
  const summary = truncate(input.result_summary || input.summary || '', MAX_NOTE_LENGTH);
  const notes = truncate(input.notes || '', MAX_NOTE_LENGTH);
  const smoke = normalizeOutcome(input.smoke_result);
  const verify = normalizeOutcome(input.verify_result);
  const changedFiles = normalizeChangedFiles(input.changed_files);
  const status = normalizeResultStatus(input.result_status || input.status || 'success');
  const yesCount = Number.isFinite(Number(input.yes_count ?? input.yesCount)) ? Number(input.yes_count ?? input.yesCount) : 0;
  const copyCount = Number.isFinite(Number(input.copy_count ?? input.copyCount)) ? Number(input.copy_count ?? input.copyCount) : 0;
  const humanWait = Number.isFinite(Number(input.human_wait ?? input.humanWait ?? input.human_wait_count ?? input.humanWaitCount))
    ? Number(input.human_wait ?? input.humanWait ?? input.human_wait_count ?? input.humanWaitCount)
    : 0;
  const approvalRequestCount = Number.isFinite(Number(input.approval_request_count ?? input.yesCount ?? input.yes_count)) ? Number(input.approval_request_count ?? input.yesCount ?? input.yes_count) : yesCount;
  const manualPasteCount = Number.isFinite(Number(input.manual_paste_count ?? input.copyCount ?? input.copy_count)) ? Number(input.manual_paste_count ?? input.copyCount ?? input.copy_count) : copyCount;
  const waitRequestCount = Number.isFinite(Number(input.wait_request_count ?? input.humanWaitCount ?? input.human_wait)) ? Number(input.wait_request_count ?? input.humanWaitCount ?? input.human_wait) : humanWait;
  const executor = truncate(input.executor || input.assigned_agent || input.agent || '', 60);
  const resultPost = truncate(input.result_post || input.resultPOST || input.result_post_status || '', 120);
  const executionPath = truncate(input.execution_path || input.executionPath || '', 180);
  const route = truncate(input.route || input.execution_route || 'zero-confirm', 40);
  const promptType = truncate(input.prompt_type || input.promptType || '', 40);
  const autoApprovedCount = Number.isFinite(Number(input.auto_approved_count ?? input.autoApprovedCount)) ? Number(input.auto_approved_count ?? input.autoApprovedCount) : 0;
  const autoBlockedCount = Number.isFinite(Number(input.auto_blocked_count ?? input.autoBlockedCount)) ? Number(input.auto_blocked_count ?? input.autoBlockedCount) : 0;
  const retryCount = Number.isFinite(Number(input.retry_count ?? input.retryCount)) ? Number(input.retry_count ?? input.retryCount) : 0;
  const recovered = !!input.recovered;
  const resultPostRetryCount = Number.isFinite(Number(input.result_post_retry_count ?? input.resultPostRetryCount)) ? Number(input.result_post_retry_count ?? input.resultPostRetryCount) : 0;
  const rawCheck = [
    summary,
    notes,
    changedFiles.join('\n'),
    smoke,
    verify,
    executor,
    resultPost,
    executionPath,
    route,
    promptType,
  ].join('\n');
  if (hasSecretLikeText(rawCheck)) {
    throw new Error('secret っぽい内容は保存できません。');
  }
  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: {
      result_status: status,
      smoke_result: smoke,
      verify_result: verify,
    },
  });
  return {
    result_status: status,
    work_order_status: status === 'failed' ? 'failed' : status === 'needs_fix' ? 'needs_fix' : 'completed',
    handoff_status: status === 'failed'
      ? 'needs_attention'
      : status === 'needs_fix'
        ? 'revision_needed'
        : 'review_ready',
    activity_status: decision.activity_status,
    nextRecommendedAction: decision.nextRecommendedAction,
    decision_status: decision.decision_status,
    decision_reason: decision.reason,
    required_next_work: decision.required_next_work,
    commit_tag_push_allowed: decision.commit_tag_push_allowed,
    human_gate_required: decision.human_gate_required,
    decision_summary: decision.summary,
    result_summary: summary,
    changed_files: changedFiles,
    changed_files_summary: summarizeChangedFiles(changedFiles),
    smoke_result: smoke,
    verify_result: verify,
    notes,
    yes_count: yesCount,
    copy_count: copyCount,
    human_wait: humanWait,
    approval_request_count: approvalRequestCount,
    manual_paste_count: manualPasteCount,
    wait_request_count: waitRequestCount,
    yesCount,
    copyCount,
    humanWait,
    approvalRequestCount,
    manualPasteCount,
    waitRequestCount,
    executor: executor || 'Codex',
    route,
    prompt_type: promptType,
    auto_approved_count: autoApprovedCount,
    auto_blocked_count: autoBlockedCount,
    retry_count: retryCount,
    recovered,
    result_post_retry_count: resultPostRetryCount,
    result_post: resultPost || 'POST /api/work-orders/result 200',
    execution_path: executionPath || 'Console → 作業票採用 → watcher → claude-zero-confirm → verify / smoke → commit → tag → push → resultPOST → Result Decision',
  };
}

function normalizeWorkOrderResultRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const status = normalizeText(record.result_status || record.status || '').toLowerCase();
  if (!ALLOWED_RESULT_STATUSES.has(status)) return null;
  const targetRepo = normalizeText(record.target_repo || '');
  if (targetRepo !== HANDOFF_TARGET_REPO) return null;
  const workOrderId = normalizeText(record.work_order_id || record.approval_id || record.handoff_id || record.id || '');
  const title = truncate(record.title || '', 120);
  const assignedAgent = truncate(record.assigned_agent || record.agent || '', 60);
  if (!workOrderId || !title || !assignedAgent) return null;
  const smoke = normalizeOutcome(record.smoke_result);
  const verify = normalizeOutcome(record.verify_result);
  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: {
      result_status: status,
      smoke_result: smoke,
      verify_result: verify,
      title,
      target_repo: targetRepo,
      assigned_agent: assignedAgent,
      recommended_agent: truncate(record.recommended_agent || record.agent || assignedAgent, 60),
      risk_level: truncate(record.risk_level || 'low', 24),
      human_gate_required: record.human_gate_required !== false,
    },
    latestHandoffWorkOrder: {
      title,
      target_repo: targetRepo,
      assigned_agent: assignedAgent,
      recommended_agent: truncate(record.recommended_agent || record.agent || assignedAgent, 60),
      risk_level: truncate(record.risk_level || 'low', 24),
      human_gate_required: record.human_gate_required !== false,
    },
    latestApprovedWorkOrder: {
      title,
      target_repo: targetRepo,
      agent: assignedAgent,
      risk_level: truncate(record.risk_level || 'low', 24),
      requires_human_confirmation: record.human_gate_required !== false,
    },
  });
  return {
    result_id: normalizeText(record.result_id || record.id || workOrderId),
    work_order_id: workOrderId,
    approval_id: normalizeText(record.approval_id || workOrderId),
    handoff_id: normalizeText(record.handoff_id || workOrderId),
    target_repo: targetRepo,
    title,
    assigned_agent: assignedAgent,
    recommended_agent: truncate(record.recommended_agent || record.agent || assignedAgent, 60),
    risk_level: truncate(record.risk_level || 'low', 24),
    human_gate_required: record.human_gate_required !== false,
    result_status: status,
    work_order_status: normalizeText(record.work_order_status || (status === 'failed' ? 'failed' : status === 'needs_fix' ? 'needs_fix' : 'completed')),
    handoff_status: normalizeText(record.handoff_status || (status === 'failed' ? 'needs_attention' : status === 'needs_fix' ? 'revision_needed' : 'review_ready')),
    activity_status: normalizeText(record.activity_status || decision.activity_status),
    nextRecommendedAction: normalizeText(record.nextRecommendedAction || decision.nextRecommendedAction),
    result_summary: truncate(record.result_summary || record.summary || '', MAX_NOTE_LENGTH),
    changed_files: Array.isArray(record.changed_files) ? record.changed_files.slice(0, 20).map((item) => truncate(item, 140)) : [],
    changed_files_summary: truncate(record.changed_files_summary || summarizeChangedFiles(record.changed_files), MAX_NOTE_LENGTH),
    smoke_result: smoke,
    verify_result: verify,
    notes: truncate(record.notes || '', MAX_NOTE_LENGTH),
    yes_count: Number.isFinite(Number(record.yes_count ?? record.yesCount)) ? Number(record.yes_count ?? record.yesCount) : 0,
    copy_count: Number.isFinite(Number(record.copy_count ?? record.copyCount)) ? Number(record.copy_count ?? record.copyCount) : 0,
    human_wait: Number.isFinite(Number(record.human_wait ?? record.humanWait ?? record.human_wait_count ?? record.humanWaitCount))
      ? Number(record.human_wait ?? record.humanWait ?? record.human_wait_count ?? record.humanWaitCount)
      : 0,
    approval_request_count: Number.isFinite(Number(record.approval_request_count ?? record.yesCount ?? record.yes_count)) ? Number(record.approval_request_count ?? record.yesCount ?? record.yes_count) : 0,
    manual_paste_count: Number.isFinite(Number(record.manual_paste_count ?? record.copyCount ?? record.copy_count)) ? Number(record.manual_paste_count ?? record.copyCount ?? record.copy_count) : 0,
    wait_request_count: Number.isFinite(Number(record.wait_request_count ?? record.humanWaitCount ?? record.human_wait)) ? Number(record.wait_request_count ?? record.humanWaitCount ?? record.human_wait) : 0,
    auto_approved_count: Number.isFinite(Number(record.auto_approved_count ?? record.autoApprovedCount)) ? Number(record.auto_approved_count ?? record.autoApprovedCount) : 0,
    auto_blocked_count: Number.isFinite(Number(record.auto_blocked_count ?? record.autoBlockedCount)) ? Number(record.auto_blocked_count ?? record.autoBlockedCount) : 0,
    retry_count: Number.isFinite(Number(record.retry_count ?? record.retryCount)) ? Number(record.retry_count ?? record.retryCount) : 0,
    recovered: !!record.recovered,
    result_post_retry_count: Number.isFinite(Number(record.result_post_retry_count ?? record.resultPostRetryCount)) ? Number(record.result_post_retry_count ?? record.resultPostRetryCount) : 0,
    executor: truncate(record.executor || record.assigned_agent || record.agent || 'Codex', 60),
    route: truncate(record.route || record.execution_route || 'zero-confirm', 40),
    result_post: truncate(record.result_post || record.resultPOST || 'POST /api/work-orders/result 200', 120),
    execution_path: truncate(record.execution_path || record.executionPath || 'Console → 作業票採用 → watcher → claude-zero-confirm → verify / smoke → commit → tag → push → resultPOST → Result Decision', 180),
    timestamp: normalizeText(record.timestamp || record.created_at || ''),
    updated_at: normalizeText(record.updated_at || record.timestamp || record.created_at || ''),
    source: truncate(record.source || 'kosame-console', 40),
    decision_status: normalizeText(record.decision_status || record.result_decision || decision.decision_status),
    decision_reason: truncate(record.decision_reason || decision.reason, MAX_NOTE_LENGTH),
    required_next_work: truncate(record.required_next_work || decision.required_next_work, MAX_NOTE_LENGTH),
    commit_tag_push_allowed: record.commit_tag_push_allowed === true || decision.commit_tag_push_allowed,
    decision_summary: truncate(record.decision_summary || decision.summary, MAX_NOTE_LENGTH),
  };
}

function mergeWorkOrderResultIntoHandoff(handoff, result) {
  const base = handoff && typeof handoff === 'object' ? { ...handoff } : null;
  const latestResult = result && typeof result === 'object' ? result : null;
  if (!base) return latestResult ? null : null;
  if (!latestResult) return base;
  const sameWorkOrder = normalizeText(base.approval_id || base.work_order_id || '') === normalizeText(latestResult.approval_id || latestResult.work_order_id || '');
  if (!sameWorkOrder) return base;
  return {
    ...base,
    status: latestResult.handoff_status || base.status,
    result_id: latestResult.result_id,
    result_status: latestResult.result_status,
    work_order_status: latestResult.work_order_status,
    handoff_status: latestResult.handoff_status,
    activity_status: latestResult.activity_status,
    nextRecommendedAction: latestResult.nextRecommendedAction,
    decision_status: latestResult.decision_status,
    decision_reason: latestResult.decision_reason,
    required_next_work: latestResult.required_next_work,
    commit_tag_push_allowed: latestResult.commit_tag_push_allowed,
    decision_summary: latestResult.decision_summary,
    result_summary: latestResult.result_summary,
    changed_files: latestResult.changed_files,
    changed_files_summary: latestResult.changed_files_summary,
    smoke_result: latestResult.smoke_result,
    verify_result: latestResult.verify_result,
    notes: latestResult.notes,
    yes_count: latestResult.yes_count,
    copy_count: latestResult.copy_count,
    human_wait: latestResult.human_wait,
    approval_request_count: latestResult.approval_request_count,
    manual_paste_count: latestResult.manual_paste_count,
    wait_request_count: latestResult.wait_request_count,
    auto_approved_count: latestResult.auto_approved_count,
    auto_blocked_count: latestResult.auto_blocked_count,
    retry_count: latestResult.retry_count,
    recovered: latestResult.recovered,
    result_post_retry_count: latestResult.result_post_retry_count,
    yesCount: latestResult.yes_count,
    copyCount: latestResult.copy_count,
    humanWait: latestResult.human_wait,
    approvalRequestCount: latestResult.approval_request_count,
    manualPasteCount: latestResult.manual_paste_count,
    waitRequestCount: latestResult.wait_request_count,
    autoApprovedCount: latestResult.auto_approved_count,
    autoBlockedCount: latestResult.auto_blocked_count,
    retryCount: latestResult.retry_count,
    recovered: latestResult.recovered,
    resultPostRetryCount: latestResult.result_post_retry_count,
    executor: latestResult.executor,
    route: latestResult.route,
    prompt_type: latestResult.prompt_type,
    result_post: latestResult.result_post,
    execution_path: latestResult.execution_path,
    result_timestamp: latestResult.timestamp,
    result_record: latestResult,
  };
}

function readLatestWorkOrderResult(options = {}) {
  const resultLogPath = getResultLogPath(options);
  const approvalLogPath = options.workOrderApprovalLogPath
    || process.env[APPROVAL_LOG_PATH_ENV]
    || DEFAULT_APPROVAL_LOG_PATH;
  const records = readJsonlRecords(resultLogPath, Number(options.limit || 80));
  const approvalIdFilter = normalizeText(options.approvalId || options.workOrderId || options.approval_id || '');
  const targetRepoFilter = normalizeText(options.targetRepo || options.target_repo || HANDOFF_TARGET_REPO);
  const normalizedRecords = records
    .map(normalizeWorkOrderResultRecord)
    .filter((record) => record && (!approvalIdFilter || record.approval_id === approvalIdFilter) && (!targetRepoFilter || record.target_repo === targetRepoFilter))
    .sort((a, b) => String(a.timestamp || a.updated_at || '').localeCompare(String(b.timestamp || b.updated_at || '')));
  const latestRecorded = normalizedRecords.length ? normalizedRecords[normalizedRecords.length - 1] : null;
  const latestApproved = readLatestApprovedWorkOrder({
    workOrderApprovalLogPath: approvalLogPath,
    limit: Number(options.approvalLimit || 200),
    targetRepo: options.approvalTargetRepo || HANDOFF_TARGET_REPO,
  }).latestApprovedWorkOrder;
  const referenceWorkOrder = options.latestHandoffWorkOrder || latestApproved || null;
  const latestWorkOrderResult = latestRecorded || null;
  const latestHandoffWorkOrder = mergeWorkOrderResultIntoHandoff(referenceWorkOrder, latestWorkOrderResult);
  return {
    ok: true,
    resultLogPath,
    latestWorkOrderResult,
    latestHandoffWorkOrder,
    latestApprovedWorkOrder: latestApproved || null,
  };
}

function recordWorkOrderResult(input = {}, options = {}) {
  const resultLogPath = getResultLogPath(options);
  const latestApprovedWorkOrder = options.latestApprovedWorkOrder || null;
  const latestHandoffWorkOrder = options.latestHandoffWorkOrder || null;
  const sourceWorkOrder = input.work_order && typeof input.work_order === 'object'
    ? input.work_order
    : latestHandoffWorkOrder || latestApprovedWorkOrder || {};
  const approvalId = normalizeText(
    input.work_order_id
    || input.approval_id
    || sourceWorkOrder.approval_id
    || sourceWorkOrder.work_order_id
    || latestHandoffWorkOrder?.approval_id
    || latestApprovedWorkOrder?.approval_id
    || '',
  );
  if (!approvalId) throw new Error('work_order_id が必要です。');
  const sourceTargetRepo = normalizeText(sourceWorkOrder.target_repo || latestHandoffWorkOrder?.target_repo || latestApprovedWorkOrder?.target_repo || '');
  if (sourceTargetRepo !== HANDOFF_TARGET_REPO) throw new Error('target_repo は KOSAME Dev Orchestra のみです。');
  const sourceRoute = normalizeText(sourceWorkOrder.route || sourceWorkOrder.execution_route || latestHandoffWorkOrder?.route || latestApprovedWorkOrder?.route || 'zero-confirm');
  if (sourceRoute && sourceRoute !== 'zero-confirm') throw new Error('route は zero-confirm のみです。');
  if (latestApprovedWorkOrder && approvalId !== normalizeText(latestApprovedWorkOrder.approval_id || latestApprovedWorkOrder.work_order_id || '')) {
    throw new Error('work_order_id が承認済みの作業票と一致しません。');
  }
  if (latestHandoffWorkOrder && approvalId !== normalizeText(latestHandoffWorkOrder.approval_id || latestHandoffWorkOrder.work_order_id || '')) {
    throw new Error('work_order_id が handoff 中の作業票と一致しません。');
  }

  const safeFields = buildSafeResultText(input);
  const now = new Date().toISOString();
  const record = {
    result_id: crypto.randomUUID(),
    timestamp: now,
    updated_at: now,
    approval_id: approvalId,
    work_order_id: approvalId,
    handoff_id: normalizeText(sourceWorkOrder.handoff_id || latestHandoffWorkOrder?.handoff_id || approvalId),
    title: truncate(sourceWorkOrder.title || latestApprovedWorkOrder?.title || '作業票', 120),
    target_repo: sourceTargetRepo,
    assigned_agent: truncate(sourceWorkOrder.assigned_agent || sourceWorkOrder.agent || latestApprovedWorkOrder?.agent || 'Codex', 60),
    recommended_agent: truncate(sourceWorkOrder.recommended_agent || latestApprovedWorkOrder?.agent || sourceWorkOrder.agent || 'Codex', 60),
    risk_level: truncate(sourceWorkOrder.risk_level || latestApprovedWorkOrder?.risk_level || 'low', 24),
    human_gate_required: sourceWorkOrder.human_gate_required !== false
      && latestApprovedWorkOrder?.requires_human_confirmation !== false,
    executor: truncate(sourceWorkOrder.executor || sourceWorkOrder.assigned_agent || sourceWorkOrder.agent || latestApprovedWorkOrder?.agent || 'Codex', 60),
    route: truncate(sourceRoute || 'zero-confirm', 40),
    ...safeFields,
    yes_count: safeFields.yes_count,
    copy_count: safeFields.copy_count,
    human_wait: safeFields.human_wait,
    approval_request_count: safeFields.approval_request_count,
    manual_paste_count: safeFields.manual_paste_count,
    wait_request_count: safeFields.wait_request_count,
    auto_approved_count: safeFields.auto_approved_count,
    auto_blocked_count: safeFields.auto_blocked_count,
    retry_count: safeFields.retry_count,
    recovered: safeFields.recovered,
    result_post_retry_count: safeFields.result_post_retry_count,
    prompt_type: safeFields.prompt_type,
    result_post: safeFields.result_post,
    execution_path: safeFields.execution_path,
    source: truncate(input.source || sourceWorkOrder.source || 'kosame-console', 40),
  };

  fs.mkdirSync(path.dirname(resultLogPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(resultLogPath, `${JSON.stringify(record)}\n`, 'utf8');

  return {
    ok: true,
    resultLogPath,
    latestWorkOrderResult: normalizeWorkOrderResultRecord(record),
  };
}

module.exports = {
  DEFAULT_RESULT_LOG_PATH,
  RESULT_LOG_PATH_ENV,
  buildNextRecommendedAction,
  getResultLogPath,
  mergeWorkOrderResultIntoHandoff,
  normalizeOutcome,
  normalizeResultStatus,
  normalizeWorkOrderResultRecord,
  normalizeChangedFiles,
  readWorkOrderResultHistory,
  readLatestWorkOrderResult,
  recordWorkOrderResult,
};
