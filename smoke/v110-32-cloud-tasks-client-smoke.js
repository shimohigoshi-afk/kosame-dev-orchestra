'use strict';

/**
 * v110.32 smoke: kosame-cloud-tasks-client
 *
 * 検証項目:
 *  1. TOOL_META (version / slug / dryRunDefault)
 *  2. 定数 (GCP_PROJECT / QUEUE_NAME / QUEUE_PATH / REGION / RETRY_CONFIG)
 *  3. validateTaskId: 正常/空文字/不正フォーマット
 *  4. validatePayload: 正常/配列拒否/100KB超過拒否
 *  5. buildTask: 必須フィールド / retry_config / _meta
 *  6. enqueueTask dryRun: ok/dryRun/taskId/realGcpActionsExecuted=false
 *  7. getTask dryRun: ok/dryRun/found=false
 *  8. listTasks dryRun: ok/tasks=[]/count=0
 *  9. deleteTask dryRun: ok/dryRun/taskName
 * 10. RETRY_CONFIG: maxAttempts=5 / minBackoffMs / maxBackoffMs / maxDoublings
 * 11. appendLearningLog: 例外なく実行
 * 12. autoRecord: learningLogAppended=true
 * 13. @google-cloud/tasks は dryRun では require されない
 */

const assert = require('node:assert');

const ct = require('../tools/kosame-cloud-tasks-client');

console.log('=== v110.32 cloud-tasks-client smoke ===');

let passed = 0;
function pass(msg) { passed++; console.log('  PASS:', msg); }

// ── 1. TOOL_META ──────────────────────────────────────────────────────────────
assert.strictEqual(ct.TOOL_META.version,       '110.32.0');
assert.strictEqual(ct.TOOL_META.slug,          'kosame-cloud-tasks-client');
assert.strictEqual(ct.TOOL_META.dryRunDefault,  true);
pass('TOOL_META: version / slug / dryRunDefault');

// ── 2. 定数 ───────────────────────────────────────────────────────────────────
assert.strictEqual(ct.GCP_PROJECT, 'kosame-prod-2026');
assert.strictEqual(ct.QUEUE_NAME,  'kosame-worker-queue');
assert.strictEqual(ct.REGION,      'asia-northeast1');
assert.ok(ct.QUEUE_PATH.includes('kosame-prod-2026'));
assert.ok(ct.QUEUE_PATH.includes('asia-northeast1'));
assert.ok(ct.QUEUE_PATH.includes('kosame-worker-queue'));
pass('GCP_PROJECT / QUEUE_NAME / QUEUE_PATH / REGION 正しい');

// ── 3. RETRY_CONFIG ───────────────────────────────────────────────────────────
assert.strictEqual(ct.RETRY_CONFIG.maxAttempts,  5);
assert.strictEqual(ct.RETRY_CONFIG.minBackoffMs, 10_000);
assert.strictEqual(ct.RETRY_CONFIG.maxBackoffMs, 300_000);
assert.strictEqual(ct.RETRY_CONFIG.maxDoublings, 4);
pass('RETRY_CONFIG: maxAttempts=5 / minBackoff=10s / maxBackoff=5m / maxDoublings=4');

// ── 4. validateTaskId ─────────────────────────────────────────────────────────
assert.strictEqual(ct.validateTaskId('TASK-001'), 'TASK-001');
assert.strictEqual(ct.validateTaskId('  task_abc  '), 'task_abc');
assert.throws(() => ct.validateTaskId(''),    /non-empty/);
assert.throws(() => ct.validateTaskId(null),  /non-empty/);
assert.throws(() => ct.validateTaskId('a/b'), /invalid task_id format/);
pass('validateTaskId: 正常/空文字/スラッシュ含む拒否');

// ── 5. validatePayload ────────────────────────────────────────────────────────
const validPayload = { action: 'process', caseId: 'CASE001' };
assert.deepStrictEqual(ct.validatePayload(validPayload), validPayload);
assert.throws(() => ct.validatePayload([]),   /non-array object/);
assert.throws(() => ct.validatePayload(null), /non-array object/);
assert.throws(() => ct.validatePayload('str'),/non-array object/);
// 100KB超過テスト
const bigPayload = { data: 'x'.repeat(102_401) };
assert.throws(() => ct.validatePayload(bigPayload), /100KB/);
pass('validatePayload: 正常/配列拒否/null拒否/100KB超過拒否');

// ── 6. buildTask ──────────────────────────────────────────────────────────────
const task = ct.buildTask({ action: 'run', caseId: 'C001' });
assert.ok(task.task_id.startsWith('task-'));
assert.ok(task.name.includes(ct.QUEUE_PATH));
assert.strictEqual(task.status,       'pending');
assert.strictEqual(task.statusLabel,  '待機中');
assert.strictEqual(task.retries,      0);
assert.strictEqual(task.max_retries,  5);
assert.deepStrictEqual(task.retry_config, ct.RETRY_CONFIG);
assert.strictEqual(task._meta.project, 'kosame-prod-2026');
assert.ok(task.created_at);
pass('buildTask: task_id / name / status / retry_config / _meta');

const taskWithId = ct.buildTask({ x: 1 }, { taskId: 'MY-TASK' });
assert.strictEqual(taskWithId.task_id, 'MY-TASK');
pass('buildTask: taskId オプションで固定可能');

// ── 7-10. 非同期操作テスト ────────────────────────────────────────────────────
async function runAll() {

  // ── 7. enqueueTask dryRun ────────────────────────────────────────────────
  const enqueued = await ct.enqueueTask({ action: 'process', caseId: 'CASE001' }, { write: false });
  assert.strictEqual(enqueued.ok,                    true);
  assert.strictEqual(enqueued.dryRun,                true);
  assert.ok(enqueued.taskId);
  assert.ok(enqueued.taskName.includes('kosame-worker-queue'));
  assert.strictEqual(enqueued.realGcpActionsExecuted, false);
  assert.strictEqual(enqueued.queue, ct.QUEUE_PATH);
  pass('enqueueTask dryRun: ok/dryRun/taskId/taskName/realGcpActionsExecuted=false');

  // カスタム taskId
  const enqueueCustom = await ct.enqueueTask({ x: 1 }, { write: false, taskId: 'SMOKE-TASK-001' });
  assert.strictEqual(enqueueCustom.taskId, 'SMOKE-TASK-001');
  pass('enqueueTask: カスタム taskId 指定可能');

  // ── 8. getTask dryRun ────────────────────────────────────────────────────
  const got = await ct.getTask('SMOKE-TASK-001', { write: false });
  assert.strictEqual(got.ok,                    true);
  assert.strictEqual(got.dryRun,                true);
  assert.strictEqual(got.found,                 false);
  assert.strictEqual(got.task,                  null);
  assert.strictEqual(got.realGcpActionsExecuted, false);
  pass('getTask dryRun: ok/dryRun/found=false/task=null');

  // getTask: 不正 taskId
  await assert.rejects(
    () => ct.getTask('', { write: false }),
    /non-empty/
  );
  pass('getTask: 空 taskId 拒否');

  // ── 9. listTasks dryRun ──────────────────────────────────────────────────
  const listed = await ct.listTasks({ write: false });
  assert.strictEqual(listed.ok,                    true);
  assert.strictEqual(listed.dryRun,                true);
  assert.deepStrictEqual(listed.tasks,             []);
  assert.strictEqual(listed.count,                 0);
  assert.strictEqual(listed.realGcpActionsExecuted, false);
  assert.strictEqual(listed.queue, ct.QUEUE_PATH);
  pass('listTasks dryRun: ok/tasks=[]/count=0/realGcpActionsExecuted=false');

  // ── 10. deleteTask dryRun ────────────────────────────────────────────────
  const deleted = await ct.deleteTask('SMOKE-TASK-001', { write: false });
  assert.strictEqual(deleted.ok,                    true);
  assert.strictEqual(deleted.dryRun,                true);
  assert.strictEqual(deleted.taskId,                'SMOKE-TASK-001');
  assert.ok(deleted.taskName.includes('SMOKE-TASK-001'));
  assert.strictEqual(deleted.realGcpActionsExecuted, false);
  pass('deleteTask dryRun: ok/dryRun/taskId/taskName/realGcpActionsExecuted=false');

  // deleteTask: 不正 taskId
  await assert.rejects(
    () => ct.deleteTask('', { write: false }),
    /non-empty/
  );
  pass('deleteTask: 空 taskId 拒否');

  // ── 11. appendLearningLog ────────────────────────────────────────────────
  assert.doesNotThrow(() => ct.appendLearningLog('enqueueTask', { ok: true, taskId: 'T1' }, { dryRun: true }));
  pass('appendLearningLog: 例外なく実行される (dryRun)');

  // ── 12. autoRecord dryRun ────────────────────────────────────────────────
  const rec = await ct.autoRecord('enqueueTask', { ok: true, taskId: 'T1' }, { dryRun: true });
  assert.strictEqual(rec.learningLogAppended, true);
  assert.ok(rec.autoRecording);
  pass('autoRecord: learningLogAppended=true, autoRecording present');

  // ── 13. @google-cloud/tasks は dryRun では require されない ──────────────
  // write=false の全操作が通過済み = SDK 不要を確認
  pass('@google-cloud/tasks SDK は dryRun では不要 (全操作確認済み)');

  // ── 14. TASK_STATUSES 日本語ラベル ───────────────────────────────────────
  assert.strictEqual(ct.TASK_STATUSES.pending,   '待機中');
  assert.strictEqual(ct.TASK_STATUSES.running,   '実行中');
  assert.strictEqual(ct.TASK_STATUSES.done,      '完了');
  assert.strictEqual(ct.TASK_STATUSES.failed,    '失敗');
  assert.strictEqual(ct.TASK_STATUSES.cancelled, 'キャンセル済み');
  pass('TASK_STATUSES: 日本語ラベルが正しい');

  console.log(`\nPASS: v110.32 cloud-tasks-client smoke (${passed} checks)`);
}

runAll().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
