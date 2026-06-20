#!/usr/bin/env node
'use strict';

const { classifyPrompt } = require('./kosame-prompt-classifier');

function evaluatePromptFirewall(text, source = 'stdout') {
  const classification = classifyPrompt(text, source);
  const blocked = classification.safetyStopMatched || [
    'yes_required',
    'yes_no',
    'y_n',
    'enter_confirm',
    'numbered_choice',
    'trust_prompt',
    'permission_prompt',
    'continue_prompt',
    'proceed_prompt',
    'approval_prompt',
    'accept_prompt',
    'bypass_prompt',
    'feedback_prompt',
    'manual_paste_prompt',
    'human_wait_prompt',
  ].includes(classification.promptType);

  return {
    ok: !blocked,
    blocked,
    promptType: classification.promptType,
    reason: classification.safetyStopMatched ? classification.blockedReason : blocked ? `Forbidden prompt: ${classification.promptType}` : '',
    classification,
  };
}

function assertPromptFirewall(text, source = 'stdout') {
  const result = evaluatePromptFirewall(text, source);
  if (!result.ok) {
    throw new Error(result.reason || `prompt blocked: ${result.promptType}`);
  }
  return result;
}

module.exports = {
  evaluatePromptFirewall,
  assertPromptFirewall,
};
