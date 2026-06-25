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

const http = require('node:http');
const { TOOL_META, receiveAudio, processCase, getStatus, getSttProvider, TEMPERATURE_LABELS } = require('./kosame-transcribe-pipeline');

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

  // POST /api/transcribe — 音声受付
  if (url === '/api/transcribe' && meth === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendError(res, 400, e.message); }

    const { customer_name, agency_id, audio_base64, filename } = body;
    if (!audio_base64 || typeof audio_base64 !== 'string') return sendError(res, 400, 'audio_base64 required');
    if (!filename || typeof filename !== 'string')          return sendError(res, 400, 'filename required');

    let audioBuffer;
    try { audioBuffer = Buffer.from(audio_base64, 'base64'); }
    catch (e) { return sendError(res, 400, `invalid base64: ${e.message}`); }

    if (audioBuffer.length === 0) return sendError(res, 400, 'audio data is empty');

    try {
      const result = await receiveAudio(
        { customerName: customer_name || '', agencyId: agency_id || '', audioBuffer, filename },
        { write: process.env.TRANSCRIBE_WRITE === '1' }
      );
      return send(res, 200, {
        ok:       result.ok,
        case_id:  result.caseId,
        gcs_uri:  result.gcsUri,
        task_id:  result.taskId,
        dry_run:  result.dryRun,
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
      return send(res, 200, {
        ok:      result.ok,
        case_id: result.caseId,
        found:   result.found,
        status:  result.doc?.status ?? null,
        doc:     result.doc,
        dry_run: result.dryRun,
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
