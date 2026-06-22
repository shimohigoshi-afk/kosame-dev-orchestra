'use strict';

// KOSAME Spec-to-Tasks Orchestrator
// Accepts spec attachments (image/md/docx) from KOSAME CHAT,
// analyzes content via Gemini (images) or text parsing (md/docx),
// decomposes into work tickets, saves to Handoff Inbox, and
// emits stream-log events so Runner Queue Lite auto-executes.

const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');

const HANDOFF_TARGET_REPO = '/home/lavie/kosame-dev-orchestra';
const GEMINI_HOST = 'generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30000;

const SPEC_TRIGGERS = [
  '設計書', '仕様書', '設計図', 'spec', 'design doc', 'specification',
  '実装してください', '自動実装', '作業票',
];
const SPEC_EXTENSIONS = ['.md', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// ── Intent detection ────────────────────────────────────────────────────────
// Spec pipeline triggers only when a spec-type file attachment is present.
// Keywords alone (without a file) do NOT trigger the pipeline to avoid
// interfering with normal work-order requests that mention these words.

function detectSpecIntent(message, attachments) {
  const msg = String(message || '').toLowerCase();
  const hasSpecKeyword = SPEC_TRIGGERS.some((t) => msg.includes(t.toLowerCase()));
  const atts = Array.isArray(attachments) ? attachments : [];
  const specAttachments = atts.filter((att) => {
    const ext = String(att.ext || '').toLowerCase();
    return SPEC_EXTENSIONS.includes(ext) || (att.base64DataUrl && att.base64DataUrl.startsWith('data:image/'));
  });
  return {
    isSpec: specAttachments.length > 0,
    hasSpecKeyword,
    specAttachments,
  };
}

// ── Gemini image analysis ───────────────────────────────────────────────────

function _stripDataUrlPrefix(base64DataUrl) {
  const idx = base64DataUrl.indexOf(',');
  const prefix = idx >= 0 ? base64DataUrl.slice(5, idx) : '';
  const mimeType = prefix.replace(/;base64$/, '') || 'image/png';
  const data = idx >= 0 ? base64DataUrl.slice(idx + 1) : base64DataUrl;
  return { mimeType, data };
}

async function analyzeSpecWithGemini(base64DataUrl, timeoutMs) {
  const timeout = typeof timeoutMs === 'number' ? timeoutMs : GEMINI_TIMEOUT_MS;
  process.stderr.write('[spec-to-tasks] Gemini image analysis start\n');

  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    process.stderr.write('[spec-to-tasks] GEMINI_API_KEY not set, skip image analysis\n');
    return { text: null, error: 'GEMINI_API_KEY not set' };
  }

  const { mimeType, data } = _stripDataUrlPrefix(base64DataUrl);
  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: 'この設計書・仕様書の内容を日本語で詳しく説明してください。実装が必要な機能・コンポーネント・ファイルのリストを番号付きで挙げてください。' },
        { inline_data: { mime_type: mimeType, data } },
      ],
    }],
    generationConfig: { maxOutputTokens: 2000 },
  });

  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; req.destroy(); resolve({ text: null, error: 'timeout' }); }
    }, timeout);

    const req = https.request({
      hostname: GEMINI_HOST,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(raw);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (text) {
            process.stderr.write(`[spec-to-tasks] Gemini image analysis done (${text.length} chars)\n`);
            resolve({ text, error: null });
          } else {
            const errMsg = parsed?.error?.message || 'empty response';
            process.stderr.write(`[spec-to-tasks] Gemini error: ${errMsg}\n`);
            resolve({ text: null, error: errMsg });
          }
        } catch (e) {
          resolve({ text: null, error: e.message });
        }
      });
    });
    req.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ text: null, error: e.message });
    });
    req.write(body);
    req.end();
  });
}

// ── Base64 stripping ────────────────────────────────────────────────────────
// Base64 chars include '/' (non-word), which creates word boundaries that let
// sequences like "/deploy/" match forbidden patterns in saveHandoffInbox.
// Strip all data URLs from spec text before sending to the handoff bridge.

function _stripBase64DataUrls(text) {
  return String(text).replace(
    /data:[a-z][a-z0-9!#$&\-^]*(\/[a-z0-9!#$&\-^]*)?(?:;[^;,\s]+)?;base64,[A-Za-z0-9+/=\r\n]{10,}/gi,
    '[base64データ・除去済み]',
  );
}

// ── Text spec analysis ──────────────────────────────────────────────────────

function analyzeSpecText(textContent, filename) {
  return { text: String(textContent || ''), filename: String(filename || '') };
}

// ── Heuristic task decomposition ────────────────────────────────────────────

function decomposeSpecToTasks(specText, projectPath) {
  const targetRepo = String(projectPath || HANDOFF_TARGET_REPO);
  const text = String(specText || '').trim();
  if (!text) return [];

  const rawTasks = [];
  const lines = text.split('\n');
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // ### Section heading → new task
    if (/^#{1,3}\s+.{2,}/.test(trimmed)) {
      if (current) rawTasks.push(current);
      current = { title: trimmed.replace(/^#+\s+/, '').trim(), body: [] };
    // Numbered item: 1. or 1) at line start → new task
    } else if (/^\d+[.)]\s+.{2,}/.test(trimmed)) {
      if (current) rawTasks.push(current);
      current = { title: trimmed.replace(/^\d+[.)]\s+/, '').trim(), body: [] };
    } else if (current && trimmed) {
      current.body.push(trimmed);
    }
  }
  if (current) rawTasks.push(current);

  // Fall back: whole spec is one task
  if (rawTasks.length === 0) {
    rawTasks.push({ title: '設計書に基づく実装', body: lines.filter(Boolean) });
  }

  const now = Date.now();
  return rawTasks.map((t, i) => {
    const uid = crypto.randomBytes(4).toString('hex');
    const promptBody = [t.title, '', ...t.body].join('\n').slice(0, 3000);
    return {
      id: `spec-${now}-${String(i + 1).padStart(3, '0')}-${uid}`,
      title: t.title.slice(0, 100),
      assigned_agent: 'Codex',
      risk_level: 'low',
      human_gate_required: false,
      target_repo: targetRepo,
      prompt_text: `# 設計書タスク: ${t.title}\n\n${promptBody}\n\n上記の設計に基づいて実装してください。`,
    };
  });
}

// ── Handoff Inbox persistence ───────────────────────────────────────────────

function saveTasksToHandoff(tasks) {
  const { saveHandoffInbox } = require('./kosame-codex-handoff-bridge-server');
  const results = [];
  for (const task of tasks) {
    try {
      const r = saveHandoffInbox(task);
      process.stderr.write(`[spec-to-tasks] saved ticket: ${task.id} — ${task.title}\n`);
      results.push({ ok: true, id: task.id, title: task.title, savedAt: r.saved_at });
    } catch (err) {
      process.stderr.write(`[spec-to-tasks] save failed: ${task.id} — ${err.message}\n`);
      results.push({ ok: false, id: task.id, title: task.title, error: err.message });
    }
  }
  return results;
}

// ── Stream log events ───────────────────────────────────────────────────────

function emitSpecStreamLog(status, message) {
  try {
    const { appendShellAgentActivityEvent } = require('./kosame-shell-agent-activity');
    appendShellAgentActivityEvent({
      agent: 'DIRECTOR',
      project: 'KOSAME Dev Orchestra',
      status,
      task: '設計書→作業票変換',
      message,
    });
  } catch (_) {}
}

// ── Full pipeline ───────────────────────────────────────────────────────────

async function processSpec(input) {
  const { message, attachments, projectPath } = input || {};
  const { isSpec } = detectSpecIntent(message, Array.isArray(attachments) ? attachments : []);

  if (!isSpec) {
    return { ok: false, error: 'spec not detected', tasks: [], saveResults: [] };
  }

  emitSpecStreamLog('running', '設計書を受け付けました。解析を開始します...');

  let specText = '';

  for (const att of (Array.isArray(attachments) ? attachments : [])) {
    const ext = String(att.ext || '').toLowerCase();
    if (att.base64DataUrl && IMAGE_EXTS.has(ext)) {
      emitSpecStreamLog('running', `画像設計書をGeminiで解析中: ${att.name || 'image'}`);
      const gemResult = await analyzeSpecWithGemini(att.base64DataUrl);
      if (gemResult.text) {
        specText += gemResult.text + '\n';
      } else {
        process.stderr.write(`[spec-to-tasks] image analysis failed: ${gemResult.error}\n`);
      }
    } else if (att.textContent) {
      const parsed = analyzeSpecText(att.textContent, att.name);
      // Strip base64 data URLs embedded in markdown files (e.g. ![img](data:image/png;base64,...))
      specText += _stripBase64DataUrls(parsed.text) + '\n';
    }
  }

  if (message) specText += '\n' + message;

  // Final guard: strip any remaining base64 before handoff to prevent
  // forbidden pattern false-positives in saveHandoffInbox
  specText = _stripBase64DataUrls(specText);

  if (!specText.trim()) {
    emitSpecStreamLog('failed', '設計書の内容を取得できませんでした');
    return { ok: false, error: 'no spec content extracted', tasks: [], saveResults: [] };
  }

  emitSpecStreamLog('running', '設計書を作業票に分解中...');
  const tasks = decomposeSpecToTasks(specText, projectPath);
  process.stderr.write(`[spec-to-tasks] decomposed into ${tasks.length} task(s)\n`);

  if (tasks.length === 0) {
    emitSpecStreamLog('failed', '作業票を生成できませんでした');
    return { ok: false, error: 'no tasks decomposed', tasks: [], saveResults: [] };
  }

  emitSpecStreamLog('running', `作業票 ${tasks.length} 件をHandoff Inboxに保存中...`);
  const saveResults = saveTasksToHandoff(tasks);
  const savedCount = saveResults.filter((r) => r.ok).length;

  if (savedCount > 0) {
    emitSpecStreamLog('success', `作業票 ${savedCount} 件を保存しました。Runnerが自動実行します。`);
  } else {
    emitSpecStreamLog('failed', 'Handoff Inbox への保存に失敗しました');
  }

  return {
    ok: savedCount > 0,
    tasks,
    saveResults,
    savedCount,
    specPreview: specText.slice(0, 300),
  };
}

module.exports = {
  detectSpecIntent,
  analyzeSpecWithGemini,
  analyzeSpecText,
  decomposeSpecToTasks,
  saveTasksToHandoff,
  emitSpecStreamLog,
  processSpec,
  _stripBase64DataUrls,
  HANDOFF_TARGET_REPO,
  SPEC_TRIGGERS,
  SPEC_EXTENSIONS,
};
