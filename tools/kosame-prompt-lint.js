#!/usr/bin/env node
'use strict';

// Human-wait phrases that must never appear in work order prompts, Console UI, or runner output.
// Presence of any of these (outside Safety Stop notifications) indicates a contract violation.
const HUMAN_WAIT_PATTERNS = [
  { pattern: /YESと返してください|reply\s+YES/i, label: 'reply YES' },
  { pattern: /続けますか/, label: '続けますか' },
  { pattern: /承認してください/, label: '承認してください' },
  { pattern: /手動で貼り付けてください/, label: '手動で貼り付けてください' },
  { pattern: /ユーザー確認待ち/, label: 'ユーザー確認待ち' },
  { pattern: /human\s+wait/i, label: 'human wait' },
  { pattern: /please\s+confirm/i, label: 'please confirm' },
  { pattern: /continue\?/i, label: 'continue?' },
];

// Phrases allowed ONLY in Safety Stop notifications (not in regular flow)
const SAFETY_STOP_EXEMPT_PATTERNS = [
  /SAFETY\s+STOP|Safety\s+Stop|安全停止/,
  /safety_stop|safetyStop/,
];

function isInSafetyStopContext(text, matchIndex, contextRadius = 200) {
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + contextRadius);
  const context = text.slice(start, end);
  return SAFETY_STOP_EXEMPT_PATTERNS.some((p) => p.test(context));
}

function lintForHumanWait(text, options = {}) {
  const violations = [];
  const label = options.label || 'text';

  for (const { pattern, label: phraseLabel } of HUMAN_WAIT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    if (options.allowSafetyStopContext && isInSafetyStopContext(text, match.index)) continue;
    violations.push({ phrase: phraseLabel, match: match[0], index: match.index });
  }

  return {
    ok: violations.length === 0,
    violations,
    label,
  };
}

function assertNoHumanWait(text, label = 'text', options = {}) {
  const result = lintForHumanWait(text, { ...options, label });
  if (!result.ok) {
    const summary = result.violations.map((v) => `"${v.phrase}"`).join(', ');
    throw new Error(`[prompt-lint] Human-wait violation in ${label}: ${summary}`);
  }
  return result;
}

// Auto-YES Runtime Contract text injected at the top of every work order prompt.
const AUTO_YES_CONTRACT = [
  '【Auto-YES Runtime Contract】',
  '通常作業はYES前提で最後まで完走する。',
  '- YES確認・続行確認・承認要求・コピペ依頼をユーザーへ行わない',
  '- 修正→テスト→再修正→verify→smoke→commit→tag→push→Actions確認→結果報告まで進める',
  '- 迷ったら安全側の代替案で進む。ユーザーへ聞かない。',
  '【Safety Stop条件（これのみ停止可）】',
  '- 機密情報/環境変数ファイル/認証情報/APIキーを読む操作',
  '- 本番deploy / 課金発生 / force push / tag force update',
  '- 広範囲削除 / 対象repo以外の変更',
  '- Sales DX/transcriber/顧客情報を外部AIへ送信',
  '',
].join('\n');

const COMPLETE_RUN_FIRST_POLICY = [
  '【Complete-Run First Policy】',
  '- work order採用 → dispatch → runner実行 → lint → smoke → verify → 必要なら自動再修正 → resultPOST → Result Decision Panel更新 → commit候補/ready_for_commit → 最終結果報告',
  '- 懸念点は質問ではなく検証ルート(lint / smoke / verify / diff確認 / dryRun / negative assertion / Actions確認 / safetyPreFlight)で潰す',
  '- Safety Stop 以外の YES確認 / 貼り戻し依頼 / コピペ依頼を出さない',
].join('\n');

module.exports = {
  HUMAN_WAIT_PATTERNS,
  AUTO_YES_CONTRACT,
  COMPLETE_RUN_FIRST_POLICY,
  lintForHumanWait,
  assertNoHumanWait,
  isInSafetyStopContext,
};
