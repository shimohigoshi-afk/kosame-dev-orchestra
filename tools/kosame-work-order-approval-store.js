#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_APPROVAL_LOG_PATH = path.join(os.homedir(), '.kosame', 'work-orders.jsonl');
const APPROVAL_LOG_PATH_ENV = 'KOSAME_WORK_ORDER_APPROVAL_LOG_PATH';
const MAX_PROMPT_LENGTH = 12000;
const MAX_TEXT_LENGTH = 220;
const ALLOWED_TARGET_REPOS = new Set([
  '/home/lavie/repos/transcriber',
  '/home/lavie/kosame-dev-orchestra',
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
  const prompt = normalizeText(workOrder.prompt);
  const requiresHumanConfirmation = workOrder.requires_human_confirmation !== false;

  if (!title) throw new Error('title が必要です。');
  if (!agent) throw new Error('agent が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) throw new Error('target_repo が不明です。');
  if (!prompt) throw new Error('prompt が必要です。');
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error('prompt が長すぎます。');

  const promptForSecretCheck = prompt
    .split(/\r?\n/)
    .filter((line) => !PROMPT_SAFE_LINES.some((pattern) => pattern.test(line)))
    .join('\n');
  const rawText = [title, agent, targetRepo, riskLevel, promptForSecretCheck].join('\n');
  if (hasSecretLikeText(rawText)) {
    throw new Error('secret っぽい内容は保存できません。');
  }

  return {
    title,
    agent,
    target_repo: targetRepo,
    risk_level: riskLevel,
    prompt,
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
    requires_human_confirmation: true,
    source: truncate(record.source || 'kosame-console', 40),
  };
}

function readLatestApprovedWorkOrder(options = {}) {
  const approvalLogPath = getApprovalLogPath(options);
  const records = readJsonlRecords(approvalLogPath, Number(options.limit || 200));
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeApprovedWorkOrder(records[index]);
    if (normalized) {
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
