'use strict';

const { classifyPrompt } = require('./kosame-prompt-classifier');
const { detectSafetyStop } = require('./kosame-safety-stop-detector');
const { classifyExecutionHost } = require('./kosame-execution-host-guard');

const BLOCKED_PROMPT_TYPES = new Set([
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
]);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function evaluateNoYesGate(input = {}) {
  const text = normalizeText(input.text || input.chunk || '');
  const source = normalizeText(input.source || 'stdout') || 'stdout';
  const executionHostInfo = input.executionHostInfo || classifyExecutionHost({
    executionHost: input.executionHost,
    execution_host: input.execution_host,
    host: input.host,
    executionSource: input.executionSource,
    source: input.executionSource,
    interactive: input.interactive,
    safeSpawn: input.safeSpawn,
    safeSpawnActive: input.safeSpawnActive,
    console: input.console,
    runner: input.runner,
    apiRunner: input.apiRunner,
  });
  const prompt = classifyPrompt(text, source);
  const safety = detectSafetyStop(text);
  const blockedPromptType = BLOCKED_PROMPT_TYPES.has(prompt.promptType);

  if (safety.matched) {
    return {
      ok: false,
      blocked: true,
      decision: 'safety_stop',
      promptOrigin: 'safety_stop_prompt',
      promptType: prompt.promptType,
      blockedReason: safety.reason || 'Safety Stop',
      userInputRequired: false,
      executionHost: executionHostInfo.executionHost,
      executionHostAllowed: executionHostInfo.executionHostAllowed,
      interactiveHostBlocked: executionHostInfo.interactiveHostBlocked,
      noYesGateRuntime: executionHostInfo.noYesGateRuntime,
      safeSpawnActive: executionHostInfo.safeSpawnActive,
      manualCodeUiAllowed: executionHostInfo.manualCodeUiAllowed,
      officialRoute: executionHostInfo.officialRoute,
      source,
      classification: prompt,
      safetyStopMatched: true,
    };
  }

  if (executionHostInfo.interactiveHostBlocked) {
    return {
      ok: false,
      blocked: true,
      decision: 'blocked_interactive_host',
      promptOrigin: 'external_interactive_prompt',
      promptType: prompt.promptType,
      blockedReason: executionHostInfo.blockedReason || 'blocked_interactive_host',
      userInputRequired: false,
      executionHost: executionHostInfo.executionHost,
      executionHostAllowed: false,
      interactiveHostBlocked: true,
      noYesGateRuntime: false,
      safeSpawnActive: executionHostInfo.safeSpawnActive,
      manualCodeUiAllowed: executionHostInfo.manualCodeUiAllowed,
      officialRoute: executionHostInfo.officialRoute,
      source,
      classification: prompt,
      safetyStopMatched: false,
    };
  }

  if (blockedPromptType) {
    return {
      ok: false,
      blocked: true,
      decision: 'blocked_by_interactive_prompt',
      promptOrigin: 'interactive_prompt',
      promptType: prompt.promptType,
      blockedReason: prompt.promptType,
      userInputRequired: false,
      executionHost: executionHostInfo.executionHost,
      executionHostAllowed: executionHostInfo.executionHostAllowed,
      interactiveHostBlocked: executionHostInfo.interactiveHostBlocked,
      noYesGateRuntime: executionHostInfo.noYesGateRuntime,
      safeSpawnActive: executionHostInfo.safeSpawnActive,
      manualCodeUiAllowed: executionHostInfo.manualCodeUiAllowed,
      officialRoute: executionHostInfo.officialRoute,
      source,
      classification: prompt,
      safetyStopMatched: false,
    };
  }

  return {
    ok: true,
    blocked: false,
    decision: 'allow',
    promptOrigin: 'none',
    promptType: prompt.promptType,
    blockedReason: '',
    userInputRequired: false,
    executionHost: executionHostInfo.executionHost,
    executionHostAllowed: executionHostInfo.executionHostAllowed,
    interactiveHostBlocked: executionHostInfo.interactiveHostBlocked,
    noYesGateRuntime: executionHostInfo.noYesGateRuntime,
    safeSpawnActive: executionHostInfo.safeSpawnActive,
    manualCodeUiAllowed: executionHostInfo.manualCodeUiAllowed,
    officialRoute: executionHostInfo.officialRoute,
    source,
    classification: prompt,
    safetyStopMatched: false,
  };
}

function summarizeNoYesGateState(state = {}) {
  return [
    `decision=${normalizeText(state.decision || 'allow')}`,
    `promptType=${normalizeText(state.promptType || 'unknown_prompt')}`,
    `promptOrigin=${normalizeText(state.promptOrigin || 'none')}`,
    `blockedReason=${normalizeText(state.blockedReason || '') || '—'}`,
    `executionHost=${normalizeText(state.executionHost || 'unknown-interactive')}`,
    `executionHostAllowed=${state.executionHostAllowed ? 'true' : 'false'}`,
    `interactiveHostBlocked=${state.interactiveHostBlocked ? 'true' : 'false'}`,
    `userInputRequired=${state.userInputRequired ? 'true' : 'false'}`,
  ].join(' / ');
}

module.exports = {
  BLOCKED_PROMPT_TYPES,
  evaluateNoYesGate,
  summarizeNoYesGateState,
};
