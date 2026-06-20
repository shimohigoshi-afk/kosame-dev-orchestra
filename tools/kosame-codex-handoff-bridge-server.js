#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

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
    .replace(/\.env\b/gi, '[env]')
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
  const lines = normalizeText(promptText)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const sanitized = [];
  const redacted = [];
  for (const line of lines) {
    const compact = compactText(
      line
        .replace(/\.env\b/gi, '[env]')
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
  const id = compactText(source.id || source.work_order_id || source.approval_id || source.handoff_id || '', 80);
  const title = compactText(source.title || '', 120);
  const targetRepo = compactText(source.target_repo || '', 160);
  const assignedAgent = compactText(source.assigned_agent || source.recommended_agent || source.agent || 'Codex', 80);
  const riskLevel = compactText(source.risk_level || 'low', 24);
  const humanGateRequired = !!source.human_gate_required;
  const createdAt = compactText(source.created_at || source.createdAt || new Date().toISOString(), 40);
  const inputSource = compactText(source.source || 'kosame_console', 40);
  const promptInput = source.body ?? source.prompt_text ?? source.prompt ?? source.safe_prompt_summary ?? '';
  const promptInfo = sanitizePromptText(promptInput);
  const promptText = compactText(promptInfo.promptText, MAX_TEXT_LENGTH);
  const originalRequest = compactText(source.original_request || source.originalRequest || '', MAX_TEXT_LENGTH);
  const selectedProjectId = compactText(source.selected_project_id || source.selectedProjectId || '', 60);
  const selectedProjectPath = compactText(source.selected_project_path || source.selectedProjectPath || '', 160);
  const selectedProjectLabel = compactText(source.selected_project_label || source.selectedProjectLabel || '', 120);
  const safetyConditions = normalizeTextList(source.safety_conditions || source.safetyConditions, 20, 240)
    .map((line) => maskHandoffText(line));
  const reportItems = normalizeTextList(source.report_items || source.reportItems, 20, 240)
    .map((line) => maskHandoffText(line));

  if (!id) throw new Error('id が必要です。');
  if (!title) throw new Error('title が必要です。');
  if (!targetRepo) throw new Error('target_repo が必要です。');
  if (!ALLOWED_TARGET_REPOS.has(targetRepo)) throw new Error('target_repo が不明です。');
  if (!assignedAgent) throw new Error('assigned_agent が必要です。');
  if (!promptText) throw new Error('prompt_text が必要です。');
  const promptGuardText = promptText
    .split(/\r?\n/)
    .filter((line) => !isAllowedSafetyLine(line))
    .join('\n');
  const guardText = [
    id,
    targetRepo,
    assignedAgent,
    riskLevel,
    createdAt,
    inputSource,
    originalRequest,
    selectedProjectId,
    selectedProjectPath,
    selectedProjectLabel,
    ...safetyConditions,
    ...reportItems,
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
    target_repo: targetRepo,
    assigned_agent: assignedAgent,
    risk_level: riskLevel,
    human_gate_required: humanGateRequired,
    original_request: originalRequest,
    selected_project_id: selectedProjectId,
    selected_project_path: selectedProjectPath,
    selected_project_label: selectedProjectLabel,
    safety_conditions: safetyConditions,
    report_items: reportItems,
    body: promptText,
    prompt_text: promptText,
    created_at: createdAt,
    source: inputSource,
    redacted_count: promptInfo.redactedCount,
  };
}

function buildLatestMarkdown(entry) {
  const safe = sanitizeHandoffPayload(entry);
  const safetyConditions = Array.isArray(safe.safety_conditions) ? safe.safety_conditions : [];
  const reportItems = Array.isArray(safe.report_items) ? safe.report_items : [];
  return [
    '# Codex Handoff Inbox',
    '',
    `- id: ${safe.id}`,
    `- title: ${safe.title}`,
    `- target_repo: ${safe.target_repo}`,
    `- assigned_agent: ${safe.assigned_agent}`,
    `- risk_level: ${safe.risk_level}`,
    `- human_gate_required: ${safe.human_gate_required ? 'true' : 'false'}`,
    `- created_at: ${safe.created_at}`,
    `- source: ${safe.source}`,
    safe.original_request ? `- original_request: ${safe.original_request}` : null,
    safe.selected_project_id ? `- selected_project_id: ${safe.selected_project_id}` : null,
    safe.selected_project_path ? `- selected_project_path: ${safe.selected_project_path}` : null,
    safe.selected_project_label ? `- selected_project_label: ${safe.selected_project_label}` : null,
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
    '## prompt_text',
    '',
    '```text',
    safe.prompt_text,
    '```',
    '',
    '> Codexへ自動入力はしていません。Inboxへ保存しただけです。',
  ].filter((line) => line != null).join('\n');
}

function saveHandoffInbox(payload = {}, options = {}) {
  const handoffDir = getHandoffDir(options);
  const queuePath = getQueuePath({ handoffDir });
  const latestPath = getLatestPath({ handoffDir });
  const now = new Date().toISOString();
  const safe = sanitizeHandoffPayload(payload);
  const record = {
    ...safe,
    saved_at: now,
    created_at: safe.created_at || now,
    source: 'kosame_console',
  };
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
            saved_at: result.saved_at,
            latestHandoff: result.latestHandoff,
            latestPath: result.latestPath,
            queuePath: result.queuePath,
            message: 'Codexへ自動入力はしていません。Inboxへ保存しただけです。',
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
