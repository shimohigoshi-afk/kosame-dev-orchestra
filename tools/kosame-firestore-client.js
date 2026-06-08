#!/usr/bin/env node
'use strict';

/**
 * KOSAME Firestore Client v110.32.0
 *
 * case_id 単位の状態管理。
 * ステータス: 受付済み / 処理中 / AI処理完了 / 人間確認待ち / 完了 / 失敗
 *
 * dryRun デフォルト。実際の Firestore 書き込みは --write フラグが必要。
 * GCP プロジェクト: kosame-prod-2026
 *
 * 認証: GOOGLE_APPLICATION_CREDENTIALS 環境変数 または
 *       ~/.kosame/credentials.json (KOSAME_CREDENTIALS で上書き可)
 *
 * Usage:
 *   node tools/kosame-firestore-client.js --create --case-id=CASE001 [--data='{"key":"val"}']
 *   node tools/kosame-firestore-client.js --get --case-id=CASE001
 *   node tools/kosame-firestore-client.js --update-status=ai_completed --case-id=CASE001
 *   node tools/kosame-firestore-client.js --list [--status=processing]
 *   (--write で実際の GCP 操作、--dry-run で確認)
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version:  '110.32.0',
  feature:  'v110-32-firestore-client',
  slug:     'kosame-firestore-client',
  dryRunDefault: true,
};

const GCP_PROJECT  = 'kosame-prod-2026';
const COLLECTION   = 'cases';
const REGION       = 'asia-northeast1';

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

// ── ステータス定義 ─────────────────────────────────────────────────────────────

const CASE_STATUSES = {
  received:    '受付済み',
  processing:  '処理中',
  ai_completed:'AI処理完了',
  human_review:'人間確認待ち',
  completed:   '完了',
  failed:      '失敗',
};

const STATUS_TRANSITIONS = {
  received:     ['processing', 'failed'],
  processing:   ['ai_completed', 'failed'],
  ai_completed: ['human_review', 'completed', 'failed'],
  human_review: ['completed', 'failed'],
  completed:    [],
  failed:       ['received'],
};

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

function validateStatus(status) {
  if (!Object.prototype.hasOwnProperty.call(CASE_STATUSES, status)) {
    throw new Error(`invalid status: "${status}". valid values: ${Object.keys(CASE_STATUSES).join(', ')}`);
  }
  return status;
}

function validateTransition(fromStatus, toStatus) {
  if (!fromStatus) return; // 新規作成は常に OK
  const allowed = STATUS_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `invalid status transition: ${fromStatus} → ${toStatus}. ` +
      `allowed: ${allowed.length ? allowed.join(', ') : '(terminal state)'}`
    );
  }
}

// ── ドキュメントビルダー ───────────────────────────────────────────────────────

function buildCaseDoc(caseId, data = {}, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const status = opts.status || 'received';
  return {
    case_id:    validateCaseId(caseId),
    status:     validateStatus(status),
    statusLabel: CASE_STATUSES[status],
    created_at: now,
    updated_at: now,
    history:    [{ status, statusLabel: CASE_STATUSES[status], ts: now, meta: {} }],
    data:       { ...data },
    _meta: {
      collection: COLLECTION,
      project:    GCP_PROJECT,
      version:    TOOL_META.version,
    },
  };
}

// ── GCP クライアント (dryRun 以外で使用) ─────────────────────────────────────

function getCredentialsPath() {
  return (
    process.env.KOSAME_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(KOSAME_DIR, 'credentials.json')
  );
}

function loadFirestoreClient() {
  try {
    const { Firestore } = require('@google-cloud/firestore');
    return new Firestore({
      projectId: GCP_PROJECT,
      keyFilename: getCredentialsPath(),
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        '@google-cloud/firestore が未インストールです。\n' +
        '  npm install @google-cloud/firestore\n' +
        'または dryRun で実行してください（--write なし）。'
      );
    }
    throw e;
  }
}

// ── CRUD 操作 ─────────────────────────────────────────────────────────────────

/**
 * ケースを新規作成する。
 *
 * @param {string} caseId   ケース ID
 * @param {object} data     任意のメタデータ
 * @param {object} opts     { write, now }
 */
async function createCase(caseId, data = {}, opts = {}) {
  const { write = false } = opts;
  const doc = buildCaseDoc(caseId, data, opts);

  if (!write) {
    return {
      ok:      true,
      dryRun:  true,
      op:      'createCase',
      caseId:  doc.case_id,
      status:  doc.status,
      doc,
      path:    `projects/${GCP_PROJECT}/databases/(default)/documents/${COLLECTION}/${doc.case_id}`,
      humanGate: false,
      realGcpActionsExecuted: false,
    };
  }

  const db   = loadFirestoreClient();
  const ref  = db.collection(COLLECTION).doc(doc.case_id);
  await ref.create(doc);

  return {
    ok:      true,
    dryRun:  false,
    op:      'createCase',
    caseId:  doc.case_id,
    status:  doc.status,
    doc,
    path:    ref.path,
    humanGate: false,
    realGcpActionsExecuted: true,
  };
}

/**
 * ケースを取得する。
 *
 * @param {string} caseId
 * @param {object} opts   { write }
 */
async function getCase(caseId, opts = {}) {
  const { write = false } = opts;
  const id = validateCaseId(caseId);

  if (!write) {
    return {
      ok:      true,
      dryRun:  true,
      op:      'getCase',
      caseId:  id,
      doc:     null,
      found:   false,
      path:    `projects/${GCP_PROJECT}/databases/(default)/documents/${COLLECTION}/${id}`,
      realGcpActionsExecuted: false,
    };
  }

  const db   = loadFirestoreClient();
  const ref  = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();

  return {
    ok:      true,
    dryRun:  false,
    op:      'getCase',
    caseId:  id,
    doc:     snap.exists ? snap.data() : null,
    found:   snap.exists,
    path:    ref.path,
    realGcpActionsExecuted: true,
  };
}

/**
 * ステータスを更新する。
 *
 * @param {string} caseId
 * @param {string} status  CASE_STATUSES のキー
 * @param {object} meta    追加情報
 * @param {object} opts    { write, skipTransitionCheck }
 */
async function updateStatus(caseId, status, meta = {}, opts = {}) {
  const { write = false, skipTransitionCheck = false } = opts;
  const id  = validateCaseId(caseId);
  const st  = validateStatus(status);
  const now = opts.now || new Date().toISOString();

  if (!write) {
    return {
      ok:         true,
      dryRun:     true,
      op:         'updateStatus',
      caseId:     id,
      status:     st,
      statusLabel: CASE_STATUSES[st],
      updatedAt:  now,
      meta,
      humanGate:  st === 'human_review',
      realGcpActionsExecuted: false,
    };
  }

  const db   = loadFirestoreClient();
  const ref  = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: false, dryRun: false, op: 'updateStatus', caseId: id, error: 'case not found' };
  }

  const current = snap.data();
  if (!skipTransitionCheck) {
    validateTransition(current.status, st);
  }

  const historyEntry = { status: st, statusLabel: CASE_STATUSES[st], ts: now, meta };
  await ref.update({
    status:      st,
    statusLabel: CASE_STATUSES[st],
    updated_at:  now,
    history:     [...(current.history ?? []), historyEntry],
  });

  return {
    ok:         true,
    dryRun:     false,
    op:         'updateStatus',
    caseId:     id,
    status:     st,
    statusLabel: CASE_STATUSES[st],
    updatedAt:  now,
    meta,
    humanGate:  st === 'human_review',
    realGcpActionsExecuted: true,
  };
}

/**
 * ケース一覧を取得する。
 *
 * @param {object} filter  { status, limit }
 * @param {object} opts    { write }
 */
async function listCases(filter = {}, opts = {}) {
  const { write = false } = opts;
  const { status, limit = 20 } = filter;

  if (status) validateStatus(status);

  if (!write) {
    return {
      ok:      true,
      dryRun:  true,
      op:      'listCases',
      cases:   [],
      count:   0,
      filter,
      collection: `projects/${GCP_PROJECT}/databases/(default)/documents/${COLLECTION}`,
      realGcpActionsExecuted: false,
    };
  }

  const db  = loadFirestoreClient();
  let query = db.collection(COLLECTION).limit(limit);
  if (status) query = query.where('status', '==', status);

  const snap  = await query.get();
  const cases = snap.docs.map(d => d.data());

  return {
    ok:      true,
    dryRun:  false,
    op:      'listCases',
    cases,
    count:   cases.length,
    filter,
    collection: `projects/${GCP_PROJECT}/databases/(default)/documents/${COLLECTION}`,
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
    provider:   'firestore',
    costUsd:    null,
    durationMs: null,
    success:    result.ok,
    escalated:  false,
    dryRun,
    taskInput:  `firestore:${op}:${result.caseId ?? ''}`.slice(0, 200),
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
      content: `Firestore:${op} caseId=${result.caseId ?? '-'} status=${result.status ?? '-'}`,
      version: TOOL_META.version,
    };
    sheetRes = await gdriveWriter.writeSheetsRows(writerOpts);
    docRes   = await gdriveWriter.writeDocsEntry(writerOpts);
  } catch { /* non-fatal */ }

  return { learningLogAppended: true, autoRecording: { sheetRes, docRes } };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args  = argv.slice(2);
  const get   = prefix => (args.find(a => a.startsWith(prefix)) ?? '').slice(prefix.length) || null;
  const has   = flag  => args.includes(flag);

  return {
    create:       has('--create'),
    get:          has('--get'),
    list:         has('--list'),
    updateStatus: get('--update-status='),
    caseId:       get('--case-id='),
    dataStr:      get('--data='),
    statusFilter: get('--status='),
    write:        has('--write'),
    record:       has('--record'),
  };
}

async function main() {
  const args   = parseArgs(process.argv);
  const write  = args.write;
  const caseId = args.caseId;

  let result;

  if (args.create) {
    const data = args.dataStr ? JSON.parse(args.dataStr) : {};
    result = await createCase(caseId ?? `CASE-${Date.now()}`, data, { write });
  } else if (args.get) {
    result = await getCase(caseId ?? '', { write });
  } else if (args.updateStatus) {
    result = await updateStatus(caseId ?? '', args.updateStatus, {}, { write });
  } else if (args.list) {
    const filter = {};
    if (args.statusFilter) filter.status = args.statusFilter;
    result = await listCases(filter, { write });
  } else {
    console.log(JSON.stringify({
      tool:      TOOL_META,
      gcpProject: GCP_PROJECT,
      collection: COLLECTION,
      statuses:  CASE_STATUSES,
      usage: [
        '--create --case-id=CASE001 [--data=\'{"key":"val"}\']',
        '--get --case-id=CASE001',
        '--update-status=ai_completed --case-id=CASE001',
        '--list [--status=processing]',
        '(add --write for real GCP operations)',
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
  COLLECTION,
  REGION,
  CASE_STATUSES,
  STATUS_TRANSITIONS,
  validateCaseId,
  validateStatus,
  validateTransition,
  buildCaseDoc,
  createCase,
  getCase,
  updateStatus,
  listCases,
  appendLearningLog,
  autoRecord,
};
