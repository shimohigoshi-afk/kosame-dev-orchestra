'use strict';

const { appendShellAgentActivityEvent } = require('./kosame-shell-agent-activity');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clamp(text, maxLength = 220) {
  const value = normalizeText(text);
  if (!value) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0 || value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function listify(value, maxItems = 8) {
  const source = Array.isArray(value)
    ? value
    : normalizeText(value)
      ? String(value).split(/[\r\n,|]+/)
      : [];
  return source
    .map((item) => clamp(item, 80))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeStageStatus(value, fallback = 'running') {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (['running', 'success', 'failed', 'blocked', 'human_gate', 'waiting', 'editing', 'verifying', 'review_ready', 'needs_attention', 'revision_needed'].includes(text)) {
    return text;
  }
  if (text.includes('success') || text.includes('done') || text.includes('pass')) return 'success';
  if (text.includes('blocked') || text.includes('stop')) return 'blocked';
  if (text.includes('fail') || text.includes('error')) return 'failed';
  if (text.includes('gate')) return 'human_gate';
  if (text.includes('wait')) return 'waiting';
  return fallback;
}

function formatPipelineStageEvent(event = {}) {
  const parts = [
    `stage=${normalizeText(event.stage) || 'unknown'}`,
    `status=${normalizeStageStatus(event.status)}`,
  ];
  if (event.errorStage) parts.push(`errorStage=${normalizeText(event.errorStage)}`);
  if (event.errorCode) parts.push(`errorCode=${normalizeText(event.errorCode)}`);
  if (event.errorMessage) parts.push(`errorMessage=${clamp(event.errorMessage, 180)}`);
  if (event.workOrderId) parts.push(`workOrderId=${normalizeText(event.workOrderId)}`);
  const attachmentCount = Number.isFinite(Number(event.attachmentCount)) ? Number(event.attachmentCount) : null;
  if (attachmentCount !== null) parts.push(`attachmentCount=${attachmentCount}`);
  const attachmentIds = listify(event.attachmentIds, 6);
  if (attachmentIds.length) parts.push(`attachmentIds=${attachmentIds.join('|')}`);
  if (event.manifestPath) parts.push(`manifestPath=${normalizeText(event.manifestPath)}`);
  if (event.route) parts.push(`route=${normalizeText(event.route)}`);
  if (event.timestamp) parts.push(`timestamp=${normalizeText(event.timestamp)}`);
  if (event.message) parts.push(`message=${clamp(event.message, 220)}`);
  return parts.join(' / ');
}

function appendPipelineStageEvent(event = {}, options = {}) {
  const stageEvent = {
    timestamp: normalizeText(event.timestamp) || new Date().toISOString(),
    stage: normalizeText(event.stage) || 'pipeline.unknown',
    status: normalizeStageStatus(event.status),
    errorStage: normalizeText(event.errorStage),
    errorCode: normalizeText(event.errorCode),
    errorMessage: clamp(event.errorMessage, 220),
    workOrderId: normalizeText(event.workOrderId),
    attachmentCount: Number.isFinite(Number(event.attachmentCount)) ? Number(event.attachmentCount) : 0,
    attachmentIds: listify(event.attachmentIds, 8),
    manifestPath: normalizeText(event.manifestPath),
    route: normalizeText(event.route),
    message: clamp(event.message, 220),
  };
  const project = normalizeText(options.project || event.project || 'KOSAME Dev Orchestra') || 'KOSAME Dev Orchestra';
  const agent = normalizeText(options.agent || event.agent || 'KOSAME') || 'KOSAME';
  const task = normalizeText(options.task || event.task || `pipeline:${stageEvent.stage}`) || `pipeline:${stageEvent.stage}`;
  const formatted = formatPipelineStageEvent(stageEvent);

  try {
    appendShellAgentActivityEvent({
      shellAgentActivityLogPath: options.shellAgentActivityLogPath,
      agent,
      project,
      status: stageEvent.status,
      task,
      message: formatted,
    });
  } catch {
    // best-effort telemetry
  }

  try {
    process.stderr.write(`[pipeline] ${formatted}\n`);
  } catch {
    // best-effort telemetry
  }

  return stageEvent;
}

function createPipelineError(input = {}) {
  const stage = normalizeText(input.errorStage || input.stage || 'pipeline.unknown');
  const message = clamp(input.errorMessage || input.message || 'pipeline failed', 220);
  const code = normalizeText(input.errorCode) || (
    /forbidden/i.test(message) ? 'HANDOFF_FORBIDDEN'
      : /no spec content/i.test(message) ? 'SPEC_CONTENT_MISSING'
        : /no tasks/i.test(message) ? 'SPEC_DECOMPOSE_FAILED'
          : /save/i.test(message) ? 'HANDOFF_SAVE_FAILED'
            : /dispatch/i.test(message) ? 'RUNNER_DISPATCH_FAILED'
              : 'PIPELINE_FAILED'
  );
  return {
    ok: false,
    error: message,
    errorStage: stage,
    errorCode: code,
    errorMessage: message,
    workOrderId: normalizeText(input.workOrderId || input.work_order_id || ''),
    attachmentCount: Number.isFinite(Number(input.attachmentCount)) ? Number(input.attachmentCount) : 0,
    attachmentIds: listify(input.attachmentIds, 8),
    manifestPath: normalizeText(input.manifestPath || input.attachmentManifestPath || ''),
    route: normalizeText(input.route || 'spec-to-tasks'),
    timestamp: normalizeText(input.timestamp) || new Date().toISOString(),
    stageHistory: Array.isArray(input.stageHistory) ? input.stageHistory : [],
    details: input.details && typeof input.details === 'object' ? input.details : {},
  };
}

function summarizePipelineStageHistory(stageHistory = []) {
  return Array.isArray(stageHistory)
    ? stageHistory.map((stage) => formatPipelineStageEvent(stage)).filter(Boolean)
    : [];
}

module.exports = {
  appendPipelineStageEvent,
  createPipelineError,
  formatPipelineStageEvent,
  normalizeStageStatus,
  summarizePipelineStageHistory,
};
