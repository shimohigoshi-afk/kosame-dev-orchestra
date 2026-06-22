#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  buildAttachmentManifest,
  buildSafeHandoffAttachmentSummary,
  lintHandoffTextOnly,
  sanitizeAttachmentForHandoff,
  stripBase64Payloads,
} = require('./kosame-attachment-store');
const { appendPipelineStageEvent } = require('./kosame-pipeline-telemetry');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HANDOFF_DIR = path.join(ROOT, '.kosame-handoff');
const DEFAULT_PORT = 18345;
const DEFAULT_HOST = '127.0.0.1';
const HANDOFF_TARGET_REPO = '/home/lavie/kosame-dev-orchestra';
const ALLOWED_TARGET_REPOS = new Set([
  HANDOFF_TARGET_REPO,
  '/home/lavie/repos/kosame-sales-dx',
]);
const QUEUE_FILENAME = 'queue.jsonl';
const LATEST_FILENAME = 'latest.md';
const MAX_TEXT_LENGTH = 6000;
const MAX_LINE_LENGTH = 600;
const SAFE_PROMPT_ALLOWLIST = [
  /読まない/,
  /保存しない/,
  /表示しない/,
  /禁止/,
  /しない/,
];
const FORBIDDEN_TEXT_PATTERNS = [
  /\.env\b/i,
  /\bAPI[_-]?KEY\b/i,
  /\bSECRET\b/i,
  /\bTOKEN\b/i,
  /\bcredentials?\b/i,
  /\bprivate[_-]?key\b/i,
  /\/home\/lavie\/repos\/transcriber/i,
  /\brm\s+-rf\b/i,
  /\bcurl\b[^|]*\|\s*bash\b/i,
  /\bprintenv\b/i,
  /\bgcloud\s+auth\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+tag\b/i,
  /\bdeploy\b/i,
  /\btmux\b/i,
  /\bsend-keys\b/i,
  /\bpty\b/i,
  /\bxdotool\b/i,
  /\bSendKeys\b/i,
  /\bpowershell\b.*\bSendKeys\b/i,
  /\b(?:api[_-]?key|secret|token|private[_-]?key)\s*[:=]\s*[^ \n]{4,}/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i,
  /(?:\+?81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}|0\d{1,4}\d{6,8})/,
  /(?:policy\s*number|保険証券番号|証券番号)\s*[:=]?\s*[\d-]{6,}/i,
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = normalizeText(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeTextList(value, maxItems = 12, maxLength = 240) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];
  return source
    .map((item) => compactText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function maskHandoffText(value) {
  return compactText(value || '')
    .replace(/\bSecret\b/gi, '[secret]')
    .replace(/\.env\b/gi, '[env]')
    .replace(/\bcredentials?\b/gi, '[credentials]')
    .replace(/\btoken\b/gi, '[token]')
    .replace(/\bpassword\b/gi, '[password]')
    .replace(/\bauthorization\b/gi, '[authorization]')
    .replace(/\bbearer\b/gi, '[bearer]')
    .replace(/\bAPI[_-]?KEY\b/gi, 'API_KEY');
}

function isAllowedSafetyLine(line) {
  const value = normalizeText(line);
  if (!value) return false;
  return SAFE_PROMPT_ALLOWLIST.some((pattern) => pattern.test(value));
}

function hasForbiddenText(text) {
  const value = normalizeText(text);
  if (!value) return false;
  return FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizePromptText(promptText) {
  const strippedSource = stripBase64Payloads(promptText).text;
  const lines = normalizeText(strippedSource)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const sanitized = [];
  const redacted = [];
  for (const line of lines) {
    const compact = compactText(
      line
        .replace(/\bSecret\b/gi, '[secret]')
        .replace(/\.env\b/gi, '[env]')
        .replace(/\bcredentials?\b/gi, '[credentials]')
        .replace(/\btoken\b/gi, '[token]')
        .replace(/\bpassword\b/gi, '[password]')
        .replace(/\bauthorization\b/gi, '[authorization]')
        .replace(/\bbearer\b/gi, '[bearer]')
        .replace(/\bAPI[_-]?KEY\b/gi, 'API_KEY'),
      MAX_LINE_LENGTH,
    );
    if (!compact) continue;
    const hasForbidden = hasForbiddenText(compact);
    if (hasForbidden && !isAllowedSafetyLine(compact)) {
      redacted.push('[redacted unsafe line removed]');
      continue;
    }
    sanitized.push(compact);
  }
  return {
    promptText: sanitized.join('\n'),
    redactedCount: redacted.length,
  };
}

function getHandoffDir(options = {}) {
  return path.resolve(String(options.handoffDir || DEFAULT_HANDOFF_DIR));
}

function getQueuePath(options = {}) {
  return path.join(getHandoffDir(options), QUEUE_FILENAME);
}

function getLatestPath(options = {}) {
  return path.join(getHandoffDir(options), LATEST_FILENAME);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

function readJsonlRecords(filePath, limit = 200) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-(Number.isFinite(limit) && limit > 0 ? limit : 200))
      .map((line) => {
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

function sanitizeHandoffPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const workOrder = source.work_order && typeof source.work_order === 'object'
    ? source.work_order
    : source.latestApprovedWorkOrder && typeof source.latestApprovedWorkOrder === 'object'
      ? source.latestApprovedWorkOrder
      : source.approval && typeof source.approval === 'object'
        ? source.approval
        : source;
  const id = compactText(
    source.id
    || source.work_order_id
    || source.approval_id
    || source.handoff_id
    || workOrder.id
    || workOrder.work_order_id
    || workOrder.approval_id
    || workOrder.handoff_id
    || '',
    80,
  );
  const title = compactText(source.title || workOrder.title || '', 120);
  const targetRepo = compactText(source.target_repo || workOrder.target_repo || '', 160);
  const assignedAgent = compactText(source.assigned_agent || source.recommended_agent || source.agent || workOrder.assigned_agent || workOrder.recommended_agent || workOrder.agent || 'Codex', 80);
  const agent = assignedAgent;
  const riskLevel = compactText(source.risk_level || workOrder.risk_level || 'low', 24);
  const humanGateRequired = !!(source.human_gate_required ?? workOrder.human_gate_required);
  const createdAt = compactText(source.created_at || source.createdAt || workOrder.created_at || workOrder.createdAt || new Date().toISOString(), 40);
  const inputSource = compactText(source.source || workOrder.source || 'kosame_console', 40);
  const promptInput = source.body ?? source.prompt_text ?? source.prompt ?? source.safe_prompt_summary ?? workOrder.body ?? workOrder.prompt_text ?? workOrder.prompt ?? workOrder.safe_prompt_summary ?? '';
  const promptInfo = sanitizePromptText(promptInput);
  const originalRequest = compactText(
    stripBase64Payloads(source.original_request || source.originalRequest || workOrder.original_request || workOrder.originalRequest || '').text,
    MAX_TEXT_LENGTH,
  );
  const selectedProjectId = compactText(source.selected_project_id || source.selectedProjectId || workOrder.selected_project_id || workOrder.selectedProjectId || '', 60);
  const selectedProjectPath = compactText(source.selected_project_path || source.selectedProjectPath || workOrder.selected_project_path || workOrder.selectedProjectPath || '', 160);
  const selectedProjectLabel = compactText(source.selected_project_label || source.selectedProjectLabel || workOrder.selected_project_label || workOrder.selectedProjectLabel || '', 120);
  const rawAttachments = Array.isArray(source.attachments)
    ? source.attachments
    : Array.isArray(workOrder.attachments)
      ? workOrder.attachments
      : [];
  const attachments = rawAttachments
    .slice(0, 20)
    .map((attachment, index) => sanitizeAttachmentForHandoff(attachment, {
      workOrderId: id,
      createdAt,
      attachmentIndex: index + 1,
    }));
  const attachmentIds = attachments.map((att) => compactText(att.attachmentId || att.id || '', 120)).filter(Boolean);
  const attachmentSummary = buildSafeHandoffAttachmentSummary({
    workOrderId: id,
    attachments,
  });
  const strippedPrompt = lintHandoffTextOnly(promptInfo.promptText, attachments);
  const promptText = compactText(
    [strippedPrompt.text, attachmentSummary.length ? '## attachments' : '', ...attachmentSummary].filter(Boolean).join('\n'),
    MAX_TEXT_LENGTH,
  );
  const safetyConditions = normalizeTextList(source.safety_conditions || source.safetyConditions || workOrder.safety_conditions || workOrder.safetyConditions, 20, 240)
    .map((line) => maskHandoffText(line));
  const reportItems = normalizeTextList(source.report_items || source.reportItems || workOrder.report_items || workOrder.reportItems, 20, 240)
    .map((line) => maskHandoffText(line));
  const executionHost = compactText(source.execution_host || source.executionHost || workOrder.execution_host || workOrder.executionHost || '', 60);
  const executionSource = compactText(source.execution_source || source.executionSource || workOrder.execution_source || workOrder.executionSource || '', 60);
  const executionHostAllowed = source.execution_host_allowed ?? source.executionHostAllowed ?? workOrder.execution_host_allowed ?? workOrder.executionHostAllowed;
  const interactiveHostBlocked = source.interactive_host_blocked ?? source.interactiveHostBlocked ?? workOrder.interactive_host_blocked ?? workOrder.interactiveHostBlocked;
  const interactivePromptBlocked = source.interactive_prompt_blocked ?? source.interactivePromptBlocked ?? workOrder.interactive_prompt_blocked ?? workOrder.interactivePromptBlocked;
  const noYesGateRuntime = source.no_yes_gate_runtime ?? source.noYesGateRuntime ?? workOrder.no_yes_gate_runtime ?? workOrder.noYesGateRuntime;
  const safeSpawnActive = source.safe_spawn_active ?? source.safeSpawnActive ?? workOrder.safe_spawn_active ?? workOrder.safeSpawnActive;
  const manualCodeUiAllowed = source.manual_code_ui_allowed ?? source.manualCodeUiAllowed ?? workOrder.manual_code_ui_allowed ?? workOrder.manualCodeUiAllowed;
  const officialRoute = compactText(source.official_route || source.officialRoute || workOrder.official_route || workOrder.officialRoute || 'Console → Handoff → Runner', 80);
  const codexYesHellGuard = compactText(source.codex_yes_hell_guard || source.codexYesHellGuard || workOrder.codex_yes_hell_guard || workOrder.codexYesHellGuard || 'active', 32) || 'active';
  const codexAutoApproveMode = compactText(source.codex_auto_approve_mode || source.codexAutoApproveMode || workOrder.codex_auto_approve_mode || workOrder.codexAutoApproveMode || 'active', 32) || 'active';
  const userYesRequired = source.user_yes_required ?? source.userYesRequired ?? workOrder.user_yes_required ?? workOrder.userYesRequired;
  const safetyStopGuard = compactText(source.safety_stop_guard || source.safetyStopGuard || workOrder.safety_stop_guard || workOrder.safetyStopGuard || 'active', 32) || 'active';
  const promptType = compactText(source.prompt_type || source.promptType || workOrder.prompt_type || workOrder.promptType || '', 40);
  const promptOrigin = compactText(source.prompt_origin || source.promptOrigin || workOrder.prompt_origin || workOrder.promptOrigin || '', 60);
  const blockedReason = compactText(source.blocked_reason || source.blockedReason || workOrder.blocked_reason || workOrder.blockedReason || '', 120);
  const userInputRequired = source.user_input_required ?? source.userInputRequired ?? workOrder.user_input_required ?? workOrder.userInputRequired;
  const target = source.target && typeof source.target === 'object'
    ? {
        id: compactText(source.target.id || source.target.projectId || selectedProjectId, 60),
        label: compactText(source.target.label || source.target.name || selectedProjectLabel, 120),
        path: compactText(source.target.path || source.target.repo || targetRepo, 160),
      }
    : {
        id: selectedProjectId,
        label: selectedProjectLabel,
        path: targetRepo,
      };

  if (!id) throw new Error('id が必要です。');
  if (!title) throw new Error('title が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) throw new Error('target_repo が不明です。');
  if (!assignedAgent) throw new Error('assigned_agent が必要です。');
  if (!promptText) throw new Error('prompt_text が必要です。');
  const promptGuardText = stripBase64Payloads(promptText).text
    .replace(/\s*##\s+attachments\b[\s\S]*$/i, '')
    .trim();
  const attachmentSummaryForGuard = attachmentSummary.filter((line) => !/storedPath:/i.test(line));
  const guardText = [
    title,
    originalRequest,
    ...safetyConditions,
    ...reportItems,
    ...attachmentSummaryForGuard,
    maskHandoffText(promptGuardText, MAX_TEXT_LENGTH),
  ]
    .filter((line) => !isAllowedSafetyLine(line))
    .join('\n');
  if (hasForbiddenText(guardText)) {
    throw new Error('保存対象に forbidden な文字列が含まれています。');
  }
  if (hasForbiddenText(promptGuardText)) {
    throw new Error('prompt_text に forbidden な文字列が含まれています。');
  }

  return {
    id,
    title,
    agent,
    target_repo: targetRepo,
    assigned_agent: assignedAgent,
    risk_level: riskLevel,
    human_gate_required: humanGateRequired,
    original_request: originalRequest,
    originalRequest,
    selected_project_id: selectedProjectId,
    selected_project_path: selectedProjectPath,
    selected_project_label: selectedProjectLabel,
    safety_conditions: safetyConditions,
    safetyConditions,
    report_items: reportItems,
    reportItems,
    execution_host: executionHost,
    executionHost,
    execution_source: executionSource,
    executionSource,
    execution_host_allowed: executionHostAllowed !== undefined ? !!executionHostAllowed : true,
    executionHostAllowed: executionHostAllowed !== undefined ? !!executionHostAllowed : true,
    interactive_host_blocked: !!interactiveHostBlocked,
    interactiveHostBlocked: !!interactiveHostBlocked,
    interactive_prompt_blocked: !!interactivePromptBlocked,
    interactivePromptBlocked: !!interactivePromptBlocked,
    no_yes_gate_runtime: noYesGateRuntime !== undefined ? !!noYesGateRuntime : true,
    noYesGateRuntime: noYesGateRuntime !== undefined ? !!noYesGateRuntime : true,
    safe_spawn_active: safeSpawnActive !== undefined ? !!safeSpawnActive : true,
    safeSpawnActive: safeSpawnActive !== undefined ? !!safeSpawnActive : true,
    manual_code_ui_allowed: !!manualCodeUiAllowed,
    manualCodeUiAllowed: !!manualCodeUiAllowed,
    official_route: officialRoute,
    officialRoute,
    codex_yes_hell_guard: codexYesHellGuard,
    codexYesHellGuard,
    codex_auto_approve_mode: codexAutoApproveMode,
    codexAutoApproveMode,
    user_yes_required: !!userYesRequired,
    userYesRequired: !!userYesRequired,
    safety_stop_guard: safetyStopGuard,
    safetyStopGuard,
    prompt_type: promptType,
    promptType,
    prompt_origin: promptOrigin,
    promptOrigin,
    blocked_reason: blockedReason,
    blockedReason,
    user_input_required: !!userInputRequired,
    userInputRequired: !!userInputRequired,
    body: promptText,
    prompt_text: promptText,
    created_at: createdAt,
    source: inputSource,
    target,
    attachments,
    attachment_count: attachments.length,
    attachmentCount: attachments.length,
    attachment_ids: attachmentIds,
    attachmentIds,
    attachment_manifest_path: compactText(source.attachment_manifest_path || source.attachmentManifestPath || workOrder.attachment_manifest_path || workOrder.attachmentManifestPath || '', 160),
    attachmentManifestPath: compactText(source.attachment_manifest_path || source.attachmentManifestPath || workOrder.attachment_manifest_path || workOrder.attachmentManifestPath || '', 160),
    attachment_dir: compactText(source.attachment_dir || source.attachmentDir || workOrder.attachment_dir || workOrder.attachmentDir || '', 160),
    attachmentDir: compactText(source.attachment_dir || source.attachmentDir || workOrder.attachment_dir || workOrder.attachmentDir || '', 160),
    has_image_attachments: attachments.some((att) => att.kind === 'image'),
    hasImageAttachments: attachments.some((att) => att.kind === 'image'),
    attachment_summary: attachmentSummary,
    attachmentSummary,
    redacted_count: promptInfo.redactedCount,
  };
}

function buildLatestMarkdown(entry) {
  const safe = sanitizeHandoffPayload(entry);
  const safetyConditions = Array.isArray(safe.safety_conditions) ? safe.safety_conditions : [];
  const reportItems = Array.isArray(safe.report_items) ? safe.report_items : [];
  const attachments = Array.isArray(safe.attachments) ? safe.attachments : [];
  return [
    '# Codex Handoff Inbox',
    '',
    `- id: ${safe.id}`,
    `- title: ${safe.title}`,
    `- target_repo: ${safe.target_repo}`,
    safe.agent ? `- agent: ${safe.agent}` : null,
    `- assigned_agent: ${safe.assigned_agent}`,
    `- risk_level: ${safe.risk_level}`,
    `- human_gate_required: ${safe.human_gate_required ? 'true' : 'false'}`,
    `- created_at: ${safe.created_at}`,
    `- source: ${safe.source}`,
    safe.originalRequest ? `- originalRequest: ${safe.originalRequest}` : null,
    safe.original_request ? `- original_request: ${safe.original_request}` : null,
    safe.selected_project_id ? `- selected_project_id: ${safe.selected_project_id}` : null,
    safe.selected_project_path ? `- selected_project_path: ${safe.selected_project_path}` : null,
    safe.selected_project_label ? `- selected_project_label: ${safe.selected_project_label}` : null,
    safe.target ? `- target_id: ${safe.target.id || ''}` : null,
    safe.target ? `- target_label: ${safe.target.label || ''}` : null,
    safe.target ? `- target_path: ${safe.target.path || ''}` : null,
    attachments.length ? `- attachment_count: ${attachments.length}` : null,
    Array.isArray(safe.attachment_ids) && safe.attachment_ids.length ? `- attachment_ids: ${safe.attachment_ids.join(', ')}` : null,
    safe.attachment_manifest_path ? `- attachment_manifest_path: ${safe.attachment_manifest_path}` : null,
    safe.attachment_dir ? `- attachment_dir: ${safe.attachment_dir}` : null,
    safe.redacted_count ? `- redacted_count: ${safe.redacted_count}` : null,
    '',
    safetyConditions.length ? '## safety_conditions' : null,
    safetyConditions.length ? '' : null,
    ...safetyConditions.map((line) => `- ${line}`),
    safetyConditions.length ? '' : null,
    reportItems.length ? '## report_items' : null,
    reportItems.length ? '' : null,
    ...reportItems.map((line) => `- ${line}`),
    reportItems.length ? '' : null,
    attachments.length ? '## attachments' : null,
    attachments.length ? '' : null,
    ...attachments.flatMap((att) => [
      `- attachmentId: ${att.attachmentId}`,
      `  - originalName: ${att.originalName}`,
      `  - displayName: ${att.displayName || att.originalName}`,
      `  - mimeType: ${att.mimeType}`,
      `  - size: ${att.size}`,
      `  - kind: ${att.kind}`,
      `  - storedPath: ${att.storedPath}`,
      `  - sha256: ${att.sha256}`,
    ]),
    attachments.length ? '' : null,
    '## prompt_text',
    '',
    '```text',
    safe.prompt_text,
    '```',
    '',
    '## execution_host',
    '',
    `- execution_host: ${safe.execution_host || '—'}`,
    `- execution_source: ${safe.execution_source || '—'}`,
    `- execution_host_allowed: ${safe.execution_host_allowed ? 'true' : 'false'}`,
    `- interactive_host_blocked: ${safe.interactive_host_blocked ? 'true' : 'false'}`,
    `- interactive_prompt_blocked: ${safe.interactive_prompt_blocked ? 'true' : 'false'}`,
    `- no_yes_gate_runtime: ${safe.no_yes_gate_runtime ? 'true' : 'false'}`,
    `- safe_spawn_active: ${safe.safe_spawn_active ? 'true' : 'false'}`,
    `- manual_code_ui_allowed: ${safe.manual_code_ui_allowed ? 'true' : 'false'}`,
    `- official_route: ${safe.official_route || 'Console → Handoff → Runner'}`,
    `- codex_yes_hell_guard: ${safe.codex_yes_hell_guard || 'active'}`,
    `- codex_auto_approve_mode: ${safe.codex_auto_approve_mode || 'active'}`,
    `- user_yes_required: ${safe.user_yes_required ? 'true' : 'false'}`,
    `- safety_stop_guard: ${safe.safety_stop_guard || 'active'}`,
    safe.prompt_type ? `- prompt_type: ${safe.prompt_type}` : null,
    safe.prompt_origin ? `- prompt_origin: ${safe.prompt_origin}` : null,
    safe.blocked_reason ? `- blocked_reason: ${safe.blocked_reason}` : null,
    `- user_input_required: ${safe.user_input_required ? 'true' : 'false'}`,
    '',
    '> KOSAME Console Handoff — official route で Runner Queue / Runner watcher に自動ディスパッチされます。',
  ].filter((line) => line != null).join('\n');
}

function saveHandoffInbox(payload = {}, options = {}) {
  const handoffDir = getHandoffDir(options);
  const queuePath = getQueuePath({ handoffDir });
  const latestPath = getLatestPath({ handoffDir });
  const now = new Date().toISOString();
  const safe = sanitizeHandoffPayload(payload);
  const rawAttachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(payload.work_order && payload.work_order.attachments)
      ? payload.work_order.attachments
      : Array.isArray(payload.latestApprovedWorkOrder && payload.latestApprovedWorkOrder.attachments)
        ? payload.latestApprovedWorkOrder.attachments
        : [];
  const attachmentManifest = rawAttachments.length
    ? buildAttachmentManifest(
        safe.id || safe.work_order_id || safe.approval_id || `work-order-${Date.now()}`,
        rawAttachments,
        {
          workOrderId: safe.id || safe.work_order_id || safe.approval_id || '',
          attachmentDir: path.join(handoffDir, 'attachments', String(safe.id || safe.work_order_id || safe.approval_id || 'work-order').replace(/[^\w.-]+/g, '_')),
          createdAt: now,
        },
      )
    : null;
  if (attachmentManifest) {
    appendPipelineStageEvent({
      stage: 'attachments.manifest.saved',
      status: 'success',
      workOrderId: safe.id || safe.work_order_id || safe.approval_id || '',
      attachmentCount: attachmentManifest.attachments.length,
      attachmentIds: attachmentManifest.attachments.map((att) => att.attachmentId),
      manifestPath: attachmentManifest.manifestPath,
      route: 'handoff',
      timestamp: now,
      message: `attachment manifest saved at ${attachmentManifest.manifestPath}`,
    }, { agent: 'Runner', task: 'attachments.manifest.saved' });
  }
  const record = {
    ...safe,
    saved_at: now,
    created_at: safe.created_at || now,
    source: 'kosame_console',
  };
  if (attachmentManifest) {
    record.attachment_manifest_path = attachmentManifest.manifestPath;
    record.attachmentManifestPath = attachmentManifest.manifestPath;
    record.attachment_dir = attachmentManifest.attachmentDir;
    record.attachmentDir = attachmentManifest.attachmentDir;
    record.attachment_ids = attachmentManifest.attachments.map((att) => att.attachmentId);
    record.attachmentIds = record.attachment_ids;
    record.attachments = attachmentManifest.attachments;
    record.attachment_count = attachmentManifest.attachments.length;
    record.attachmentCount = attachmentManifest.attachments.length;
    record.attachment_summary = buildSafeHandoffAttachmentSummary(attachmentManifest);
    record.attachmentSummary = record.attachment_summary;
  }
  record.execution_host = safe.execution_host || safe.executionHost || '';
  record.executionHost = record.execution_host;
  record.execution_source = safe.execution_source || safe.executionSource || '';
  record.executionSource = record.execution_source;
  record.execution_host_allowed = safe.execution_host_allowed !== undefined ? !!safe.execution_host_allowed : true;
  record.executionHostAllowed = record.execution_host_allowed;
  record.interactive_host_blocked = !!safe.interactive_host_blocked;
  record.interactiveHostBlocked = record.interactive_host_blocked;
  record.interactive_prompt_blocked = !!safe.interactive_prompt_blocked;
  record.interactivePromptBlocked = record.interactive_prompt_blocked;
  record.no_yes_gate_runtime = safe.no_yes_gate_runtime !== undefined ? !!safe.no_yes_gate_runtime : true;
  record.noYesGateRuntime = record.no_yes_gate_runtime;
  record.safe_spawn_active = !!safe.safe_spawn_active;
  record.safeSpawnActive = record.safe_spawn_active;
  record.manual_code_ui_allowed = !!safe.manual_code_ui_allowed;
  record.manualCodeUiAllowed = record.manual_code_ui_allowed;
  record.official_route = safe.official_route || safe.officialRoute || 'Console → Handoff → Runner';
  record.officialRoute = record.official_route;
  record.codex_yes_hell_guard = safe.codex_yes_hell_guard || safe.codexYesHellGuard || 'active';
  record.codexYesHellGuard = record.codex_yes_hell_guard;
  record.codex_auto_approve_mode = safe.codex_auto_approve_mode || safe.codexAutoApproveMode || 'active';
  record.codexAutoApproveMode = record.codex_auto_approve_mode;
  record.user_yes_required = !!safe.user_yes_required;
  record.userYesRequired = record.user_yes_required;
  record.safety_stop_guard = safe.safety_stop_guard || safe.safetyStopGuard || 'active';
  record.safetyStopGuard = record.safety_stop_guard;
  record.prompt_type = safe.prompt_type || safe.promptType || '';
  record.promptType = record.prompt_type;
  record.prompt_origin = safe.prompt_origin || safe.promptOrigin || '';
  record.promptOrigin = record.prompt_origin;
  record.blocked_reason = safe.blocked_reason || safe.blockedReason || '';
  record.blockedReason = record.blocked_reason;
  record.user_input_required = !!safe.user_input_required;
  record.userInputRequired = record.user_input_required;
  ensureDir(handoffDir);
  fs.appendFileSync(queuePath, `${JSON.stringify(record)}\n`, 'utf8');
  fs.writeFileSync(latestPath, buildLatestMarkdown(record), 'utf8');
  return {
    ok: true,
    handoffDir,
    latestPath,
    queuePath,
    saved_at: now,
    latestHandoff: record,
    attachmentManifestPath: record.attachment_manifest_path || '',
    attachmentIds: Array.isArray(record.attachment_ids) ? record.attachment_ids : [],
  };
}

function readHandoffQueue(options = {}) {
  const handoffDir = getHandoffDir(options);
  const queuePath = getQueuePath({ handoffDir });
  const records = readJsonlRecords(queuePath, Number(options.limit || 200));
  const items = [];
  for (const record of records) {
    try {
      const safe = sanitizeHandoffPayload(record);
      items.push({
        ...safe,
        saved_at: compactText(record.saved_at || record.created_at || '', 40),
      });
    } catch {
      throw new Error('secret っぽい内容が含まれているため表示できません。');
    }
  }
  return {
    ok: true,
    handoffDir,
    queuePath,
    latestPath: getLatestPath({ handoffDir }),
    count: items.length,
    items,
  };
}

function readLatestHandoffInbox(options = {}) {
  const queue = readHandoffQueue(options);
  const latest = queue.items.length ? queue.items[queue.items.length - 1] : null;
  return {
    ok: true,
    handoffDir: queue.handoffDir,
    queuePath: queue.queuePath,
    latestPath: queue.latestPath,
    latest,
    count: queue.count,
  };
}

function parseJsonBody(req, callback) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      parsed = {};
    }
    callback(parsed);
  });
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function createCodexHandoffBridgeServer(options = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/api/handoff' && req.method === 'GET') {
      try {
        const result = readLatestHandoffInbox(options);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'cannot read handoff inbox' }));
      }
      return;
    }

    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      parseJsonBody(req, (parsed) => {
        try {
          const result = saveHandoffInbox(parsed, options);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({
            ok: true,
            handoffDir: result.handoffDir,
            saved_at: result.saved_at,
            latestHandoff: result.latestHandoff,
            latestPath: result.latestPath,
            queuePath: result.queuePath,
            message: 'Inboxに保存しました。Runner Queue が official route で自動実行します。',
          }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : 'invalid handoff payload' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
  });

  return { server };
}

function parseArgValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index >= 0 && index < argv.length - 1) return argv[index + 1];
  return fallback;
}

function runCli() {
  const argv = process.argv.slice(2);
  const port = Number(parseArgValue(argv, '--port', process.env.KOSAME_CODEX_HANDOFF_BRIDGE_PORT || DEFAULT_PORT));
  const host = DEFAULT_HOST;
  const { server } = createCodexHandoffBridgeServer({
    handoffDir: parseArgValue(argv, '--dir', DEFAULT_HANDOFF_DIR),
  });
  server.listen(port, host, () => {
    process.stdout.write(`Codex Handoff Bridge listening on http://${host}:${port}\n`);
  });
}

if (require.main === module) {
  runCli();
}

module.exports = {
  DEFAULT_HANDOFF_DIR,
  HANDOFF_TARGET_REPO,
  LATEST_FILENAME,
  QUEUE_FILENAME,
  buildLatestMarkdown,
  createCodexHandoffBridgeServer,
  getHandoffDir,
  getLatestPath,
  getQueuePath,
  hasForbiddenText,
  readHandoffQueue,
  readLatestHandoffInbox,
  sanitizeHandoffPayload,
  sanitizePromptText,
  saveHandoffInbox,
};
