#!/usr/bin/env node
'use strict';

// Human-wait / confirmation-request phrases that must never appear in work order prompts,
// Console UI, or runner output. Presence of any of these (outside Safety Stop notifications)
// indicates a contract violation.
const HUMAN_WAIT_PATTERNS = [
  { pattern: /YESと返してください|reply\s+YES/i, label: 'reply YES' },
  { pattern: /続けますか/, label: '続けますか' },
  { pattern: /続行してください/, label: '続行してください' },
  { pattern: /承認してください/, label: '承認してください' },
  { pattern: /承認要求/, label: '承認要求' },
  { pattern: /確認してください/, label: '確認してください' },
  { pattern: /権限確認/, label: '権限確認' },
  { pattern: /trust確認/, label: 'trust確認' },
  { pattern: /permission確認/, label: 'permission確認' },
  { pattern: /手動で貼り付けてください/, label: '手動で貼り付けてください' },
  { pattern: /手動貼り付け/i, label: '手動貼り付け' },
  { pattern: /手動確認/i, label: '手動確認' },
  { pattern: /manual paste/i, label: 'manual paste' },
  { pattern: /ユーザー確認待ち/, label: 'ユーザー確認待ち' },
  { pattern: /user confirmation/i, label: 'user confirmation' },
  { pattern: /human\s+wait/i, label: 'human wait' },
  { pattern: /please\s+confirm/i, label: 'please confirm' },
  { pattern: /would you like to continue/i, label: 'would you like to continue' },
  { pattern: /do you want to proceed/i, label: 'do you want to proceed' },
  { pattern: /continue\?/i, label: 'continue?' },
  { pattern: /how is claude doing this session\?/i, label: 'session feedback prompt' },
  { pattern: /\bY\s*\/\s*E\s*\/\s*S\b/i, label: 'Y/E/S' },
  { pattern: /コピペ依頼/i, label: 'コピペ依頼' },
];

const NEGATION_CONTEXT_PATTERNS = [
  /(?:しない|しません|行わない|出さない|禁止|未発動|回避|排除|除外|標準経路から|標準実行経路から|回数|表示|ラベル|route:\s*zero-confirm|avoid|must not|not ask|no ask|zero-confirm|ゼロ固定)/i,
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

function isNegatedConfirmationContext(text, matchIndex, contextRadius = 48) {
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + contextRadius);
  const context = text.slice(start, end);
  return NEGATION_CONTEXT_PATTERNS.some((p) => p.test(context));
}

function lintForHumanWait(text, options = {}) {
  const violations = [];
  const label = options.label || 'text';
  const allowNegatedContext = options.allowNegatedContext !== false;

  for (const { pattern, label: phraseLabel } of HUMAN_WAIT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    if (options.allowSafetyStopContext && isInSafetyStopContext(text, match.index)) continue;
    if (allowNegatedContext && isNegatedConfirmationContext(text, match.index)) continue;
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

function lintForZeroConfirmRequests(text, options = {}) {
  return lintForHumanWait(text, { ...options, allowNegatedContext: options.allowNegatedContext !== false });
}

function assertNoZeroConfirmRequests(text, label = 'text', options = {}) {
  const result = lintForZeroConfirmRequests(text, { ...options, label });
  if (!result.ok) {
    const summary = result.violations.map((v) => `"${v.phrase}"`).join(', ');
    throw new Error(`[prompt-lint] Zero-confirm violation in ${label}: ${summary}`);
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
  '- 機密の値や設定ファイルを読む操作',
  '- 本番deploy / 課金発生 / force push / tag force update',
  '- 広範囲削除 / 対象repo以外の変更',
  '- 対象外プロジェクトの内容を外部へ送らない',
  '',
].join('\n');

const COMPLETE_RUN_FIRST_POLICY = [
  '【Complete-Run First Policy】',
  '- work order採用 → dispatch → runner実行 → lint → smoke → verify → 必要なら自動再修正 → resultPOST → Result Decision Panel更新 → commit候補/ready_for_commit → 最終結果報告',
  '- 懸念点は質問ではなく検証ルート(lint / smoke / verify / diff確認 / dryRun / negative assertion / Actions確認 / safetyPreFlight)で潰す',
  '- Safety Stop 以外の YES確認 / 貼り戻し依頼 / コピペ依頼を出さない',
].join('\n');

const ZERO_CONFIRM_ROUTE_LOCKDOWN = [
  '【Zero-Confirm Route Lockdown】',
  '- 標準executor: claude-zero-confirm',
  '- 標準command: claude --dangerously-skip-permissions -p',
  '- 対話CLI / manual paste / 続行確認 / 承認要求 / 待機要求 を標準経路から排除する',
  '- Console表示は route: zero-confirm / 承認要求回数 / 手動貼付回数 / 待機要求回数 に寄せる',
].join('\n');

module.exports = {
  HUMAN_WAIT_PATTERNS,
  AUTO_YES_CONTRACT,
  COMPLETE_RUN_FIRST_POLICY,
  ZERO_CONFIRM_ROUTE_LOCKDOWN,
  lintForHumanWait,
  assertNoHumanWait,
  lintForZeroConfirmRequests,
  assertNoZeroConfirmRequests,
  isInSafetyStopContext,
};
