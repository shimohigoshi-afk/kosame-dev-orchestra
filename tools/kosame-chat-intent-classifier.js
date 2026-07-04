#!/usr/bin/env node
'use strict';

// KOSAME chat intent classifier — decides whether a chat message is a genuine
// implementation task (should be dispatched to Runner Queue), casual chat
// (reply only, never dispatch), or ambiguous (ask the user to confirm before
// dispatching).
//
// Historically the only gate was a client-side blacklist of known-casual
// patterns (shouldSkipRunnerDispatch): anything NOT matching a casual pattern
// was dispatched by default. That let short interjections like "眠いよ！" or
// "む" fall through and get sent to zero-confirm dispatch → Runner Queue →
// DeepSeek handoff. This module flips the default: a message is only
// classified as a task when it positively matches task-like signals.

const TASK_VERB_RE = /(?:作成して|作って|書いて|修正して|直して|実装して|追加して|変更して|削除して|消して|直し|実装(?:して)?|生成して|生成)/;
const FILE_PATH_RE = /(?:public|tools|src|smoke|config|docs|scripts)\/[\w\-./]+|\.(?:html?|jsx?|tsx?|css|json|md|py|sh|ya?ml)\b/i;
const DEV_KEYWORD_RE = /\b(?:repo|repository|commit|push|deploy|pull request|PR|branch|merge|verify|smoke|rollback|revert)\b/i;

// Note: no trailing \b — JS regex treats Japanese characters as non-word
// chars, so \b never matches right after them (e.g. /おはよう\b/ silently
// fails to match "おはよう").
const GREETING_RE = /^(?:おはよう|こんにちは|こんばんは|やあ|お疲れ様|お疲れ|ただいま|hello|hi)\b/i;
const QUESTION_RE = /[?？]\s*$/;
const SHORT_CASUAL_MAX_LEN = 8;

/**
 * @param {string} text
 * @returns {'task'|'casual'|'ambiguous'}
 */
function classifyIntent(text) {
  const t = String(text || '').trim();
  if (!t) return 'casual';

  const hasTaskVerb = TASK_VERB_RE.test(t);
  const hasFilePath = FILE_PATH_RE.test(t);
  const hasDevKeyword = DEV_KEYWORD_RE.test(t);

  // 実装動詞 + (ファイルパス/開発キーワードへの言及、または十分な具体性) → タスク
  if (hasTaskVerb && (hasFilePath || hasDevKeyword || t.length >= 8)) {
    return 'task';
  }

  // 明確な雑談パターン: 挨拶・質問・短い相槌や感情表現
  if (GREETING_RE.test(t)) return 'casual';
  if (QUESTION_RE.test(t)) return 'casual';
  if (t.length <= SHORT_CASUAL_MAX_LEN) return 'casual';

  // ここまでで弾かれなかった、ある程度長さのある宣言的な文
  // (実装動詞はないがファイルパス/開発キーワードに触れている、または
  // 単に短い雑談パターンに当てはまらない長文) は、
  // 誤ってdispatchするリスクを避けるためグレーゾーンとして確認を挟む。
  return 'ambiguous';
}

function isTaskIntent(text) {
  return classifyIntent(text) === 'task';
}

module.exports = {
  classifyIntent,
  isTaskIntent,
  TASK_VERB_RE,
  FILE_PATH_RE,
  DEV_KEYWORD_RE,
  GREETING_RE,
  QUESTION_RE,
};
