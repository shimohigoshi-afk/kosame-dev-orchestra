#!/usr/bin/env node
'use strict';

/**
 * KOSAME GCS Client v110.33.0
 *
 * Google Cloud Storage 連携基盤。音声ファイルのアップロード・ダウンロード・削除・一覧。
 * case_id 単位でフォルダ管理: cases/{case_id}/audio/{filename}
 *
 * dryRun デフォルト。実際の GCS 操作は --write フラグが必要。
 * GCP プロジェクト: kosame-prod-2026
 * バケット: kosame-audio-files
 * ファイルサイズ上限: 100MB
 *
 * 認証: GOOGLE_APPLICATION_CREDENTIALS 環境変数 または
 *       ~/.kosame/credentials.json (KOSAME_CREDENTIALS で上書き可)
 *
 * Usage:
 *   node tools/kosame-gcs-client.js --upload --case-id=CASE001 --file=./audio.mp3
 *   node tools/kosame-gcs-client.js --download --case-id=CASE001 --filename=audio.mp3
 *   node tools/kosame-gcs-client.js --delete --case-id=CASE001 --filename=audio.mp3
 *   node tools/kosame-gcs-client.js --list --case-id=CASE001
 *   node tools/kosame-gcs-client.js --signed-url --case-id=CASE001 --filename=audio.mp3
 *   (--write で実際の GCS 操作)
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version:      '110.33.0',
  feature:      'v110-33-gcs-client',
  slug:         'kosame-gcs-client',
  dryRunDefault: true,
};

const GCP_PROJECT   = 'kosame-prod-2026';
const BUCKET_NAME   = 'kosame-audio-files';
const FOLDER_PREFIX = 'cases';          // cases/{case_id}/audio/{filename}
const AUDIO_SUBDIR  = 'audio';
const MAX_BYTES     = 100 * 1024 * 1024; // 100MB

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

const SUPPORTED_MIME_TYPES = {
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.m4a':  'audio/mp4',
  '.mp4':  'audio/mp4',
  '.ogg':  'audio/ogg',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
  '.aac':  'audio/aac',
};

// ── パスビルダー ───────────────────────────────────────────────────────────────

/**
 * GCS オブジェクトパスを組み立てる。
 * cases/{case_id}/audio/{filename}
 */
function buildObjectPath(caseId, filename) {
  return `${FOLDER_PREFIX}/${caseId}/${AUDIO_SUBDIR}/${filename}`;
}

/**
 * case_id プレフィックスを組み立てる（一覧取得用）。
 * cases/{case_id}/audio/
 */
function buildCasePrefix(caseId) {
  return `${FOLDER_PREFIX}/${caseId}/${AUDIO_SUBDIR}/`;
}

function buildGcsUri(objectPath) {
  return `gs://${BUCKET_NAME}/${objectPath}`;
}

// ── バリデーション ─────────────────────────────────────────────────────────────

function validateCaseId(caseId) {
  if (!caseId || typeof caseId !== 'string' || !caseId.trim()) {
    throw new Error('case_id must be a non-empty string');
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(caseId.trim())) {
    throw new Error(`invalid case_id format: "${caseId}" (alphanumeric, _ and - only, max 128 chars)`);
  }
  return caseId.trim();
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string' || !filename.trim()) {
    throw new Error('filename must be a non-empty string');
  }
  const name = path.basename(filename.trim()); // ディレクトリトラバーサル防止
  if (name !== filename.trim()) {
    throw new Error(`filename must not contain path separators: "${filename}"`);
  }
  if (!/^[A-Za-z0-9._-]{1,255}$/.test(name)) {
    throw new Error(`invalid filename: "${filename}" (alphanumeric, . _ - only, max 255 chars)`);
  }
  return name;
}

function validateFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    throw new Error('file size must be a non-negative number');
  }
  if (bytes > MAX_BYTES) {
    throw new Error(
      `file size ${(bytes / 1024 / 1024).toFixed(2)}MB exceeds 100MB limit`
    );
  }
  return bytes;
}

function detectMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_MIME_TYPES[ext] ?? 'application/octet-stream';
}

// ── GCP クライアント (dryRun 以外で使用) ─────────────────────────────────────

function getCredentialsPath() {
  return (
    process.env.KOSAME_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(KOSAME_DIR, 'credentials.json')
  );
}

function loadStorageClient() {
  try {
    const { Storage } = require('@google-cloud/storage');
    return new Storage({
      projectId:   GCP_PROJECT,
      keyFilename: getCredentialsPath(),
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        '@google-cloud/storage が未インストールです。\n' +
        '  npm install @google-cloud/storage\n' +
        'または dryRun で実行してください（--write なし）。'
      );
    }
    throw e;
  }
}

// ── アップロード ───────────────────────────────────────────────────────────────

/**
 * 音声ファイルをアップロードする。
 *
 * @param {string} caseId      ケース ID
 * @param {string} filename    ファイル名（パス区切りなし）
 * @param {object} opts        { write, localPath, content, contentBytes, now }
 *   localPath    : ローカルファイルパス（write 時に使用）
 *   content      : Buffer または string コンテンツ（write 時の代替）
 *   contentBytes : バイト数（dryRun 時のサイズチェック用）
 */
async function uploadFile(caseId, filename, opts = {}) {
  const { write = false, localPath, content, now } = opts;
  const id   = validateCaseId(caseId);
  const name = validateFilename(filename);
  const objPath  = buildObjectPath(id, name);
  const gcsUri   = buildGcsUri(objPath);
  const mimeType = detectMimeType(name);

  // サイズチェック（dryRun でも実施）
  let sizeBytes = opts.contentBytes ?? null;
  if (sizeBytes === null && localPath && fs.existsSync(localPath)) {
    sizeBytes = fs.statSync(localPath).size;
  }
  if (sizeBytes === null && Buffer.isBuffer(content)) {
    sizeBytes = content.length;
  }
  if (sizeBytes === null && typeof content === 'string') {
    sizeBytes = Buffer.byteLength(content, 'utf8');
  }
  if (sizeBytes !== null) validateFileSize(sizeBytes);

  if (!write) {
    return {
      ok:      true,
      dryRun:  true,
      op:      'uploadFile',
      caseId:  id,
      filename: name,
      objectPath: objPath,
      gcsUri,
      bucket:  BUCKET_NAME,
      mimeType,
      sizeBytes,
      realGcpActionsExecuted: false,
    };
  }

  const storage = loadStorageClient();
  const bucket  = storage.bucket(BUCKET_NAME);
  const file    = bucket.file(objPath);
  const meta    = {
    contentType: mimeType,
    metadata:    { caseId: id, uploadedAt: now || new Date().toISOString() },
  };

  if (localPath) {
    await bucket.upload(localPath, { destination: objPath, metadata: meta });
  } else if (content !== undefined) {
    await file.save(content, { metadata: meta });
  } else {
    throw new Error('--write requires either localPath or content');
  }

  const [fileMeta] = await file.getMetadata();
  return {
    ok:        true,
    dryRun:    false,
    op:        'uploadFile',
    caseId:    id,
    filename:  name,
    objectPath: objPath,
    gcsUri,
    bucket:    BUCKET_NAME,
    mimeType,
    sizeBytes: Number(fileMeta.size) || sizeBytes,
    generation: fileMeta.generation,
    realGcpActionsExecuted: true,
  };
}

// ── ダウンロード ───────────────────────────────────────────────────────────────

/**
 * 音声ファイルをダウンロードする。
 * dryRun 時はメタデータのみ返す（実データは取得しない）。
 *
 * @param {string} caseId
 * @param {string} filename
 * @param {object} opts   { write, destPath }
 */
async function downloadFile(caseId, filename, opts = {}) {
  const { write = false, destPath } = opts;
  const id   = validateCaseId(caseId);
  const name = validateFilename(filename);
  const objPath = buildObjectPath(id, name);
  const gcsUri  = buildGcsUri(objPath);

  if (!write) {
    return {
      ok:        true,
      dryRun:    true,
      op:        'downloadFile',
      caseId:    id,
      filename:  name,
      objectPath: objPath,
      gcsUri,
      bucket:    BUCKET_NAME,
      destPath:  destPath ?? null,
      content:   null,
      realGcpActionsExecuted: false,
    };
  }

  const storage = loadStorageClient();
  const file    = storage.bucket(BUCKET_NAME).file(objPath);
  const [exists] = await file.exists();
  if (!exists) {
    return {
      ok:    false,
      dryRun: false,
      op:    'downloadFile',
      caseId: id,
      filename: name,
      objectPath: objPath,
      gcsUri,
      error: 'file not found',
      realGcpActionsExecuted: true,
    };
  }

  if (destPath) {
    await file.download({ destination: destPath });
    return {
      ok:        true,
      dryRun:    false,
      op:        'downloadFile',
      caseId:    id,
      filename:  name,
      objectPath: objPath,
      gcsUri,
      bucket:    BUCKET_NAME,
      destPath,
      content:   null,
      realGcpActionsExecuted: true,
    };
  }

  const [buf] = await file.download();
  return {
    ok:        true,
    dryRun:    false,
    op:        'downloadFile',
    caseId:    id,
    filename:  name,
    objectPath: objPath,
    gcsUri,
    bucket:    BUCKET_NAME,
    destPath:  null,
    sizeBytes: buf.length,
    content:   buf,
    realGcpActionsExecuted: true,
  };
}

// ── 削除 ──────────────────────────────────────────────────────────────────────

/**
 * 音声ファイルを削除する。
 *
 * @param {string} caseId
 * @param {string} filename
 * @param {object} opts   { write }
 */
async function deleteFile(caseId, filename, opts = {}) {
  const { write = false } = opts;
  const id   = validateCaseId(caseId);
  const name = validateFilename(filename);
  const objPath = buildObjectPath(id, name);
  const gcsUri  = buildGcsUri(objPath);

  if (!write) {
    return {
      ok:        true,
      dryRun:    true,
      op:        'deleteFile',
      caseId:    id,
      filename:  name,
      objectPath: objPath,
      gcsUri,
      bucket:    BUCKET_NAME,
      realGcpActionsExecuted: false,
    };
  }

  const storage = loadStorageClient();
  const file    = storage.bucket(BUCKET_NAME).file(objPath);
  const [exists] = await file.exists();
  if (!exists) {
    return {
      ok:    false,
      dryRun: false,
      op:    'deleteFile',
      caseId: id,
      filename: name,
      objectPath: objPath,
      gcsUri,
      error: 'file not found',
      realGcpActionsExecuted: true,
    };
  }

  await file.delete();
  return {
    ok:        true,
    dryRun:    false,
    op:        'deleteFile',
    caseId:    id,
    filename:  name,
    objectPath: objPath,
    gcsUri,
    bucket:    BUCKET_NAME,
    realGcpActionsExecuted: true,
  };
}

// ── 一覧 ──────────────────────────────────────────────────────────────────────

/**
 * case_id フォルダ内のファイル一覧を取得する。
 * cases/{case_id}/audio/ プレフィックスで検索。
 *
 * @param {string} caseId
 * @param {object} opts   { write, maxResults }
 */
async function listFiles(caseId, opts = {}) {
  const { write = false, maxResults = 100 } = opts;
  const id     = validateCaseId(caseId);
  const prefix = buildCasePrefix(id);

  if (!write) {
    return {
      ok:      true,
      dryRun:  true,
      op:      'listFiles',
      caseId:  id,
      prefix,
      bucket:  BUCKET_NAME,
      files:   [],
      count:   0,
      realGcpActionsExecuted: false,
    };
  }

  const storage = loadStorageClient();
  const [fileObjs] = await storage.bucket(BUCKET_NAME).getFiles({
    prefix,
    maxResults,
  });

  const files = fileObjs.map(f => ({
    filename:   path.basename(f.name),
    objectPath: f.name,
    gcsUri:     buildGcsUri(f.name),
    size:       f.metadata?.size ? Number(f.metadata.size) : null,
    updated:    f.metadata?.updated ?? null,
    mimeType:   f.metadata?.contentType ?? null,
  }));

  return {
    ok:      true,
    dryRun:  false,
    op:      'listFiles',
    caseId:  id,
    prefix,
    bucket:  BUCKET_NAME,
    files,
    count:   files.length,
    realGcpActionsExecuted: true,
  };
}

// ── 署名付き URL ──────────────────────────────────────────────────────────────

/**
 * 署名付きダウンロード URL を生成する（有効期限: 1時間）。
 *
 * @param {string} caseId
 * @param {string} filename
 * @param {object} opts   { write, expiresInMs }
 */
async function getSignedUrl(caseId, filename, opts = {}) {
  const { write = false, expiresInMs = 60 * 60 * 1000 } = opts;
  const id   = validateCaseId(caseId);
  const name = validateFilename(filename);
  const objPath = buildObjectPath(id, name);
  const gcsUri  = buildGcsUri(objPath);
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  if (!write) {
    return {
      ok:         true,
      dryRun:     true,
      op:         'getSignedUrl',
      caseId:     id,
      filename:   name,
      objectPath: objPath,
      gcsUri,
      bucket:     BUCKET_NAME,
      signedUrl:  null,
      expiresAt,
      realGcpActionsExecuted: false,
    };
  }

  const storage = loadStorageClient();
  const file    = storage.bucket(BUCKET_NAME).file(objPath);
  const [url]   = await file.getSignedUrl({
    version: 'v4',
    action:  'read',
    expires: Date.now() + expiresInMs,
  });

  return {
    ok:         true,
    dryRun:     false,
    op:         'getSignedUrl',
    caseId:     id,
    filename:   name,
    objectPath: objPath,
    gcsUri,
    bucket:     BUCKET_NAME,
    signedUrl:  url,
    expiresAt,
    realGcpActionsExecuted: true,
  };
}

// ── Learning-log / autoRecording ──────────────────────────────────────────────

function appendLearningLog(op, result, opts = {}) {
  const { dryRun = true } = opts;
  const entry = {
    ts:         new Date().toISOString(),
    taskType:   'implement',
    difficulty: 'medium',
    model:      'n/a',
    provider:   'gcs',
    costUsd:    null,
    durationMs: null,
    success:    result.ok,
    escalated:  false,
    dryRun,
    taskInput:  `gcs:${op}:${result.caseId ?? ''}/${result.filename ?? ''}`.slice(0, 200),
  };

  try {
    if (!fs.existsSync(KOSAME_DIR)) fs.mkdirSync(KOSAME_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* non-fatal */ }
}

async function autoRecord(op, result, opts = {}) {
  const { dryRun = true } = opts;
  appendLearningLog(op, result, { dryRun });

  let sheetRes = null;
  let docRes   = null;

  try {
    const gdriveWriter = require('./kosame-gdrive-writer');
    const writerOpts = {
      dryRun:  true, // autoRecording は常に dryRun
      tail:    1,
      content: `GCS:${op} caseId=${result.caseId ?? '-'} file=${result.filename ?? '-'} bucket=${BUCKET_NAME}`,
      version: TOOL_META.version,
    };
    sheetRes = await gdriveWriter.writeSheetsRows(writerOpts);
    docRes   = await gdriveWriter.writeDocsEntry(writerOpts);
  } catch { /* non-fatal */ }

  return { learningLogAppended: true, autoRecording: { sheetRes, docRes } };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get  = prefix => (args.find(a => a.startsWith(prefix)) ?? '').slice(prefix.length) || null;
  const has  = flag   => args.includes(flag);

  return {
    upload:    has('--upload'),
    download:  has('--download'),
    delete:    has('--delete'),
    list:      has('--list'),
    signedUrl: has('--signed-url'),
    caseId:    get('--case-id='),
    file:      get('--file='),        // ローカルファイルパス (upload)
    filename:  get('--filename='),    // GCS 上のファイル名
    dest:      get('--dest='),        // ダウンロード先
    write:     has('--write'),
    record:    has('--record'),
  };
}

async function main() {
  const args     = parseArgs(process.argv);
  const write    = args.write;
  const caseId   = args.caseId ?? '';
  const filename = args.filename ?? (args.file ? path.basename(args.file) : '');

  let result;

  if (args.upload) {
    const localPath = args.file ? path.resolve(args.file) : null;
    result = await uploadFile(caseId, filename, { write, localPath });
  } else if (args.download) {
    result = await downloadFile(caseId, filename, { write, destPath: args.dest ?? null });
  } else if (args.delete) {
    result = await deleteFile(caseId, filename, { write });
  } else if (args.list) {
    result = await listFiles(caseId, { write });
  } else if (args.signedUrl) {
    result = await getSignedUrl(caseId, filename, { write });
  } else {
    console.log(JSON.stringify({
      tool:       TOOL_META,
      gcpProject: GCP_PROJECT,
      bucket:     BUCKET_NAME,
      pathPattern: `cases/{case_id}/audio/{filename}`,
      maxFileSizeMB: MAX_BYTES / 1024 / 1024,
      supportedFormats: Object.keys(SUPPORTED_MIME_TYPES),
      usage: [
        '--upload --case-id=CASE001 --file=./audio.mp3',
        '--download --case-id=CASE001 --filename=audio.mp3 [--dest=./out.mp3]',
        '--delete --case-id=CASE001 --filename=audio.mp3',
        '--list --case-id=CASE001',
        '--signed-url --case-id=CASE001 --filename=audio.mp3',
        '(add --write for real GCS operations, --record for learning-log)',
      ],
    }, null, 2));
    return;
  }

  if (args.record) {
    const recording = await autoRecord(result.op, result, { dryRun: !write });
    result._recording = recording;
  }

  console.log(JSON.stringify({ tool: TOOL_META, result }, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}

module.exports = {
  TOOL_META,
  GCP_PROJECT,
  BUCKET_NAME,
  FOLDER_PREFIX,
  AUDIO_SUBDIR,
  MAX_BYTES,
  SUPPORTED_MIME_TYPES,
  buildObjectPath,
  buildCasePrefix,
  buildGcsUri,
  validateCaseId,
  validateFilename,
  validateFileSize,
  detectMimeType,
  uploadFile,
  downloadFile,
  deleteFile,
  listFiles,
  getSignedUrl,
  appendLearningLog,
  autoRecord,
};
