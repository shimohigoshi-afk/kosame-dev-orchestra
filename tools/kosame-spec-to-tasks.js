'use strict';

// KOSAME Spec-to-Tasks Orchestrator
// Accepts spec attachments (image/md/docx) from KOSAME CHAT,
// analyzes content via Gemini (images) or text parsing (md/docx),
// decomposes into work tickets, saves to Handoff Inbox, and
// emits stream-log events so Runner Queue Lite auto-executes.

const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  appendPipelineStageEvent,
  createPipelineError,
  summarizePipelineStageHistory,
} = require('./kosame-pipeline-telemetry');
const { buildSafeHandoffAttachmentSummary } = require('./kosame-attachment-store');

const HANDOFF_TARGET_REPO = '/home/lavie/kosame-dev-orchestra';
const GEMINI_HOST = 'generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30000;

const SPEC_TRIGGERS = [
  '設計書', '仕様書', '設計図', 'spec', 'design doc', 'specification',
  '実装してください', '自動実装', '作業票',
];
const SPEC_EXTENSIONS = ['.md', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'];
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

function summarizeAttachments(attachments = []) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return [];
  const summary = [`添付ファイル${list.length}件を受け取りました。`];
  const imageCount = list.filter((att) => {
    const ext = String(att.ext || '').toLowerCase();
    const mimeType = String(att.mimeType || '').toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) || mimeType.startsWith('image/');
  }).length;
  if (imageCount > 0) summary.push(`画像添付あり: ${imageCount}件`);
  for (const att of list.slice(0, 12)) {
    summary.push(`[attachment:${att.attachmentId || att.id || att.name || 'attachment'}] ${att.displayName || att.name || 'attachment'} (${att.mimeType || 'application/octet-stream'} · ${Number(att.size || 0)}B)`);
  }
  return summary;
}

function collectAttachmentIds(attachments = []) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((att) => String(att && (att.attachmentId || att.id || att.attachment_id || att.name || '')).trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeSpecErrorCode(stage, message) {
  const text = String(message || '').toLowerCase();
  if (!stage) return 'SPEC_PIPELINE_FAILED';
  if (stage.includes('manifest') || stage.includes('save') || stage.includes('handoff')) {
    if (text.includes('forbidden')) return 'HANDOFF_FORBIDDEN';
    return 'HANDOFF_SAVE_FAILED';
  }
  if (stage.includes('decompos')) return 'SPEC_DECOMPOSE_FAILED';
  if (stage.includes('content')) return 'SPEC_CONTENT_MISSING';
  return 'SPEC_PIPELINE_FAILED';
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

function saveTasksToHandoff(tasks, options = {}) {
  const { saveHandoffInbox } = options.saveHandoffInbox
    ? { saveHandoffInbox: options.saveHandoffInbox }
    : require('./kosame-codex-handoff-bridge-server');
  const results = [];
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const handoffDir = options.handoffDir || process.env.KOSAME_HANDOFF_DIR || undefined;
  const stageHistory = Array.isArray(options.stageHistory) ? options.stageHistory : [];
  for (const task of tasks) {
    try {
      stageHistory.push(appendPipelineStageEvent({
        stage: 'handoff.save.started',
        status: 'running',
        workOrderId: task.id,
        attachmentCount: attachments.length,
        attachmentIds: collectAttachmentIds(attachments),
        route: 'spec-to-tasks',
        message: `作業票 ${task.id} の保存を開始します`,
      }, { agent: 'Runner', task: task.title || task.id }));
      const r = saveHandoffInbox({
        ...task,
        attachments,
      }, { handoffDir });
      const manifestPath = r.attachmentManifestPath || r.latestHandoff?.attachment_manifest_path || r.latestHandoff?.attachmentManifestPath || '';
      stageHistory.push(appendPipelineStageEvent({
        stage: 'attachments.manifest.saved',
        status: 'success',
        workOrderId: task.id,
        attachmentCount: attachments.length,
        attachmentIds: collectAttachmentIds(attachments),
        manifestPath,
        route: 'spec-to-tasks',
        message: manifestPath ? `attachment manifest saved at ${manifestPath}` : 'attachment manifest saved',
      }, { agent: 'Runner', task: task.title || task.id }));
      stageHistory.push(appendPipelineStageEvent({
        stage: 'handoff.save.completed',
        status: 'success',
        workOrderId: task.id,
        attachmentCount: attachments.length,
        attachmentIds: collectAttachmentIds(attachments),
        manifestPath,
        route: 'spec-to-tasks',
        message: `作業票 ${task.id} を保存しました`,
      }, { agent: 'Runner', task: task.title || task.id }));
      process.stderr.write(`[spec-to-tasks] saved ticket: ${task.id} — ${task.title}\n`);
      results.push({
        ok: true,
        id: task.id,
        title: task.title,
        savedAt: r.saved_at,
        manifestPath,
        attachmentManifestPath: r.attachmentManifestPath || manifestPath,
        attachmentIds: collectAttachmentIds(attachments),
      });
    } catch (err) {
      const errorStage = 'handoff.save';
      const errorMessage = err && err.message ? err.message : 'handoff save failed';
      const errorCode = normalizeSpecErrorCode(errorStage, errorMessage);
      const structured = createPipelineError({
        errorStage,
        errorCode,
        errorMessage,
        workOrderId: task.id,
        attachmentCount: attachments.length,
        attachmentIds: collectAttachmentIds(attachments),
        manifestPath: options.manifestPath || '',
        route: 'spec-to-tasks',
        stageHistory,
        details: { taskTitle: task.title || task.id },
      });
      stageHistory.push(appendPipelineStageEvent({
        stage: errorStage,
        status: 'failed',
        errorStage,
        errorCode,
        errorMessage,
        workOrderId: task.id,
        attachmentCount: attachments.length,
        attachmentIds: collectAttachmentIds(attachments),
        manifestPath: options.manifestPath || '',
        route: 'spec-to-tasks',
        message: errorMessage,
      }, { agent: 'Runner', task: task.title || task.id }));
      process.stderr.write(`[spec-to-tasks] save failed: ${task.id} — ${errorMessage}\n`);
      results.push({
        ok: false,
        id: task.id,
        title: task.title,
        ...structured,
        error: errorMessage,
      });
    }
  }
  return { results, stageHistory };
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
  const { message, attachments, projectPath, handoffDir } = input || {};
  const { isSpec } = detectSpecIntent(message, Array.isArray(attachments) ? attachments : []);
  const stageHistory = [];
  const attachmentIds = collectAttachmentIds(attachments);
  const timestamp = new Date().toISOString();
  const pipelineId = `spec-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const route = 'spec-to-tasks';

  if (!isSpec) {
    const error = createPipelineError({
      errorStage: 'spec.intent',
      errorCode: 'SPEC_NOT_DETECTED',
      errorMessage: 'spec not detected',
      workOrderId: pipelineId,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath: '',
      route,
      stageHistory,
      details: { pipelineId },
    });
    return { ...error, tasks: [], saveResults: [], stageHistory };
  }

  stageHistory.push(appendPipelineStageEvent({
    stage: 'chat.received',
    status: 'running',
    workOrderId: pipelineId,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp,
    message: 'KOSAME: 受信した入力を解析します☂️',
  }, { agent: 'KOSAME', task: 'chat.received' }));
  stageHistory.push(appendPipelineStageEvent({
    stage: 'attachments.received',
    status: 'running',
    workOrderId: pipelineId,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp,
    message: `KOSAME: 添付ファイル${attachmentIds.length}件を受け取りました☂️`,
  }, { agent: 'KOSAME', task: 'attachments.received' }));
  if (Array.isArray(attachments) && attachments.some((att) => String(att.mimeType || '').toLowerCase().startsWith('image/'))) {
    stageHistory.push(appendPipelineStageEvent({
      stage: 'attachments.received',
      status: 'running',
      workOrderId: pipelineId,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      route,
      timestamp: new Date().toISOString(),
      message: 'KOSAME: 画像添付を受信しました☂️',
    }, { agent: 'KOSAME', task: 'attachments.received' }));
  }
  stageHistory.push(appendPipelineStageEvent({
    stage: 'attachments.summary.built',
    status: 'success',
    workOrderId: pipelineId,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp: new Date().toISOString(),
    message: `添付サマリを構築しました（${attachmentIds.length}件）`,
  }, { agent: 'DIRECTOR', task: 'attachments.summary.built' }));
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
  const attachmentSummary = summarizeAttachments(attachments);
  if (attachmentSummary.length) {
    specText += '\n\n## 添付ファイル\n' + attachmentSummary.join('\n');
  }
  const attachmentManifestSummary = buildSafeHandoffAttachmentSummary({
    workOrderId: pipelineId,
    attachments: Array.isArray(attachments) ? attachments : [],
  });
  if (attachmentManifestSummary.length) {
    specText += '\n\n## 添付マニフェスト参照\n' + attachmentManifestSummary.join('\n');
  }

  // Final guard: strip any remaining base64 before handoff to prevent
  // forbidden pattern false-positives in saveHandoffInbox
  specText = _stripBase64DataUrls(specText);

  if (!specText.trim()) {
    const error = createPipelineError({
      errorStage: 'spec.content',
      errorCode: 'SPEC_CONTENT_MISSING',
      errorMessage: 'no spec content extracted',
      workOrderId: pipelineId,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath: '',
      route,
      stageHistory,
    });
    emitSpecStreamLog('failed', '設計書の内容を取得できませんでした');
    return { ...error, tasks: [], saveResults: [], stageHistory };
  }

  stageHistory.push(appendPipelineStageEvent({
    stage: 'spec-to-tasks.started',
    status: 'running',
    workOrderId: pipelineId,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp: new Date().toISOString(),
    message: '設計書を作業票に分解中...',
  }, { agent: 'DIRECTOR', task: 'spec-to-tasks.started' }));
  const tasks = decomposeSpecToTasks(specText, projectPath);
  process.stderr.write(`[spec-to-tasks] decomposed into ${tasks.length} task(s)\n`);
  stageHistory.push(appendPipelineStageEvent({
    stage: 'spec-to-tasks.decomposed',
    status: 'success',
    workOrderId: pipelineId,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp: new Date().toISOString(),
    message: `設計書を ${tasks.length} 件の作業票に分解しました`,
  }, { agent: 'DIRECTOR', task: 'spec-to-tasks.decomposed' }));

  if (tasks.length === 0) {
    const error = createPipelineError({
      errorStage: 'spec.decompose',
      errorCode: 'SPEC_DECOMPOSE_FAILED',
      errorMessage: 'no tasks decomposed',
      workOrderId: pipelineId,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath: '',
      route,
      stageHistory,
    });
    emitSpecStreamLog('failed', '作業票を生成できませんでした');
    return { ...error, tasks: [], saveResults: [], stageHistory };
  }

  stageHistory.push(appendPipelineStageEvent({
    stage: 'handoff.save.started',
    status: 'running',
    workOrderId: tasks[0].id,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    route,
    timestamp: new Date().toISOString(),
    message: `作業票 ${tasks.length} 件をHandoff Inboxに保存中...`,
  }, { agent: 'Runner', task: 'handoff.save.started' }));
  const saveOutcome = saveTasksToHandoff(tasks, {
    attachments,
    handoffDir,
    stageHistory,
    saveHandoffInbox: input.saveHandoffInbox,
  });
  const saveResults = Array.isArray(saveOutcome.results) ? saveOutcome.results : [];
  const savedCount = saveResults.filter((r) => r && r.ok).length;
  const failedResults = saveResults.filter((r) => r && !r.ok);
  const manifestPath = saveResults.find((r) => r && r.manifestPath)?.manifestPath
    || saveResults.find((r) => r && r.attachmentManifestPath)?.attachmentManifestPath
    || '';
  const failedResult = failedResults[0] || null;

  if (savedCount > 0 && failedResults.length === 0) {
    stageHistory.push(appendPipelineStageEvent({
      stage: 'handoff.save.completed',
      status: 'success',
      workOrderId: tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      timestamp: new Date().toISOString(),
      message: `作業票 ${savedCount} 件を保存しました。Runnerが自動実行します。`,
    }, { agent: 'Runner', task: 'handoff.save.completed' }));
    stageHistory.push(appendPipelineStageEvent({
      stage: 'runner.dispatch.started',
      status: 'running',
      workOrderId: tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      timestamp: new Date().toISOString(),
      message: 'Runner起動を待ちます',
    }, { agent: 'Runner', task: 'runner.dispatch.started' }));
    stageHistory.push(appendPipelineStageEvent({
      stage: 'runner.dispatch.completed',
      status: 'success',
      workOrderId: tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      timestamp: new Date().toISOString(),
      message: 'Runner起動待ちの準備が完了しました',
    }, { agent: 'Runner', task: 'runner.dispatch.completed' }));
    stageHistory.push(appendPipelineStageEvent({
      stage: 'result.decision.updated',
      status: 'success',
      workOrderId: tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      timestamp: new Date().toISOString(),
      message: 'Result Decision Panel へ更新予定です',
    }, { agent: 'Runner', task: 'result.decision.updated' }));
    emitSpecStreamLog('running', 'Runner: attachment manifestを保存しました');
    emitSpecStreamLog('running', 'Llama: base64本文混入は検出されませんでした。以上。');
    emitSpecStreamLog('success', `作業票 ${savedCount} 件を保存しました。Runnerが自動実行します。`);
  } else {
    const errorStage = failedResult?.errorStage || 'handoff.save';
    const errorMessage = failedResult?.errorMessage || failedResult?.error || 'Handoff Inbox への保存に失敗しました';
    const errorCode = failedResult?.errorCode || normalizeSpecErrorCode(errorStage, errorMessage);
    const error = createPipelineError({
      errorStage,
      errorCode,
      errorMessage,
      workOrderId: failedResult?.id || tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      stageHistory,
      details: {
        savedCount,
        failedCount: failedResults.length,
        tasks: tasks.length,
      },
    });
    stageHistory.push(appendPipelineStageEvent({
      stage: errorStage,
      status: 'failed',
      errorStage,
      errorCode,
      errorMessage,
      workOrderId: failedResult?.id || tasks[0].id,
      attachmentCount: attachmentIds.length,
      attachmentIds,
      manifestPath,
      route,
      timestamp: new Date().toISOString(),
      message: errorMessage,
    }, { agent: 'Runner', task: errorStage }));
    emitSpecStreamLog('failed', 'Handoff Inbox への保存に失敗しました');
    return { ...error, tasks, saveResults, savedCount, stageHistory, specPreview: specText.slice(0, 300) };
  }

  return {
    ok: savedCount > 0,
    tasks,
    saveResults,
    savedCount,
    stageHistory,
    stageHistorySummary: summarizePipelineStageHistory(stageHistory),
    workOrderId: tasks[0].id,
    attachmentCount: attachmentIds.length,
    attachmentIds,
    manifestPath,
    route,
    timestamp: new Date().toISOString(),
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
