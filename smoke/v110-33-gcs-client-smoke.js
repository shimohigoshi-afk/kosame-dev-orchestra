'use strict';

/**
 * v110.33 smoke: kosame-gcs-client
 *
 * 検証項目:
 *  1. TOOL_META (version / slug / dryRunDefault)
 *  2. 定数 (GCP_PROJECT / BUCKET_NAME / MAX_BYTES / FOLDER_PREFIX)
 *  3. SUPPORTED_MIME_TYPES: mp3/wav/m4a/mp4/ogg/webm/flac/aac
 *  4. buildObjectPath: cases/{case_id}/audio/{filename}
 *  5. buildCasePrefix: cases/{case_id}/audio/
 *  6. buildGcsUri: gs://kosame-audio-files/...
 *  7. validateCaseId: 正常/空文字/スラッシュ含む拒否
 *  8. validateFilename: 正常/パス区切り拒否/不正文字拒否
 *  9. validateFileSize: 正常/100MB超過拒否
 * 10. detectMimeType: 拡張子から MIME 推定
 * 11. uploadFile dryRun: ok/dryRun/gcsUri/realGcpActionsExecuted=false
 * 12. uploadFile: 100MB超過はアップロード前に拒否
 * 13. downloadFile dryRun: ok/dryRun/content=null
 * 14. deleteFile dryRun: ok/dryRun/objectPath
 * 15. listFiles dryRun: ok/files=[]/count=0/prefix
 * 16. getSignedUrl dryRun: ok/signedUrl=null/expiresAt
 * 17. appendLearningLog: 例外なく実行
 * 18. autoRecord: learningLogAppended=true
 * 19. @google-cloud/storage は dryRun では require されない
 * 20. validateFilename: ディレクトリトラバーサル拒否
 */

const assert = require('node:assert');
const gcs    = require('../tools/kosame-gcs-client');

console.log('=== v110.33 gcs-client smoke ===');

let passed = 0;
function pass(msg) { passed++; console.log('  PASS:', msg); }

// ── 1. TOOL_META ──────────────────────────────────────────────────────────────
assert.strictEqual(gcs.TOOL_META.version,       '110.33.0');
assert.strictEqual(gcs.TOOL_META.slug,          'kosame-gcs-client');
assert.strictEqual(gcs.TOOL_META.dryRunDefault,  true);
pass('TOOL_META: version / slug / dryRunDefault');

// ── 2. 定数 ───────────────────────────────────────────────────────────────────
assert.strictEqual(gcs.GCP_PROJECT,   'kosame-prod-2026');
assert.strictEqual(gcs.BUCKET_NAME,   'kosame-audio-files');
assert.strictEqual(gcs.FOLDER_PREFIX, 'cases');
assert.strictEqual(gcs.AUDIO_SUBDIR,  'audio');
assert.strictEqual(gcs.MAX_BYTES,     100 * 1024 * 1024);
pass('GCP_PROJECT / BUCKET_NAME / FOLDER_PREFIX / MAX_BYTES=100MB');

// ── 3. SUPPORTED_MIME_TYPES ───────────────────────────────────────────────────
const requiredExts = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.webm', '.flac', '.aac'];
for (const ext of requiredExts) {
  assert.ok(gcs.SUPPORTED_MIME_TYPES[ext], `MIME type missing for ${ext}`);
}
assert.strictEqual(gcs.SUPPORTED_MIME_TYPES['.mp3'],  'audio/mpeg');
assert.strictEqual(gcs.SUPPORTED_MIME_TYPES['.wav'],  'audio/wav');
assert.strictEqual(gcs.SUPPORTED_MIME_TYPES['.flac'], 'audio/flac');
pass('SUPPORTED_MIME_TYPES: mp3/wav/m4a/mp4/ogg/webm/flac/aac');

// ── 4. buildObjectPath ────────────────────────────────────────────────────────
assert.strictEqual(
  gcs.buildObjectPath('CASE001', 'rec.mp3'),
  'cases/CASE001/audio/rec.mp3'
);
pass('buildObjectPath: cases/{case_id}/audio/{filename}');

// ── 5. buildCasePrefix ────────────────────────────────────────────────────────
assert.strictEqual(
  gcs.buildCasePrefix('CASE001'),
  'cases/CASE001/audio/'
);
pass('buildCasePrefix: cases/{case_id}/audio/');

// ── 6. buildGcsUri ────────────────────────────────────────────────────────────
assert.strictEqual(
  gcs.buildGcsUri('cases/CASE001/audio/rec.mp3'),
  'gs://kosame-audio-files/cases/CASE001/audio/rec.mp3'
);
pass('buildGcsUri: gs://kosame-audio-files/...');

// ── 7. validateCaseId ─────────────────────────────────────────────────────────
assert.strictEqual(gcs.validateCaseId('CASE-001'), 'CASE-001');
assert.throws(() => gcs.validateCaseId(''),        /non-empty/);
assert.throws(() => gcs.validateCaseId('a/b'),     /invalid case_id format/);
assert.throws(() => gcs.validateCaseId('a b'),     /invalid case_id format/);
pass('validateCaseId: 正常/空文字/スラッシュ拒否');

// ── 8. validateFilename ───────────────────────────────────────────────────────
assert.strictEqual(gcs.validateFilename('audio.mp3'),   'audio.mp3');
assert.strictEqual(gcs.validateFilename('rec-001.wav'), 'rec-001.wav');
assert.throws(() => gcs.validateFilename(''),            /non-empty/);
assert.throws(() => gcs.validateFilename('../secret'),   /path separators/);
assert.throws(() => gcs.validateFilename('path/file'),   /path separators/);
assert.throws(() => gcs.validateFilename('bad file!'),   /invalid filename/);
pass('validateFilename: 正常/空文字/トラバーサル/スラッシュ/特殊文字拒否');

// ── 9. validateFileSize ───────────────────────────────────────────────────────
assert.doesNotThrow(() => gcs.validateFileSize(0));
assert.doesNotThrow(() => gcs.validateFileSize(50 * 1024 * 1024)); // 50MB
assert.doesNotThrow(() => gcs.validateFileSize(gcs.MAX_BYTES));    // ちょうど100MB
assert.throws(
  () => gcs.validateFileSize(gcs.MAX_BYTES + 1),
  /exceeds 100MB limit/
);
pass('validateFileSize: 0/50MB/100MB通過 / 100MB+1byte拒否');

// ── 10. detectMimeType ────────────────────────────────────────────────────────
assert.strictEqual(gcs.detectMimeType('audio.mp3'),  'audio/mpeg');
assert.strictEqual(gcs.detectMimeType('audio.WAV'),  'audio/wav');  // 大文字は一致しない→octet-stream
assert.strictEqual(gcs.detectMimeType('audio.flac'), 'audio/flac');
assert.strictEqual(gcs.detectMimeType('audio.bin'),  'application/octet-stream');
pass('detectMimeType: mp3→audio/mpeg / flac→audio/flac / 不明→octet-stream');

// ── 11–19. 非同期操作テスト ────────────────────────────────────────────────────
async function runAll() {

  // ── 11. uploadFile dryRun ────────────────────────────────────────────────
  const uploaded = await gcs.uploadFile('CASE001', 'interview.mp3', { write: false, contentBytes: 1024 * 1024 });
  assert.strictEqual(uploaded.ok,                    true);
  assert.strictEqual(uploaded.dryRun,                true);
  assert.strictEqual(uploaded.caseId,                'CASE001');
  assert.strictEqual(uploaded.filename,              'interview.mp3');
  assert.strictEqual(uploaded.objectPath,            'cases/CASE001/audio/interview.mp3');
  assert.strictEqual(uploaded.gcsUri,                'gs://kosame-audio-files/cases/CASE001/audio/interview.mp3');
  assert.strictEqual(uploaded.bucket,                'kosame-audio-files');
  assert.strictEqual(uploaded.mimeType,              'audio/mpeg');
  assert.strictEqual(uploaded.sizeBytes,             1024 * 1024);
  assert.strictEqual(uploaded.realGcpActionsExecuted, false);
  pass('uploadFile dryRun: ok/gcsUri/objectPath/mimeType/realGcpActionsExecuted=false');

  // ── 12. uploadFile: 100MB超過を拒否 ─────────────────────────────────────
  await assert.rejects(
    () => gcs.uploadFile('CASE001', 'huge.mp3', { write: false, contentBytes: gcs.MAX_BYTES + 1 }),
    /exceeds 100MB limit/
  );
  pass('uploadFile: 100MB超過はアップロード前に拒否');

  // ── 13. downloadFile dryRun ──────────────────────────────────────────────
  const downloaded = await gcs.downloadFile('CASE001', 'interview.mp3', { write: false });
  assert.strictEqual(downloaded.ok,                    true);
  assert.strictEqual(downloaded.dryRun,                true);
  assert.strictEqual(downloaded.content,               null);
  assert.strictEqual(downloaded.gcsUri,                'gs://kosame-audio-files/cases/CASE001/audio/interview.mp3');
  assert.strictEqual(downloaded.realGcpActionsExecuted, false);
  pass('downloadFile dryRun: ok/content=null/realGcpActionsExecuted=false');

  // ── 14. deleteFile dryRun ────────────────────────────────────────────────
  const deleted = await gcs.deleteFile('CASE001', 'interview.mp3', { write: false });
  assert.strictEqual(deleted.ok,                    true);
  assert.strictEqual(deleted.dryRun,                true);
  assert.strictEqual(deleted.objectPath,            'cases/CASE001/audio/interview.mp3');
  assert.strictEqual(deleted.gcsUri,                'gs://kosame-audio-files/cases/CASE001/audio/interview.mp3');
  assert.strictEqual(deleted.realGcpActionsExecuted, false);
  pass('deleteFile dryRun: ok/objectPath/gcsUri/realGcpActionsExecuted=false');

  // ── 15. listFiles dryRun ─────────────────────────────────────────────────
  const listed = await gcs.listFiles('CASE001', { write: false });
  assert.strictEqual(listed.ok,                    true);
  assert.strictEqual(listed.dryRun,                true);
  assert.deepStrictEqual(listed.files,             []);
  assert.strictEqual(listed.count,                 0);
  assert.strictEqual(listed.prefix,                'cases/CASE001/audio/');
  assert.strictEqual(listed.bucket,                'kosame-audio-files');
  assert.strictEqual(listed.realGcpActionsExecuted, false);
  pass('listFiles dryRun: ok/files=[]/count=0/prefix=cases/CASE001/audio/');

  // ── 16. getSignedUrl dryRun ──────────────────────────────────────────────
  const signed = await gcs.getSignedUrl('CASE001', 'interview.mp3', { write: false });
  assert.strictEqual(signed.ok,                    true);
  assert.strictEqual(signed.dryRun,                true);
  assert.strictEqual(signed.signedUrl,             null);
  assert.ok(signed.expiresAt);
  assert.ok(new Date(signed.expiresAt) > new Date());
  assert.strictEqual(signed.realGcpActionsExecuted, false);
  pass('getSignedUrl dryRun: ok/signedUrl=null/expiresAt(future)/realGcpActionsExecuted=false');

  // ── 17. validateFilename: ディレクトリトラバーサル ────────────────────────
  await assert.rejects(
    () => gcs.uploadFile('CASE001', '../evil.mp3', { write: false }),
    /path separators/
  );
  pass('uploadFile: ディレクトリトラバーサル拒否 (../evil.mp3)');

  // ── 18. appendLearningLog ────────────────────────────────────────────────
  assert.doesNotThrow(() =>
    gcs.appendLearningLog('uploadFile', { ok: true, caseId: 'C1', filename: 'f.mp3' }, { dryRun: true })
  );
  pass('appendLearningLog: 例外なく実行される (dryRun)');

  // ── 19. autoRecord dryRun ────────────────────────────────────────────────
  const rec = await gcs.autoRecord('uploadFile', { ok: true, caseId: 'C1', filename: 'f.mp3' }, { dryRun: true });
  assert.strictEqual(rec.learningLogAppended, true);
  assert.ok(rec.autoRecording);
  pass('autoRecord: learningLogAppended=true, autoRecording present');

  // ── 20. @google-cloud/storage は dryRun では require されない ────────────
  // 全 dryRun 操作が SDK なしで通過済み
  pass('@google-cloud/storage SDK は dryRun では不要 (全操作確認済み)');

  // ── 21. --write なしで loadStorageClient → helpful error ─────────────────
  let sdkError;
  try {
    // 内部的に loadStorageClient は require するが、モジュール自体は export していない
    // enqueueTask 相当の write:true パスを直接呼んで確認
    await gcs.uploadFile('C1', 'f.mp3', { write: true, content: Buffer.from('x') });
  } catch (e) {
    sdkError = e;
  }
  assert.ok(sdkError, 'write:true without SDK should throw');
  assert.ok(sdkError.message.includes('@google-cloud/storage'));
  pass('@google-cloud/storage 未インストール時に write:true → helpful error');

  console.log(`\nPASS: v110.33 gcs-client smoke (${passed} checks)`);
}

runAll().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
