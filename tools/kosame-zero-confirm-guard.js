#!/usr/bin/env node
'use strict';

const ZERO_CONFIRM_EXECUTOR = 'claude-zero-confirm';
const ZERO_CONFIRM_ROUTE = 'zero-confirm';
const ZERO_CONFIRM_COMMAND = ['claude', '--dangerously-skip-permissions', '-p'];

const ZERO_CONFIRM_REQUEST_PATTERNS = [
  { pattern: /続けますか/i, label: '続けますか' },
  { pattern: /続行してください/i, label: '続行してください' },
  { pattern: /確認してください/i, label: '確認してください' },
  { pattern: /承認してください/i, label: '承認してください' },
  { pattern: /承認要求/i, label: '承認要求' },
  { pattern: /権限確認/i, label: '権限確認' },
  { pattern: /trust確認/i, label: 'trust確認' },
  { pattern: /permission確認/i, label: 'permission確認' },
  { pattern: /user confirmation/i, label: 'user confirmation' },
  { pattern: /human wait/i, label: 'human wait' },
  { pattern: /手動で貼り付け(?:てください|てください。|依頼|してください)?/i, label: '手動貼り付け依頼' },
  { pattern: /手動確認/i, label: '手動確認' },
  { pattern: /貼り戻して(?:ください|)/i, label: '貼り戻し依頼' },
  { pattern: /manual paste/i, label: 'manual paste' },
  { pattern: /please confirm/i, label: 'please confirm' },
  { pattern: /would you like to continue/i, label: 'would you like to continue' },
  { pattern: /do you want to proceed/i, label: 'do you want to proceed' },
  { pattern: /reply\s+YES/i, label: 'reply YES' },
  { pattern: /how is claude doing this session\?/i, label: 'session feedback prompt' },
  { pattern: /\bY\s*\/\s*E\s*\/\s*S\b/i, label: 'Y/E/S' },
  { pattern: /コピペ依頼/i, label: 'コピペ依頼' },
];

const NEGATION_CONTEXT_PATTERNS = [
  /(?:しない|しません|行わない|出さない|禁止|未発動|回避|排除|除外|標準経路から|標準実行経路から|回数|表示|ラベル|route:\s*zero-confirm|avoid|must not|not ask|no ask|zero-confirm|ゼロ固定)/i,
];

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function isNegatedContext(text, index, radius = 48) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const context = text.slice(start, end);
  return NEGATION_CONTEXT_PATTERNS.some((pattern) => pattern.test(context));
}

function lintForZeroConfirmText(text, options = {}) {
  const value = normalizeText(text);
  const violations = [];
  const allowNegatedContext = options.allowNegatedContext !== false;
  if (!value) {
    return { ok: true, violations, label: options.label || 'text' };
  }
  for (const { pattern, label } of ZERO_CONFIRM_REQUEST_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(value);
    if (!match) continue;
    if (allowNegatedContext && isNegatedContext(value, match.index)) continue;
    violations.push({ label, match: match[0], index: match.index });
  }
  return { ok: violations.length === 0, violations, label: options.label || 'text' };
}

function assertNoZeroConfirmText(text, label = 'text', options = {}) {
  const result = lintForZeroConfirmText(text, { ...options, label });
  if (!result.ok) {
    const summary = result.violations.map((v) => `"${v.label}"`).join(', ');
    throw new Error(`[zero-confirm-guard] Confirmation text in ${label}: ${summary}`);
  }
  return result;
}

function buildZeroConfirmRunnerCommand() {
  return {
    route: ZERO_CONFIRM_ROUTE,
    executor: ZERO_CONFIRM_EXECUTOR,
    command: [...ZERO_CONFIRM_COMMAND],
    shell: false,
    interactive: false,
  };
}

function validateZeroConfirmRunnerCommand(command = []) {
  const argv = Array.isArray(command) ? command.map((part) => String(part || '').trim()).filter(Boolean) : [];
  const joined = argv.join(' ');
  const hasClaude = argv[0] === 'claude';
  const hasBypass = argv.includes('--dangerously-skip-permissions');
  const hasPipe = argv.includes('-p');
  const hasInteractive = argv.some((part) => /--interactive|--stdin|--prompt\b/i.test(part));
  if (!hasClaude || !hasBypass || !hasPipe || hasInteractive) {
    throw new Error(`[zero-confirm-guard] invalid runner command: ${joined || '(empty)'}`);
  }
  return {
    ok: true,
    route: ZERO_CONFIRM_ROUTE,
    executor: ZERO_CONFIRM_EXECUTOR,
    command: argv,
  };
}

module.exports = {
  ZERO_CONFIRM_EXECUTOR,
  ZERO_CONFIRM_ROUTE,
  ZERO_CONFIRM_COMMAND,
  ZERO_CONFIRM_REQUEST_PATTERNS,
  lintForZeroConfirmText,
  assertNoZeroConfirmText,
  buildZeroConfirmRunnerCommand,
  validateZeroConfirmRunnerCommand,
};
