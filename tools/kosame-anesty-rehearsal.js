#!/usr/bin/env node
'use strict';

/**
 * KOSAME ANESTY Rehearsal v110.52.0
 *
 * ANESTY連携に向けたリハーサル用軽量スクリプト。
 * 実際の業務フロー（Router -> Security -> Worker -> Delivery）をシミュレートする。
 */

const router = require('./kosame-smart-task-router');
const autoDev = require('./kosame-auto-dev');

const TOOL_META = {
  version: '110.52.0',
  feature: 'v110-52-anesty-rehearsal',
  slug:    'kosame-anesty-rehearsal',
};

/**
 * リハーサルタスクを実行する
 */
async function runRehearsal(specText, opts = {}) {
  const { project = 'anesty-board', dryRun = true } = opts;

  console.log(`\n⬡ KOSAME ANESTY Rehearsal v${TOOL_META.version}`);
  console.log(`  project: ${project}  dryRun: ${dryRun}`);
  console.log(`  ────────────────────────────────────────────────`);

  // 1. Router によるワーカー決定
  console.log(`  📋 タスク解析中...`);
  const task = {
    title: 'Anesty Rehearsal Task',
    description: specText,
    difficulty: 'light',
  };

  const route = await router.assignWorker(task, { project, specText, dryRun });
  console.log(`     ワーカー: ${route.primary} (理由: ${route.reason})`);

  if (route.humanGate) {
    console.log(`     ⚠️ HUMAN_GATE_REQUIRED: ${route.reason}`);
    return { ok: false, reason: route.reason, humanGate: true };
  }

  // 2. Worker による実装実行
  console.log(`  🚀 実行開始...`);
  const result = await autoDev.executeWithWorker(task, route.primary, { project, dryRun, specText });

  if (!result.success) {
    console.log(`     ✗ 失敗: ${result.output}`);
    return { ok: false, reason: result.output, humanGate: result.humanGate };
  }

  // 3. 納品品質チェック (Delivery Check)
  console.log(`  📊 品質チェック中...`);
  const tasks = [{ ...task, verifyPass: result.success, fixed: !result.dryRun }];
  const review = await autoDev.reviewAllResults(tasks, { dryRun, config: {} });

  if (review.deliveryReady) {
    console.log(`  ✅ 納品準備完了 (Score: ${review.avgScore}/100)`);
    return { ok: true, score: review.avgScore, deliveryReady: true };
  } else {
    console.log(`  ✗ 承認否決: ${review.decisionReason}`);
    return { ok: false, reason: review.decisionReason, deliveryReady: false };
  }
}

// CLI 実行用
if (require.main === module) {
  const spec = process.argv[2] || 'AnestyボードのUI表示を微調整する';
  runRehearsal(spec, { dryRun: true }).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  runRehearsal,
};
