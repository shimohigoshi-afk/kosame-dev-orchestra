#!/usr/bin/env node
'use strict';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildGapItems(stopReason = {}, context = {}) {
  const category = normalizeText(stopReason.category || stopReason.stopReason || 'unknown_failure');
  const workOrderId = normalizeText(context.workOrderId || context.runId || context.id || '');
  const baseItems = {
    safety_stop: [
      '安全停止条件を確認し、対象外の変更を除去する',
      '秘密情報・顧客情報・本番操作が無い経路だけで再投入する',
    ],
    interactive_host: [
      '正規実行ホストのみを使う',
      '対話ホスト経路を隔離する',
    ],
    interactive_prompt: [
      '確認語が出る経路を No-Yes Gate に接続する',
      'ユーザー待ちにしない非対話復帰へ差し替える',
    ],
    runner_timeout: [
      'Runner の進捗と再試行の状態をログ化する',
      'タイムアウト時の再実行経路を復帰させる',
    ],
    result_post_failure: [
      'resultPOST の失敗時に再送経路を記録する',
      'Result Decision の再反映を行う',
    ],
    verify_failed: [
      '落ちた smoke の原因を特定する',
      '不足機能をその場で追加して verify を再実行する',
    ],
    smoke_failed: [
      '古い smoke 互換の期待値を維持しつつ不足機能を追加する',
      '実行ログと console 表示の差分を埋める',
    ],
    forbidden_prompt: [
      '禁止語をテキストから分離する',
      '安全な本文だけを再生成する',
    ],
    unknown_failure: [
      '失敗ログを読み、停止理由を再分類する',
      '不足機能へ変換して再投入する',
    ],
  };
  const tasks = baseItems[category] || baseItems.unknown_failure;
  return {
    gapId: `gap-${Date.now()}`,
    workOrderId,
    category,
    stopReason: stopReason.stopReason || category,
    reason: normalizeText(stopReason.reason || stopReason.summary || 'unknown failure'),
    missingCapability: normalizeText(stopReason.missingCapability || ''),
    summary: normalizeText(stopReason.summary || 'stop reason detected'),
    tasks,
    route: normalizeText(context.route || 'zero-confirm'),
    executor: normalizeText(context.executor || 'claude-zero-confirm'),
    resumeHint: tasks[0] || '復帰経路を作成する',
  };
}

module.exports = {
  buildGapItems,
};
