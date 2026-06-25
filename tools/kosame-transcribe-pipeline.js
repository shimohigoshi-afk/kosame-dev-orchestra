#!/usr/bin/env node
'use strict';

/**
 * KOSAME 営業DX 音声議事録パイプライン v113.3.56
 *
 * 音声受付 → GCSアップロード → CloudTasksエンキュー → STT → 議事録生成 → GCS削除
 *
 * STT_PROVIDER=gemini  (デフォルト) Gemini Flash 2.5 音声インライン
 * STT_PROVIDER=whisper               OpenAI Whisper API (OPENAI_API_KEY必須) または
 *                                    ローカル whisper CLI (フォールバック)
 *
 * dryRun デフォルト。TRANSCRIBE_WRITE=1 で実際のGCP操作。
 */

const https      = require('node:https');
const path       = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync }  = require('node:child_process');

const { uploadFile, deleteFile } = require('./kosame-gcs-client');
const { enqueueTask }            = require('./kosame-cloud-tasks-client');
const { createCase, getCase, updateStatus } = require('./kosame-firestore-client');

const TOOL_META = {
  version: '113.3.56',
  feature: 'v113-3-56-transcribe-pipeline',
  slug:    'kosame-transcribe-pipeline',
};

const GEMINI_HOST  = 'generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 60_000;

// 温度感ラベル (1〜6)
const TEMPERATURE_LABELS = {
  6: '熱い（即決・強い購買意欲）',
  5: 'やや熱い（前向き・検討意欲あり）',
  4: '普通（関心あり・情報収集中）',
  3: 'やや冷たい（消極的・優先度低）',
  2: '冷たい（興味薄・断りムード）',
  1: '不明（判断材料不足）',
};

// ── バリデーション ──────────────────────────────────────────────────────────────

function isWriteEnabled(opts = {}) {
  return opts.write === true || process.env.TRANSCRIBE_WRITE === '1';
}

function getSttProvider() {
  const p = (process.env.STT_PROVIDER || 'gemini').toLowerCase();
  if (!['gemini', 'whisper'].includes(p)) {
    throw new Error(`unknown STT_PROVIDER: "${p}". must be gemini or whisper`);
  }
  return p;
}

function validateCaseId(id) {
  if (!id || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error(`invalid case_id: "${id}"`);
  }
  return id;
}

function buildCaseId(agencyId) {
  const ts  = Date.now();
  const uid = randomUUID().slice(0, 8);
  const prefix = agencyId ? agencyId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) : 'CASE';
  return `${prefix}-${ts}-${uid}`;
}

// ── Gemini HTTP helper ─────────────────────────────────────────────────────────

function geminiRequest(body, timeoutMs = GEMINI_TIMEOUT_MS) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve({ text: null, error: 'GEMINI_API_KEY not set' });

  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; req.destroy(); resolve({ text: null, error: 'timeout' }); }
    }, timeoutMs);

    const req = https.request({
      hostname: GEMINI_HOST,
      path:     `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(raw);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
          resolve({ text, error: text ? null : (parsed?.error?.message || 'empty response') });
        } catch (e) { resolve({ text: null, error: e.message }); }
      });
    });
    req.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); resolve({ text: null, error: e.message }); });
    req.write(payload);
    req.end();
  });
}

// ── STT: Gemini Flash ──────────────────────────────────────────────────────────

async function transcribeWithGemini(audioBuffer, mimeType) {
  const base64 = audioBuffer.toString('base64');
  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: '以下の音声を正確に文字起こししてください。話者が複数いる場合は「話者A:」「話者B:」のように区別してください。句読点を適切に入れてください。' },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0 },
  };

  const { text, error } = await geminiRequest(body);
  if (!text) return { ok: false, transcript: null, error: error || 'empty transcript' };
  return { ok: true, transcript: text, provider: 'gemini' };
}

// ── STT: Whisper ───────────────────────────────────────────────────────────────

async function transcribeWithWhisper(audioBuffer, mimeType, filename = 'audio.mp3') {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey) {
    // OpenAI Whisper API (multipart/form-data)
    const boundary = `----KosameWhisper${Date.now()}`;
    const ext = path.extname(filename) || '.mp3';
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`,
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nja`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filename)}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ];
    const tail = `\r\n--${boundary}--`;
    const bodyBuf = Buffer.concat([
      Buffer.from(parts.join('\r\n') + '\r\n'),
      audioBuffer,
      Buffer.from(tail),
    ]);

    const result = await new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; req.destroy(); resolve({ text: null, error: 'timeout' }); }
      }, 60_000);
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
        },
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(raw);
            resolve({ text: parsed.text || null, error: parsed.error?.message || null });
          } catch (e) { resolve({ text: null, error: e.message }); }
        });
      });
      req.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); resolve({ text: null, error: e.message }); });
      req.write(bodyBuf);
      req.end();
    });

    if (!result.text) return { ok: false, transcript: null, error: result.error || 'empty whisper response' };
    return { ok: true, transcript: result.text, provider: 'whisper-api' };
  }

  // ローカル whisper CLI フォールバック
  const tmp = require('node:os').tmpdir();
  const tmpFile = path.join(tmp, `kosame-audio-${Date.now()}${path.extname(filename) || '.mp3'}`);
  require('node:fs').writeFileSync(tmpFile, audioBuffer);
  try {
    const res = spawnSync('whisper', [tmpFile, '--language', 'ja', '--output_format', 'txt', '--output_dir', tmp], {
      timeout: 300_000,
      encoding: 'utf8',
    });
    if (res.status !== 0) {
      return { ok: false, transcript: null, error: `whisper CLI failed: ${res.stderr?.slice(0, 200) || 'unknown'}` };
    }
    const outFile = tmpFile.replace(/\.[^.]+$/, '.txt');
    const text = require('node:fs').existsSync(outFile) ? require('node:fs').readFileSync(outFile, 'utf8').trim() : null;
    if (!text) return { ok: false, transcript: null, error: 'whisper CLI produced no output' };
    return { ok: true, transcript: text, provider: 'whisper-cli' };
  } finally {
    try { require('node:fs').unlinkSync(tmpFile); } catch {}
  }
}

// ── STT ディスパッチャー ────────────────────────────────────────────────────────

async function runSTT(audioBuffer, mimeType, filename) {
  const provider = getSttProvider();
  process.stderr.write(`[Transcribe] STT provider: ${provider}\n`);

  if (provider === 'whisper') {
    return transcribeWithWhisper(audioBuffer, mimeType, filename);
  }
  return transcribeWithGemini(audioBuffer, mimeType);
}

// ── 議事録生成 ─────────────────────────────────────────────────────────────────

async function generateMinutes(transcript, meta = {}) {
  const { customerName = '（不明）', agencyId = '' } = meta;

  const prompt = `あなたは営業DX議事録アシスタントです。以下の商談音声文字起こしを分析してください。

【顧客名】${customerName}
【代理店ID】${agencyId}
【文字起こし】
${transcript}

以下の形式でJSONを出力してください（他のテキストは含めないこと）:
{
  "summary": "商談内容の要約（200字以内）",
  "temperature": {
    "score": 数値(1〜6),
    "label": "温度感ラベル",
    "reason": "判定根拠（100字以内）"
  },
  "action_items": ["アクション1", "アクション2"],
  "compliance": {
    "ok": true または false,
    "issues": ["問題1（あれば）"]
  },
  "follow_up_email": {
    "subject": "件名",
    "body": "本文（200字以内）",
    "cta": "次のアクション"
  },
  "key_topics": ["話題1", "話題2", "話題3"]
}

温度感スコア基準:
6=熱い（即決・強い購買意欲）/ 5=やや熱い（前向き・検討意欲あり）/ 4=普通（関心あり・情報収集中）/ 3=やや冷たい（消極的・優先度低）/ 2=冷たい（興味薄・断りムード）/ 1=不明（判断材料不足）

コンプライアンスチェック対象: 誇大広告、根拠のない断言、不適切な値引き条件、反社リスク、個人情報の不適切な取り扱い言及`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.3, responseMimeType: 'application/json' },
  };

  const { text, error } = await geminiRequest(body);
  if (!text) return { ok: false, minutes: null, error: error || 'empty minutes response' };

  let parsed;
  try {
    parsed = JSON.parse(text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
  } catch (e) {
    return { ok: false, minutes: null, error: `minutes JSON parse error: ${e.message}`, rawText: text };
  }

  // 温度感ラベルを正規化
  if (parsed?.temperature?.score) {
    const score = Math.max(1, Math.min(6, Number(parsed.temperature.score)));
    parsed.temperature.score  = score;
    parsed.temperature.label  = parsed.temperature.label || TEMPERATURE_LABELS[score];
  }

  return { ok: true, minutes: parsed };
}

// ── 受付エントリポイント ────────────────────────────────────────────────────────

/**
 * 音声受付: GCS保存 → CloudTasksエンキュー → Firestoreケース作成
 *
 * @param {object} params
 *   customerName: string
 *   agencyId:     string
 *   audioBuffer:  Buffer
 *   filename:     string
 * @param {object} opts   { write }
 * @returns {Promise<{ ok, caseId, gcsUri, taskId, dryRun }>}
 */
async function receiveAudio(params, opts = {}) {
  const { customerName, agencyId, audioBuffer, filename } = params;
  const write = isWriteEnabled(opts);

  if (!Buffer.isBuffer(audioBuffer)) throw new Error('audioBuffer must be a Buffer');
  if (!filename || typeof filename !== 'string') throw new Error('filename required');

  const caseId = params.caseId || buildCaseId(agencyId);
  process.stderr.write(`[Transcribe] receiveAudio caseId=${caseId} write=${write}\n`);

  // 1. GCSアップロード
  const gcsRes = await uploadFile(caseId, filename, {
    write,
    content:      audioBuffer,
    contentBytes: audioBuffer.length,
  });
  if (!gcsRes.ok) throw new Error(`GCS upload failed: ${JSON.stringify(gcsRes)}`);

  // 2. CloudTasksエンキュー
  const taskPayload = { type: 'transcribe', caseId, filename, customerName, agencyId };
  const taskRes = await enqueueTask(taskPayload, { write });
  if (!taskRes.ok) throw new Error(`CloudTasks enqueue failed: ${JSON.stringify(taskRes)}`);

  // 3. Firestoreケース作成
  const fsRes = await createCase(caseId, { customerName, agencyId, filename, gcsUri: gcsRes.gcsUri }, { write });
  if (!fsRes.ok) throw new Error(`Firestore createCase failed: ${JSON.stringify(fsRes)}`);

  process.stderr.write(`[Transcribe] receiveAudio done caseId=${caseId}\n`);
  return {
    ok:     true,
    caseId,
    gcsUri: gcsRes.gcsUri,
    taskId: taskRes.taskId,
    dryRun: !write,
  };
}

// ── フルパイプライン ────────────────────────────────────────────────────────────

/**
 * 音声→STT→議事録生成→GCS削除 をまとめて実行する。
 * CloudTasksワーカーハンドラから呼び出す想定。
 *
 * @param {object} params  { caseId, audioBuffer, filename, customerName, agencyId }
 * @param {object} opts    { write }
 */
async function processCase(params, opts = {}) {
  const { caseId, audioBuffer, filename, customerName = '', agencyId = '' } = params;
  const write = isWriteEnabled(opts);
  const id = validateCaseId(caseId);

  process.stderr.write(`[Transcribe] processCase start caseId=${id}\n`);

  // ステータス: processing
  await updateStatus(id, 'processing', { step: 'stt_start' }, { write });

  // STT
  const ext = path.extname(filename).toLowerCase();
  const MIME_MAP = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.flac': 'audio/flac', '.aac': 'audio/aac' };
  const mimeType = MIME_MAP[ext] || 'audio/mpeg';

  const sttRes = await runSTT(audioBuffer, mimeType, filename);
  if (!sttRes.ok) {
    await updateStatus(id, 'failed', { step: 'stt', error: sttRes.error }, { write });
    return { ok: false, caseId: id, error: `STT failed: ${sttRes.error}` };
  }

  // 議事録生成
  const minutesRes = await generateMinutes(sttRes.transcript, { customerName, agencyId });
  if (!minutesRes.ok) {
    await updateStatus(id, 'failed', { step: 'minutes', error: minutesRes.error }, { write });
    return { ok: false, caseId: id, error: `Minutes failed: ${minutesRes.error}` };
  }

  // ステータス: ai_completed + 議事録保存
  await updateStatus(id, 'ai_completed', {
    transcript: sttRes.transcript,
    minutes:    minutesRes.minutes,
    sttProvider: sttRes.provider,
  }, { write });

  // GCS音声削除
  if (write) {
    const delRes = await deleteFile(id, filename, { write });
    process.stderr.write(`[Transcribe] audio deleted gcsUri=${delRes.gcsUri || 'n/a'}\n`);
  }

  process.stderr.write(`[Transcribe] processCase done caseId=${id}\n`);
  return {
    ok:         true,
    caseId:     id,
    transcript: sttRes.transcript,
    minutes:    minutesRes.minutes,
    sttProvider: sttRes.provider,
    dryRun:     !write,
  };
}

// ── ステータス確認 ─────────────────────────────────────────────────────────────

async function getStatus(caseId, opts = {}) {
  const write = isWriteEnabled(opts);
  const id = validateCaseId(caseId);
  return getCase(id, { write });
}

// ── exports ────────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  TEMPERATURE_LABELS,
  getSttProvider,
  receiveAudio,
  runSTT,
  transcribeWithGemini,
  transcribeWithWhisper,
  generateMinutes,
  processCase,
  getStatus,
};
