#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_SHELL_ACTIVITY_LOG_PATH = path.join(os.homedir(), '.kosame', 'shell-agent-activity.jsonl');
const DEFAULT_LIMIT = 8;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonlRecords(filePath, limit = DEFAULT_LIMIT) {
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
        // skip malformed shell activity rows
      }
    }
    return records;
  } catch {
    return [];
  }
}

function normalizeShellActivityStatus(record) {
  const raw = normalizeText(record && (record.status || record.state || record.eventType || record.kind));
  const lower = raw.toLowerCase();
  if (['queued', 'running', 'editing', 'verifying', 'success', 'failed', 'human_gate', 'blocked', 'waiting'].includes(lower)) {
    return lower;
  }
  if (lower.includes('verify_pass') || lower.includes('verify-pass') || lower.includes('passed')) return 'success';
  if (lower.includes('verify') || lower.includes('review')) return 'verifying';
  if (lower.includes('task_started') || lower.includes('agent_started') || lower.includes('running')) return 'running';
  if (lower.includes('edit')) return 'editing';
  if (lower.includes('human_gate') || lower.includes('approval')) return 'human_gate';
  if (lower.includes('fail') || lower.includes('error')) return 'failed';
  if (lower.includes('block')) return 'blocked';
  if (lower.includes('queue') || lower.includes('pending') || lower.includes('wait')) return 'waiting';
  return 'running';
}

function statusLabel(status) {
  return {
    queued: '待機中',
    waiting: '待機中',
    running: '実装中',
    editing: '編集中',
    verifying: 'verify中',
    success: 'PASS',
    failed: '失敗',
    human_gate: '確認待ち',
    blocked: '停止中',
  }[status] || '実装中';
}

function severityForStatus(status) {
  return {
    queued: 'waiting',
    waiting: 'waiting',
    running: 'running',
    editing: 'running',
    verifying: 'running',
    success: 'done',
    failed: 'error',
    human_gate: 'human_gate',
    blocked: 'blocked',
  }[status] || 'running';
}

function normalizeShellActivityRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const timestamp = normalizeText(record.timestamp || record.createdAt || record.updatedAt || record.time || '');
  const agent = normalizeText(record.agent || record.provider || record.actor || record.worker || record.name || 'Shell');
  const project = normalizeText(record.project || record.repo || record.repoName || record.targetRepo || '');
  const task = normalizeText(record.task || record.taskId || record.title || '');
  const message = normalizeText(record.message || record.summary || record.note || record.text || '');
  const status = normalizeShellActivityStatus(record);
  const label = statusLabel(status);
  const severity = severityForStatus(status);
  const text = [agent ? `${agent}：${label}` : label, message].filter(Boolean).join(message ? ' / ' : '');
  return {
    timestamp,
    agent,
    project,
    task,
    message,
    status,
    label,
    text: text || `${agent || 'Shell'}：${label}`,
    severity,
    source: normalizeText(record.source || record.tool || ''),
  };
}

function readShellAgentActivity(options = {}) {
  const logPath = options.shellAgentActivityLogPath
    ? path.resolve(String(options.shellAgentActivityLogPath))
    : DEFAULT_SHELL_ACTIVITY_LOG_PATH;
  const limit = Number(options.shellAgentActivityLimit || DEFAULT_LIMIT);
  const records = readJsonlRecords(logPath, Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT);
  const items = records
    .map(normalizeShellActivityRecord)
    .filter(Boolean)
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
    .slice(-DEFAULT_LIMIT)
    .reverse();
  const counts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    status: items.length ? 'ok' : 'missing',
    logPath,
    totalCount: items.length,
    lastUpdatedAt: items[0] ? items[0].timestamp || '' : '',
    items,
    counts,
    warnings: [],
  };
}

function summarizeShellActivity(shellActivity) {
  const activity = shellActivity && typeof shellActivity === 'object' ? shellActivity : {};
  const items = Array.isArray(activity.items) ? activity.items : [];
  const counts = activity.counts || {};
  const countText = [
    `queued=${counts.queued || 0}`,
    `running=${counts.running || 0}`,
    `editing=${counts.editing || 0}`,
    `verifying=${counts.verifying || 0}`,
    `success=${counts.success || 0}`,
    `failed=${counts.failed || 0}`,
    `human_gate=${counts.human_gate || 0}`,
    `blocked=${counts.blocked || 0}`,
    `waiting=${counts.waiting || 0}`,
  ].join(' / ');
  const itemText = items.slice(0, 5).map((item) => {
    const agent = normalizeText(item.agent || 'Shell');
    const label = normalizeText(item.label || statusLabel(item.status || 'running'));
    const message = normalizeText(item.message || '');
    return `${agent}:${label}${message ? `:${message}` : ''}`;
  }).filter(Boolean);
  return itemText.length ? `${countText}; items=[${itemText.join(' | ')}]` : countText;
}

module.exports = {
  DEFAULT_SHELL_ACTIVITY_LOG_PATH,
  normalizeShellActivityRecord,
  normalizeShellActivityStatus,
  readJsonlRecords,
  readShellAgentActivity,
  summarizeShellActivity,
};
