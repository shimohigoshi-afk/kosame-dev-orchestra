#!/usr/bin/env node
'use strict';

const { detectSafetyStop } = require('./kosame-safety-stop-detector');
const { evaluateNoYesGate } = require('./kosame-no-yes-gate');
const { classifyExecutionHost } = require('./kosame-execution-host-guard');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function joinText(input = {}) {
  return [
    input.errorStage,
    input.errorCode,
    input.errorMessage,
    input.reason,
    input.message,
    input.output,
    input.stdout,
    input.stderr,
    input.logText,
    Array.isArray(input.stageHistory)
      ? input.stageHistory.map((stage) => [stage.stage, stage.status, stage.message, stage.errorMessage].filter(Boolean).join(' ')).join('\n')
      : '',
  ].filter(Boolean).join('\n');
}

function detectStopReason(input = {}) {
  const text = joinText(input);
  const safety = detectSafetyStop(text);
  const gate = evaluateNoYesGate({
    text,
    source: input.source || 'stdout',
    executionHostInfo: input.executionHostInfo || classifyExecutionHost({
      executionHost: input.executionHost,
      executionSource: input.executionSource,
      interactive: input.interactive,
      safeSpawn: input.safeSpawn,
      console: input.console,
      runner: input.runner,
      apiRunner: input.apiRunner,
    }),
  });

  if (safety.matched) {
    return {
      ok: false,
      category: 'safety_stop',
      reason: safety.reason || 'Safety Stop',
      missingCapability: 'safety_gate',
      stopReason: 'safety_stop',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: true,
      summary: '安全停止条件を検出しました。',
    };
  }

  if (!gate.ok && gate.decision === 'blocked_interactive_host') {
    return {
      ok: false,
      category: 'interactive_host',
      reason: gate.blockedReason || 'blocked_interactive_host',
      missingCapability: 'execution_host_guard',
      stopReason: 'blocked_interactive_host',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: '対話ホストは正規ルートから隔離されました。',
    };
  }

  if (!gate.ok && gate.decision === 'blocked_by_interactive_prompt') {
    return {
      ok: false,
      category: 'interactive_prompt',
      reason: gate.blockedReason || 'blocked_by_interactive_prompt',
      missingCapability: 'no_yes_gate_runtime',
      stopReason: 'blocked_by_interactive_prompt',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: '確認語が検出されたため、ユーザー待ちにせず遮断しました。',
    };
  }

  const normalized = normalizeText(text).toLowerCase();
  if (/timed out|timeout|time out/.test(normalized)) {
    return {
      ok: false,
      category: 'runner_timeout',
      reason: 'runner timeout',
      missingCapability: 'runner_timeout_guard',
      stopReason: 'runner_timeout',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: 'Runner のタイムアウト対策が必要です。',
    };
  }

  if (/resultPOST|result post/i.test(text) && /fail|error|blocked/i.test(normalized)) {
    return {
      ok: false,
      category: 'result_post_failure',
      reason: 'resultPOST failure',
      missingCapability: 'result_post_retry',
      stopReason: 'result_post_failure',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: 'resultPOST の復旧が必要です。',
    };
  }

  if (/verify/.test(normalized) && /fail|error/.test(normalized)) {
    return {
      ok: false,
      category: 'verify_failed',
      reason: 'verify failed',
      missingCapability: 'verify_fix',
      stopReason: 'verify_failed',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: 'verify の差分修正が必要です。',
    };
  }

  if (/smoke/.test(normalized) && /fail|error/.test(normalized)) {
    return {
      ok: false,
      category: 'smoke_failed',
      reason: 'smoke failed',
      missingCapability: 'smoke_fix',
      stopReason: 'smoke_failed',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: 'smoke 互換の補修が必要です。',
    };
  }

  if (/forbidden|禁止|blocked/i.test(normalized)) {
    return {
      ok: false,
      category: 'forbidden_prompt',
      reason: 'forbidden prompt',
      missingCapability: 'prompt_firewall',
      stopReason: 'forbidden_prompt',
      promptType: gate.promptType,
      promptOrigin: gate.promptOrigin,
      executionHost: gate.executionHost,
      userInputRequired: false,
      safetyStopMatched: false,
      summary: '確認語や禁止語の検査が必要です。',
    };
  }

  return {
    ok: true,
    category: 'ok',
    reason: '',
    missingCapability: '',
    stopReason: 'none',
    promptType: gate.promptType,
    promptOrigin: gate.promptOrigin,
    executionHost: gate.executionHost,
    userInputRequired: false,
    safetyStopMatched: false,
    summary: '停止理由は検出されませんでした。',
  };
}

module.exports = {
  detectStopReason,
};
