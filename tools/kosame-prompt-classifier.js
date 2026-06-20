#!/usr/bin/env node
'use strict';

const { detectSafetyStop } = require('./kosame-safety-stop-detector');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function classifyPrompt(text, source = 'stdout') {
  const normalizedPrompt = normalizeText(text);
  const safety = detectSafetyStop(normalizedPrompt);
  const lower = normalizedPrompt.toLowerCase();
  let promptType = 'unknown_prompt';
  let recommendedInputType = 'yes';
  let recommendedInputValue = 'yes\n';
  const matchedPatterns = [];

  const rules = [
    ['safety_stop_prompt', [/secret|api[_-]?key|token|password|billing|deploy|force\s+push|rm\s+-rf|sales[-\s]?dx|transcriber|顧客情報|個人情報|外部送信/i], 'blocked', 'blocked'],
    ['yes_no', [/\byes\/no\b/i], 'yes', 'yes\n'],
    ['y_n', [/\by\/n\b/i], 'y', 'y\n'],
    ['yes_required', [/\bplease\s+confirm\b/i, /\byes\b.*\bno\b/i, /承認してください|承認要求|確認してください|続けますか|continue\?/i], 'yes', 'yes\n'],
    ['enter_confirm', [/press\s+enter|hit\s+enter|enter\s+to\s+continue|enterで/i], 'enter', '\n'],
    ['numbered_choice', [/^\s*\d+\)|select\s+\d+|choose\s+\d+/i], 'number', '1\n'],
    ['trust_prompt', [/workspace trust|folder trust|trust/i], 'trust', 'yes\n'],
    ['permission_prompt', [/permission|権限確認/i], 'yes', 'yes\n'],
    ['continue_prompt', [/continue|続行/i], 'yes', 'yes\n'],
    ['proceed_prompt', [/proceed|進める|進めて/i], 'yes', 'yes\n'],
    ['approval_prompt', [/approve|approved|承認/i], 'yes', 'yes\n'],
    ['accept_prompt', [/accept|accepted/i], 'yes', 'yes\n'],
    ['bypass_prompt', [/bypass|skip permissions/i], 'yes', 'yes\n'],
    ['feedback_prompt', [/feedback|reply with/i], 'yes', 'yes\n'],
    ['manual_paste_prompt', [/manual paste|貼り付け|コピペ/i], 'yes', 'yes\n'],
    ['human_wait_prompt', [/human wait|待機/i], 'yes', 'yes\n'],
  ];

  if (safety.matched) {
    promptType = 'safety_stop_prompt';
    recommendedInputType = 'blocked';
    recommendedInputValue = '';
    matchedPatterns.push(...safety.categories);
  } else {
    for (const [type, patterns, inputType, inputValue] of rules) {
      const hit = patterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(normalizedPrompt);
      });
      if (!hit) continue;
      promptType = type;
      recommendedInputType = inputType;
      recommendedInputValue = inputValue;
      matchedPatterns.push(type);
      break;
    }
  }

  const confidence = promptType === 'unknown_prompt' ? 0.1 : promptType === 'safety_stop_prompt' ? 0.98 : 0.9;
  return {
    promptType,
    confidence,
    recommendedInputType,
    recommendedInputValue,
    matchedPatterns,
    safetyStopMatched: !!safety.matched,
    blockedReason: safety.reason || '',
    normalizedPrompt,
    promptHash: normalizedPrompt ? require('node:crypto').createHash('sha1').update(normalizedPrompt).digest('hex') : '',
    rawLength: normalizedPrompt.length,
    source,
  };
}

function isSafetyStopPrompt(text) {
  return classifyPrompt(text).promptType === 'safety_stop_prompt';
}

module.exports = {
  classifyPrompt,
  isSafetyStopPrompt,
};
