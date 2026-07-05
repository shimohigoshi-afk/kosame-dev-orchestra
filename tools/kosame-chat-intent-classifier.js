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

const TASK_VERB_RE = /(?:作成して|作って|書いて|修正して|直して|直せる|直せます|実装して|追加して|変更して|削除して|消して|直し|実装(?:して)?|生成して|生成)/;
const FILE_PATH_RE = /(?:public|tools|src|smoke|config|docs|scripts)\/[\w\-./]+|\.(?:html?|jsx?|tsx?|css|json|md|py|sh|ya?ml)\b/i;
const DEV_KEYWORD_RE = /\b(?:repo|repository|commit|push|deploy|pull request|PR|branch|merge|verify|smoke|rollback|revert)\b/i;

// Note: no trailing \b — JS regex treats Japanese characters as non-word
// chars, so \b never matches right after them (e.g. /おはよう\b/ silently
// fails to match "おはよう"). Kept exported for callers that want a
// standalone greeting check; classifyIntent() no longer depends on it (see
// below — task evidence is now the only thing that can push a message out
// of casual).
const GREETING_RE = /^(?:おはよう|こんにちは|こんばんは|やあ|お疲れ様|お疲れ|ただいま|hello|hi)\b/i;
const QUESTION_RE = /[?？]\s*$/;

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

  // タスク証拠(実装動詞・ファイルパス・開発キーワード)が一切ない入力は、
  // 疑問文・呼びかけ（「こさめちゃん！いる？」等）・感嘆・？！の連打を
  // 含めて、常に雑談として扱う。以前はここで「質問文でもなく短くもない
  // 長文」を無条件にambiguousへ落としていたため、「こさめちゃん！！！！
  // いる？？？？」のような単純な呼びかけまで確認を挟んでしまっていた。
  if (!hasTaskVerb && !hasFilePath && !hasDevKeyword) {
    return 'casual';
  }

  // 実装動詞があり、かつ対象(ファイルパス/開発キーワード)が明確、または
  // 十分な具体性(長さ)がある場合のみ明確なタスクと判定する。
  if (hasTaskVerb && (hasFilePath || hasDevKeyword || t.length >= 8)) {
    return 'task';
  }

  // ここに到達するのは、タスク証拠が部分的にしかないケース
  // (実装動詞はあるが対象不明、またはファイルパス/開発キーワードへの
  // 言及はあるが動詞がない等)。誤ってdispatchしないよう確認を挟む。
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
