#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_SHELL_ACTIVITY_LOG_PATH = path.join(os.homedir(), '.kosame', 'shell-agent-activity.jsonl');
const SHELL_ACTIVITY_LOG_PATH_ENV = 'KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH';
const DEFAULT_LIMIT = 8;
const ALLOWED_STATUSES = new Set(['queued', 'running', 'editing', 'verifying', 'success', 'failed', 'human_gate', 'blocked', 'waiting']);
const DANGEROUS_PATTERNS = [
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
const CLI_USAGE = `Usage:
  node tools/kosame-shell-agent-activity.js append --agent Codex --project "KOSAME Dev Orchestra" --status running --task "..." --message "..."

Options:
  --log-path <path>   Override the activity JSONL file path
  --agent <name>
  --project <name>
  --status <status>
  --task <text>
  --message <text>`;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactText(value, maxLength = 160) {
  const text = normalizeText(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function hasDangerousActivityText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
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

function ensureSafeActivityField(fieldName, value, options = {}) {
  const raw = normalizeText(value);
  const fallback = normalizeText(options.fallback || '');
  const maxLength = Number.isFinite(options.maxLength) && options.maxLength > 0 ? options.maxLength : 160;
  const safeValue = compactText(raw || fallback, maxLength);
  if (safeValue && hasDangerousActivityText(safeValue)) {
    throw new Error(`Blocked dangerous shell activity ${fieldName}`);
  }
  return safeValue;
}

function normalizeActivityStatus(value) {
  const status = normalizeText(value).toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`Invalid shell activity status: ${status || '(empty)'}`);
  }
  return status;
}

function appendShellAgentActivityEvent(input = {}) {
  const logPath = path.resolve(String(
    input.shellAgentActivityLogPath
    || process.env[SHELL_ACTIVITY_LOG_PATH_ENV]
    || DEFAULT_SHELL_ACTIVITY_LOG_PATH,
  ));
  const event = {
    timestamp: new Date().toISOString(),
    agent: ensureSafeActivityField('agent', input.agent, { fallback: 'Shell', maxLength: 80 }) || 'Shell',
    project: ensureSafeActivityField('project', input.project, { maxLength: 120 }),
    status: normalizeActivityStatus(input.status),
    task: ensureSafeActivityField('task', input.task, { maxLength: 120 }),
    message: ensureSafeActivityField('message', input.message, { maxLength: 240 }),
  };

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(event)}\n`, 'utf8');
  return {
    ok: true,
    logPath,
    event,
  };
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
  const logPath = path.resolve(String(
    options.shellAgentActivityLogPath
    || process.env[SHELL_ACTIVITY_LOG_PATH_ENV]
    || DEFAULT_SHELL_ACTIVITY_LOG_PATH,
  ));
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

function parseAppendArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const input = {};
  const extras = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      input.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      let key = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
      let value = eqIndex >= 0 ? arg.slice(eqIndex + 1) : args[i + 1];
      if (eqIndex < 0) i += 1;
      key = key.trim();
      if (!key) {
        extras.push(arg);
        continue;
      }
      switch (key) {
        case 'agent':
        case 'project':
        case 'status':
        case 'task':
        case 'message':
        case 'log-path':
        case 'path':
          input[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value === undefined ? '' : String(value);
          break;
        default:
          extras.push(arg);
          if (eqIndex < 0 && value !== undefined) {
            extras.push(String(value));
          }
          break;
      }
      continue;
    }
    extras.push(arg);
  }

  input._extras = extras;
  return input;
}

function printCliUsage() {
  process.stdout.write(`${CLI_USAGE}\n`);
}

function runCli(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const command = normalizeText(args.shift());
  const parsed = parseAppendArgs(args);
  if (parsed.help) {
    printCliUsage();
    return { ok: true, help: true };
  }
  if (command !== 'append') {
    throw new Error(`Unsupported command: ${command || '(empty)'}`);
  }
  if (Array.isArray(parsed._extras) && parsed._extras.length > 0) {
    throw new Error(`Unsupported arguments: ${parsed._extras.join(' ')}`);
  }

  const result = appendShellAgentActivityEvent({
    shellAgentActivityLogPath: parsed.logPath || parsed.path,
    agent: parsed.agent,
    project: parsed.project,
    status: parsed.status,
    task: parsed.task,
    message: parsed.message,
  });
  process.stdout.write(`${JSON.stringify(result.event)}\n`);
  return result;
}

module.exports = {
  DEFAULT_SHELL_ACTIVITY_LOG_PATH,
  ALLOWED_STATUSES,
  appendShellAgentActivityEvent,
  compactText,
  ensureSafeActivityField,
  normalizeShellActivityRecord,
  normalizeShellActivityStatus,
  normalizeActivityStatus,
  hasDangerousActivityText,
  readJsonlRecords,
  readShellAgentActivity,
  runCli,
  parseAppendArgs,
  summarizeShellActivity,
};

if (require.main === module) {
  try {
    const [, , command = '', ...argv] = process.argv;
    runCli([command, ...argv]);
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    console.error(CLI_USAGE);
    process.exitCode = 1;
  }
}
