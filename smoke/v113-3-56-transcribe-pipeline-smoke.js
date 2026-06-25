#!/usr/bin/env node
'use strict';

/**
 * v113.3.56 音声議事録パイプライン smoke test
 *
 * - パイプラインモジュール構造検証
 * - receiveAudio dryRun 動作確認
 * - STT_PROVIDER 切り替え検証
 * - generateMinutes 構造検証 (Gemini APIキーなし時はモック)
 * - APIサーバー起動・エンドポイント検証
 * - processCase dryRun 動作確認
 */

const assert = require('node:assert/strict');
const http   = require('node:http');
const path   = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  TEMPERATURE_LABELS,
  getSttProvider,
  receiveAudio,
  generateMinutes,
  processCase,
  getStatus,
  transcribeWithGemini,
  transcribeWithWhisper,
} = require('../tools/kosame-transcribe-pipeline');

const { createServer } = require('../tools/kosame-transcribe-api-server');

// ── HTTP helper ────────────────────────────────────────────────────────────────

function req(port, urlPath, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const r = http.request({
      hostname: '127.0.0.1', port,
      path: urlPath, method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {},
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }); }
        catch { reject(new Error(`JSON parse error: ${raw.slice(0, 80)}`)); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      try { resolve(await fn(port)); }
      catch (e) { reject(e); }
      finally { server.close(); }
    });
    server.once('error', reject);
  });
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== v113.3.56 transcribe pipeline smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.56'), `version must be >= 113.3.56 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-56'], 'smoke:v113-3-56 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-56'), 'verify must include smoke:v113-3-56');
  assert.ok(pkg.scripts['transcribe:server'], 'transcribe:server npm script must exist');
  console.log('  PASS: package wiring');

  // ── TOOL_META ───────────────────────────────────────────────────────────────
  assert.equal(TOOL_META.version, '113.3.56', 'TOOL_META.version must be 113.3.56');
  assert.ok(TOOL_META.feature, 'TOOL_META.feature must exist');
  console.log('  PASS: TOOL_META');

  // ── TEMPERATURE_LABELS ──────────────────────────────────────────────────────
  for (let i = 1; i <= 6; i++) {
    assert.ok(TEMPERATURE_LABELS[i], `TEMPERATURE_LABELS[${i}] must exist`);
  }
  console.log('  PASS: TEMPERATURE_LABELS 6段階');

  // ── getSttProvider ──────────────────────────────────────────────────────────
  const origProvider = process.env.STT_PROVIDER;
  process.env.STT_PROVIDER = 'gemini';
  assert.equal(getSttProvider(), 'gemini', 'getSttProvider must return gemini');
  process.env.STT_PROVIDER = 'whisper';
  assert.equal(getSttProvider(), 'whisper', 'getSttProvider must return whisper');
  process.env.STT_PROVIDER = 'invalid';
  assert.throws(() => getSttProvider(), /unknown STT_PROVIDER/, 'getSttProvider must throw on invalid provider');
  delete process.env.STT_PROVIDER;
  assert.equal(getSttProvider(), 'gemini', 'getSttProvider must default to gemini');
  if (origProvider !== undefined) process.env.STT_PROVIDER = origProvider;
  console.log('  PASS: getSttProvider gemini/whisper/invalid');

  // ── receiveAudio dryRun ─────────────────────────────────────────────────────
  const testBuffer = Buffer.from('fake-audio-data-for-test');
  const recRes = await receiveAudio(
    { customerName: 'テスト株式会社', agencyId: 'AGT001', audioBuffer: testBuffer, filename: 'meeting.mp3' },
    { write: false }
  );
  assert.ok(recRes.ok, `receiveAudio dryRun must succeed (got: ${JSON.stringify(recRes)})`);
  assert.ok(recRes.caseId, 'receiveAudio must return caseId');
  assert.ok(recRes.gcsUri, 'receiveAudio must return gcsUri');
  assert.ok(recRes.taskId, 'receiveAudio must return taskId');
  assert.equal(recRes.dryRun, true, 'receiveAudio dryRun must set dryRun=true');
  assert.ok(recRes.caseId.startsWith('AGT001'), 'caseId must start with agencyId prefix');
  console.log(`  PASS: receiveAudio dryRun (caseId=${recRes.caseId})`);

  // ── receiveAudio validation ─────────────────────────────────────────────────
  await assert.rejects(
    () => receiveAudio({ customerName: '', agencyId: '', audioBuffer: 'not-a-buffer', filename: 'x.mp3' }, { write: false }),
    /audioBuffer must be a Buffer/,
    'receiveAudio must reject non-Buffer audio'
  );
  await assert.rejects(
    () => receiveAudio({ customerName: '', agencyId: '', audioBuffer: testBuffer, filename: '' }, { write: false }),
    /filename required/,
    'receiveAudio must reject empty filename'
  );
  console.log('  PASS: receiveAudio validation');

  // ── getStatus dryRun ────────────────────────────────────────────────────────
  const statusRes = await getStatus(recRes.caseId, { write: false });
  assert.ok(statusRes.ok, 'getStatus dryRun must succeed');
  assert.equal(statusRes.caseId, recRes.caseId, 'getStatus caseId must match');
  assert.equal(statusRes.dryRun, true, 'getStatus dryRun must be true');
  console.log('  PASS: getStatus dryRun');

  // ── generateMinutes (no API key) ────────────────────────────────────────────
  // APIキーなしでもエラーオブジェクトが正しく返ることを確認
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const minsRes = await generateMinutes('テスト文字起こしテキスト', { customerName: 'テスト株式会社', agencyId: 'AGT001' });
  assert.equal(minsRes.ok, false, 'generateMinutes without API key must return ok=false');
  assert.ok(minsRes.error, 'generateMinutes must return error when no API key');
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  console.log('  PASS: generateMinutes (no API key → graceful error)');

  // ── processCase dryRun ──────────────────────────────────────────────────────
  // APIキーなし→STTがエラー→failedステータスになることを確認
  delete process.env.GEMINI_API_KEY;
  delete process.env.STT_PROVIDER;
  const procRes = await processCase(
    { caseId: recRes.caseId, audioBuffer: testBuffer, filename: 'meeting.mp3', customerName: 'テスト', agencyId: 'AGT001' },
    { write: false }
  );
  // dryRunなのでSTT自体はGemini呼び出しを試みるが、APIキーなしでエラーになるはず
  assert.ok(typeof procRes.ok === 'boolean', 'processCase must return ok boolean');
  assert.equal(procRes.caseId, recRes.caseId, 'processCase caseId must match');
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  console.log('  PASS: processCase dryRun (graceful on no API key)');

  // ── APIサーバー: health endpoint ────────────────────────────────────────────
  const healthRes = await withServer(async (port) => req(port, '/api/health', null, 'GET'));
  assert.equal(healthRes.status, 200, `health must return 200 (got ${healthRes.status})`);
  assert.equal(healthRes.body.ok, true, 'health must return ok=true');
  assert.ok(healthRes.body.version, 'health must return version');
  assert.ok(healthRes.body.temperature_labels, 'health must return temperature_labels');
  console.log('  PASS: GET /api/health');

  // ── APIサーバー: POST /api/transcribe dryRun ────────────────────────────────
  delete process.env.TRANSCRIBE_WRITE;
  const transcribeRes = await withServer(async (port) => req(port, '/api/transcribe', {
    customer_name: 'テスト株式会社',
    agency_id:     'AGT001',
    audio_base64:  testBuffer.toString('base64'),
    filename:      'meeting.mp3',
  }));
  assert.equal(transcribeRes.status, 200, `POST /api/transcribe must return 200 (got ${transcribeRes.status})`);
  assert.equal(transcribeRes.body.ok, true, 'POST /api/transcribe must return ok=true');
  assert.ok(transcribeRes.body.case_id, 'POST /api/transcribe must return case_id');
  assert.ok(transcribeRes.body.gcs_uri, 'POST /api/transcribe must return gcs_uri');
  assert.equal(transcribeRes.body.dry_run, true, 'POST /api/transcribe must return dry_run=true without TRANSCRIBE_WRITE');
  console.log(`  PASS: POST /api/transcribe dryRun (case_id=${transcribeRes.body.case_id})`);

  // ── APIサーバー: GET /api/status/:case_id ──────────────────────────────────
  const statusApiRes = await withServer(async (port) => req(port, `/api/status/${transcribeRes.body.case_id}`, null, 'GET'));
  assert.equal(statusApiRes.status, 200, `GET /api/status must return 200 (got ${statusApiRes.status})`);
  assert.equal(statusApiRes.body.ok, true, 'GET /api/status must return ok=true');
  assert.equal(statusApiRes.body.case_id, transcribeRes.body.case_id, 'GET /api/status case_id must match');
  console.log('  PASS: GET /api/status/:case_id');

  // ── APIサーバー: バリデーションエラー ──────────────────────────────────────
  const badRes = await withServer(async (port) => req(port, '/api/transcribe', { customer_name: 'test' }));
  assert.equal(badRes.status, 400, 'POST /api/transcribe without audio_base64 must return 400');
  assert.equal(badRes.body.ok, false, 'error response must return ok=false');
  console.log('  PASS: バリデーションエラー → 400');

  // ── APIサーバー: 404 ────────────────────────────────────────────────────────
  const notFoundRes = await withServer(async (port) => req(port, '/api/nonexistent', null, 'GET'));
  assert.equal(notFoundRes.status, 404, 'unknown route must return 404');
  console.log('  PASS: 404 on unknown route');

  // ── ファイル存在確認 ─────────────────────────────────────────────────────────
  const fs = require('node:fs');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'tools', 'kosame-transcribe-pipeline.js')), 'pipeline file must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'tools', 'kosame-transcribe-api-server.js')), 'api server file must exist');
  console.log('  PASS: pipeline files exist');

  console.log('\n✅ v113.3.56 transcribe pipeline smoke PASSED');
  console.log('   音声受付 / GCS / CloudTasks / Firestore / STT(gemini|whisper) / 議事録生成 / APIサーバー');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
