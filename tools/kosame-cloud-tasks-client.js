#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cloud Tasks Client v110.32.0
 *
 * 非同期処理キューの登録・管理・リトライ自動化。
 *
 * dryRun デフォルト。実際の Cloud Tasks 操作は --write フラグが必要。
 * GCP プロジェクト: kosame-prod-2026
 * キュー: kosame-worker-queue (asia-northeast1)
 *
 * リトライ設定:
 *   - maxAttempts: 5
 *   - minBackoff: 10s
 *   - maxBackoff: 300s (5分)
 *   - maxDoublings: 4
 *
 * 認証: GOOGLE_APPLICATION_CREDENTIALS 環境変数 または
 *       ~/.kosame/credentials.json (KOSAME_CREDENTIALS で上書き可)
 *
 * Usage:
 *   node tools/kosame-cloud-tasks-client.js --enqueue --payload='{"task":"..."}'
 *   node tools/kosame-cloud-tasks-client.js --get --task-id=TASK001
 *   node tools/kosame-cloud-tasks-client.js --list
 *   node tools/kosame-cloud-tasks-client.js --delete --task-id=TASK001
 *   (--write で実際の GCP 操作)
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const { randomUUID } = require('node:crypto');

const TOOL_META = {
  version:  '110.32.0',
  feature:  'v110-32-cloud-tasks-client',
  slug:     'kosame-cloud-tasks-client',
  dryRunDefault: true,
};

const GCP_PROJECT  = 'kosame-prod-2026';
const QUEUE_NAME   = 'kosame-worker-queue';
const REGION       = 'asia-northeast1';
const QUEUE_PATH   = `projects/${GCP_PROJECT}/locations/${REGION}/queues/${QUEUE_NAME}`;

const RETRY_CONFIG = {
  maxAttempts:  5,
  minBackoffMs: 10_000,    // 10秒
  maxBackoffMs: 300_000,   // 5分
  maxDoublings: 4,
};

const TASK_STATUSES = {
  pending:    '待機中',
  running:    '実行中',
  done:       '完了',
  failed:     '失敗',
  cancelled:  'キャンセル済み',
};

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

// ── バリデーション ─────────────────────────────────────────────────────────────

function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string' || !taskId.trim()) {
    throw new Error('task_id must be a non-empty string');
  }
  if (!/^[A-Za-z0-9_-]{1,500}$/.test(taskId.trim())) {
    throw new Error(`invalid task_id format: "${taskId}"`);
  }
  return taskId.trim();
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload must be a non-array object');
  }
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, 'utf8') > 102_400) {
    throw new Error('payload exceeds 100KB Cloud Tasks limit');
  }
  return payload;
}

// ── タスクビルダー ─────────────────────────────────────────────────────────────

function buildTask(payload, opts = {}) {
  const now    = opts.now || new Date().toISOString();
  const taskId = opts.taskId || `task-${randomUUID()}`;
  const scheduleAt = opts.scheduleAt || now;

  return {
    task_id:      taskId,
    name:         `${QUEUE_PATH}/tasks/${taskId}`,
    queue:        QUEUE_PATH,
    status:       'pending',
    statusLabel:  TASK_STATUSES.pending,
    payload:      validatePayload(payload),
    created_at:   now,
    schedule_time: scheduleAt,
    retries:      0,
    max_retries:  RETRY_CONFIG.maxAttempts,
    retry_config: { ...RETRY_CONFIG },
    _meta: {
      project: GCP_PROJECT,
      region:  REGION,
      version: TOOL_META.version,
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

function loadCloudTasksClient() {
  try {
    const { CloudTasksClient } = require('@google-cloud/tasks');
    return new CloudTasksClient({ keyFilename: getCredentialsPath() });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        '@google-cloud/tasks が未インストールです。\n' +
        '  npm install @google-cloud/tasks\n' +
        'または dryRun で実行してください（--write なし）。'
      );
    }
    throw e;
  }
}

// ── キュー操作 ────────────────────────────────────────────────────────────────

/**
 * タスクをキューに登録する。
 *
 * @param {object} payload   タスクペイロード
 * @param {object} opts      { write, taskId, scheduleAt, now }
 */
async function enqueueTask(payload, opts = {}) {
  const { write = false } = opts;
  const task = buildTask(payload, opts);

  if (!write) {
    return {
      ok:       true,
      dryRun:   true,
      op:       'enqueueTask',
      taskId:   task.task_id,
      taskName: task.name,
      task,
      queue:    QUEUE_PATH,
      realGcpActionsExecuted: false,
    };
  }

  const client = loadCloudTasksClient();
  const body   = Buffer.from(JSON.stringify(task.payload)).toString('base64');

  const [response] = await client.createTask({
    parent: QUEUE_PATH,
    task: {
      name: task.name,
      httpRequest: {
        httpMethod: 'POST',
        url: opts.handlerUrl || `https://${REGION}-${GCP_PROJECT}.cloudfunctions.net/kosame-worker`,
        body,
        headers: { 'Content-Type': 'application/json' },
      },
      scheduleTime: { seconds: Math.floor(new Date(task.schedule_time).getTime() / 1000) },
    },
  });

  return {
    ok:       true,
    dryRun:   false,
    op:       'enqueueTask',
    taskId:   task.task_id,
    taskName: response.name,
    task,
    queue:    QUEUE_PATH,
    realGcpActionsExecuted: true,
  };
}

/**
 * タスクを取得する。
 *
 * @param {string} taskId
 * @param {object} opts   { write }
 */
async function getTask(taskId, opts = {}) {
  const { write = false } = opts;
  const id = validateTaskId(taskId);

  if (!write) {
    return {
      ok:     true,
      dryRun: true,
      op:     'getTask',
      taskId: id,
      task:   null,
      found:  false,
      queue:  QUEUE_PATH,
      realGcpActionsExecuted: false,
    };
  }

  const client   = loadCloudTasksClient();
  const taskName = `${QUEUE_PATH}/tasks/${id}`;

  try {
    const [task] = await client.getTask({ name: taskName });
    return {
      ok:     true,
      dryRun: false,
      op:     'getTask',
      taskId: id,
      task,
      found:  true,
      queue:  QUEUE_PATH,
      realGcpActionsExecuted: true,
    };
  } catch (e) {
    if (e.code === 5) { // NOT_FOUND
      return { ok: true, dryRun: false, op: 'getTask', taskId: id, task: null, found: false, queue: QUEUE_PATH, realGcpActionsExecuted: true };
    }
    throw e;
  }
}

/**
 * キュー内のタスク一覧を取得する。
 *
 * @param {object} opts  { write, pageSize }
 */
async function listTasks(opts = {}) {
  const { write = false, pageSize = 20 } = opts;

  if (!write) {
    return {
      ok:     true,
      dryRun: true,
      op:     'listTasks',
      tasks:  [],
      count:  0,
      queue:  QUEUE_PATH,
      realGcpActionsExecuted: false,
    };
  }

  const client = loadCloudTasksClient();
  const [tasks] = await client.listTasks({ parent: QUEUE_PATH, pageSize });

  return {
    ok:     true,
    dryRun: false,
    op:     'listTasks',
    tasks,
    count:  tasks.length,
    queue:  QUEUE_PATH,
    realGcpActionsExecuted: true,
  };
}

/**
 * タスクを削除（キャンセル）する。
 *
 * @param {string} taskId
 * @param {object} opts   { write }
 */
async function deleteTask(taskId, opts = {}) {
  const { write = false } = opts;
  const id = validateTaskId(taskId);

  if (!write) {
    return {
      ok:       true,
      dryRun:   true,
      op:       'deleteTask',
      taskId:   id,
      taskName: `${QUEUE_PATH}/tasks/${id}`,
      queue:    QUEUE_PATH,
      realGcpActionsExecuted: false,
    };
  }

  const client   = loadCloudTasksClient();
  const taskName = `${QUEUE_PATH}/tasks/${id}`;
  await client.deleteTask({ name: taskName });

  return {
    ok:       true,
    dryRun:   false,
    op:       'deleteTask',
    taskId:   id,
    taskName,
    queue:    QUEUE_PATH,
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
    provider:   'cloud-tasks',
    costUsd:    null,
    durationMs: null,
    success:    result.ok,
    escalated:  false,
    dryRun,
    taskInput:  `cloud-tasks:${op}:${result.taskId ?? ''}`.slice(0, 200),
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
      content: `CloudTasks:${op} taskId=${result.taskId ?? '-'} queue=${QUEUE_NAME}`,
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
  const has  = flag  => args.includes(flag);

  return {
    enqueue:    has('--enqueue'),
    get:        has('--get'),
    list:       has('--list'),
    delete:     has('--delete'),
    taskId:     get('--task-id='),
    payloadStr: get('--payload='),
    scheduleAt: get('--schedule-at='),
    handlerUrl: get('--handler-url='),
    write:      has('--write'),
    record:     has('--record'),
  };
}

async function main() {
  const args  = parseArgs(process.argv);
  const write = args.write;

  let result;

  if (args.enqueue) {
    const payload = args.payloadStr ? JSON.parse(args.payloadStr) : { source: 'cli' };
    result = await enqueueTask(payload, {
      write,
      taskId:     args.taskId || undefined,
      scheduleAt: args.scheduleAt || undefined,
      handlerUrl: args.handlerUrl || undefined,
    });
  } else if (args.get) {
    result = await getTask(args.taskId ?? '', { write });
  } else if (args.list) {
    result = await listTasks({ write });
  } else if (args.delete) {
    result = await deleteTask(args.taskId ?? '', { write });
  } else {
    console.log(JSON.stringify({
      tool:       TOOL_META,
      gcpProject: GCP_PROJECT,
      queue:      QUEUE_PATH,
      retryConfig: RETRY_CONFIG,
      usage: [
        "--enqueue --payload='{\"task\":\"...\"}' [--task-id=ID] [--schedule-at=ISO8601]",
        '--get --task-id=TASK001',
        '--list',
        '--delete --task-id=TASK001',
        '(add --write for real GCP operations, --record for learning-log)',
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
  QUEUE_NAME,
  QUEUE_PATH,
  REGION,
  RETRY_CONFIG,
  TASK_STATUSES,
  validateTaskId,
  validatePayload,
  buildTask,
  enqueueTask,
  getTask,
  listTasks,
  deleteTask,
  appendLearningLog,
  autoRecord,
};
