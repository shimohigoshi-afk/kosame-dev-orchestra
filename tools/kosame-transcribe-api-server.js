#!/usr/bin/env node
'use strict';

/**
 * KOSAME 音声議事録 API サーバー v113.3.56
 *
 * POST /api/transcribe
 *   Body (JSON): { customer_name, agency_id, audio_base64, filename }
 *   → GCS保存 + CloudTasksエンキュー + Firestoreケース作成
 *   → { ok, case_id, gcs_uri, task_id, dry_run }
 *
 * POST /api/transcribe/process
 *   Body (JSON): { case_id, audio_base64, filename, customer_name, agency_id }
 *   → STT → 議事録生成 → GCS削除（フルパイプライン）
 *   → { ok, case_id, transcript, minutes, stt_provider }
 *
 * GET /api/status/:case_id
 *   → { ok, case_id, status, doc }
 *
 * GET /api/health
 *   → { ok, version, stt_provider, write_mode }
 *
 * 環境変数:
 *   TRANSCRIBE_PORT=8090     (デフォルト 8090)
 *   TRANSCRIBE_WRITE=1       実際のGCP操作を有効化
 *   STT_PROVIDER=gemini|whisper
 *   GEMINI_API_KEY           Gemini Flash 認証
 *   OPENAI_API_KEY           Whisper API 認証（STT_PROVIDER=whisper 時）
 */

const http  = require('node:http');
const https = require('node:https');
const { TOOL_META, receiveAudio, processCase, getStatus, getSttProvider, TEMPERATURE_LABELS } = require('./kosame-transcribe-pipeline');

// ── Google Drive ヘルパー ───────────────────────────────────────────────────────

function parseGdriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const m1 = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function downloadGdriveFile(fileId, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    let done = false;

    function fetch(fetchUrl, redirects) {
      if (redirects > 5) return resolve({ ok: false, error: 'too many redirects' });
      const parsed = new URL(fetchUrl);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'KOSAME-Transcribe/1.0' },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return fetch(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return resolve({ ok: false, error: `HTTP ${res.statusCode}` });
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const buf = Buffer.concat(chunks);
          // Google Drive returns HTML for large files requiring confirmation
          if (buf.slice(0, 100).toString().trim().startsWith('<!DOCTYPE') || buf.slice(0, 5).toString() === '<html') {
            return resolve({ ok: false, error: 'gdrive_confirmation_required: file too large or not publicly shared' });
          }
          resolve({ ok: true, buffer: buf, contentType: res.headers['content-type'] || 'audio/mpeg' });
        });
        res.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); resolve({ ok: false, error: e.message }); });
      });
      req.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); resolve({ ok: false, error: e.message }); });
      req.end();
    }

    const timer = setTimeout(() => {
      if (!done) { done = true; resolve({ ok: false, error: 'gdrive download timeout' }); }
    }, timeoutMs);

    fetch(url, 0);
  });
}

const PORT = Number(process.env.TRANSCRIBE_PORT) || 8090;
const MAX_BODY_BYTES = 150 * 1024 * 1024; // 150MB

// ── リクエストボディ読み取り ────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        return reject(new Error('request body too large (max 150MB)'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ── レスポンスヘルパー ──────────────────────────────────────────────────────────

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function sendError(res, status, message) {
  send(res, status, { ok: false, error: message });
}

// ── ルーター ────────────────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url  = req.url || '/';
  const meth = req.method || 'GET';

  res.setHeader('X-Kosame-Version', TOOL_META.version);

  // Health check
  if (url === '/api/health' && meth === 'GET') {
    const provider = (() => { try { return getSttProvider(); } catch { return 'unknown'; } })();
    return send(res, 200, {
      ok: true,
      version: TOOL_META.version,
      stt_provider: provider,
      write_mode: process.env.TRANSCRIBE_WRITE === '1',
      temperature_labels: TEMPERATURE_LABELS,
    });
  }

  // POST /api/transcribe — 音声受付（ローカルファイル or Google Drive URL）
  if (url === '/api/transcribe' && meth === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendError(res, 400, e.message); }

    const { customer_name, agency_id, audio_base64, filename, gdrive_url } = body;
    const write = process.env.TRANSCRIBE_WRITE === '1';

    let audioBuffer;
    let resolvedFilename = filename || 'audio.mp3';

    if (gdrive_url) {
      // Google Drive ダウンロード
      const fileId = parseGdriveFileId(gdrive_url);
      if (!fileId) return sendError(res, 400, 'invalid gdrive_url: cannot parse file ID');
      const dlRes = await downloadGdriveFile(fileId);
      if (!dlRes.ok) return sendError(res, 422, `gdrive download failed: ${dlRes.error}`);
      audioBuffer = dlRes.buffer;
      // ファイル名を gdrive-{fileId}.mp3 に
      resolvedFilename = filename || `gdrive-${fileId}.mp3`;
    } else {
      if (!audio_base64 || typeof audio_base64 !== 'string') return sendError(res, 400, 'audio_base64 or gdrive_url required');
      if (!filename || typeof filename !== 'string')          return sendError(res, 400, 'filename required');
      try { audioBuffer = Buffer.from(audio_base64, 'base64'); }
      catch (e) { return sendError(res, 400, `invalid base64: ${e.message}`); }
      if (audioBuffer.length === 0) return sendError(res, 400, 'audio data is empty');
    }

    try {
      const recResult = await receiveAudio(
        { customerName: customer_name || '', agencyId: agency_id || '', audioBuffer, filename: resolvedFilename },
        { write }
      );
      if (!recResult.ok) throw new Error('receiveAudio returned ok=false');

      // 非同期でSTT→議事録生成を即時キックオフ（Cloud Tasksワーカーが不要な場合）
      setImmediate(() => {
        processCase(
          { caseId: recResult.caseId, audioBuffer, filename: resolvedFilename, customerName: customer_name || '', agencyId: agency_id || '' },
          { write }
        ).catch((e) => process.stderr.write(`[TranscribeAPI] async processCase error: ${e.message}\n`));
      });

      return send(res, 200, {
        ok:       true,
        case_id:  recResult.caseId,
        gcs_uri:  recResult.gcsUri,
        task_id:  recResult.taskId,
        dry_run:  recResult.dryRun,
      });
    } catch (e) {
      process.stderr.write(`[TranscribeAPI] receiveAudio error: ${e.message}\n`);
      return sendError(res, 500, `receiveAudio failed: ${e.message}`);
    }
  }

  // POST /api/transcribe/process — フルパイプライン
  if (url === '/api/transcribe/process' && meth === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendError(res, 400, e.message); }

    const { case_id, audio_base64, filename, customer_name, agency_id } = body;
    if (!case_id || typeof case_id !== 'string')           return sendError(res, 400, 'case_id required');
    if (!audio_base64 || typeof audio_base64 !== 'string') return sendError(res, 400, 'audio_base64 required');
    if (!filename || typeof filename !== 'string')          return sendError(res, 400, 'filename required');

    let audioBuffer;
    try { audioBuffer = Buffer.from(audio_base64, 'base64'); }
    catch (e) { return sendError(res, 400, `invalid base64: ${e.message}`); }

    try {
      const result = await processCase(
        { caseId: case_id, audioBuffer, filename, customerName: customer_name || '', agencyId: agency_id || '' },
        { write: process.env.TRANSCRIBE_WRITE === '1' }
      );
      return send(res, result.ok ? 200 : 500, {
        ok:          result.ok,
        case_id:     result.caseId,
        transcript:  result.transcript,
        minutes:     result.minutes,
        stt_provider: result.sttProvider,
        dry_run:     result.dryRun,
        error:       result.error,
      });
    } catch (e) {
      process.stderr.write(`[TranscribeAPI] processCase error: ${e.message}\n`);
      return sendError(res, 500, `processCase failed: ${e.message}`);
    }
  }

  // GET /api/status/:case_id
  const statusMatch = url.match(/^\/api\/status\/([A-Za-z0-9_-]{1,128})$/);
  if (statusMatch && meth === 'GET') {
    const caseId = statusMatch[1];
    try {
      const result = await getStatus(caseId, { write: process.env.TRANSCRIBE_WRITE === '1' });
      // 最新の ai_completed/completed history エントリから result_data を抽出
      let resultData = null;
      if (result.doc?.history) {
        const entry = [...result.doc.history].reverse().find(
          (h) => h.status === 'ai_completed' || h.status === 'completed'
        );
        if (entry?.meta) resultData = entry.meta;
      }
      return send(res, 200, {
        ok:          result.ok,
        case_id:     result.caseId,
        found:       result.found,
        status:      result.doc?.status ?? null,
        status_label: result.doc?.statusLabel ?? null,
        doc:         result.doc,
        result_data: resultData,
        dry_run:     result.dryRun,
      });
    } catch (e) {
      return sendError(res, 500, e.message);
    }
  }

  return sendError(res, 404, `not found: ${meth} ${url}`);
}

// ── サーバー作成 ────────────────────────────────────────────────────────────────

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      process.stderr.write(`[TranscribeAPI] unhandled error: ${e.message}\n`);
      try { sendError(res, 500, 'internal server error'); } catch {}
    });
  });
}

function startServer(port = PORT) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      const addr = server.address();
      process.stderr.write(`[TranscribeAPI] listening on port ${addr.port} (STT_PROVIDER=${process.env.STT_PROVIDER || 'gemini'}, WRITE=${process.env.TRANSCRIBE_WRITE || '0'})\n`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

module.exports = { createServer, startServer, handleRequest, PORT };

// スタンドアロン起動
if (require.main === module) {
  startServer().catch((e) => { process.stderr.write(`[TranscribeAPI] fatal: ${e.message}\n`); process.exit(1); });
}
