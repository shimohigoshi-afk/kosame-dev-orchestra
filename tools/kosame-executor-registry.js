#!/usr/bin/env node
'use strict';

const { buildZeroConfirmRunnerCommand, ZERO_CONFIRM_EXECUTOR, ZERO_CONFIRM_ROUTE } = require('./kosame-zero-confirm-guard');

const EXECUTOR_REGISTRY = {
  [ZERO_CONFIRM_EXECUTOR]: {
    executorId: ZERO_CONFIRM_EXECUTOR,
    displayName: 'KOSAME Runner / dispatch watcher',
    route: ZERO_CONFIRM_ROUTE,
    command: 'claude',
    args: ['--dangerously-skip-permissions', '-p'],
    stdio: 'pipe',
    shell: false,
    interactive: false,
    tty: false,
    requiresAutoResponder: true,
    requiresPromptClassifier: true,
    requiresPolicyKernel: true,
    requiresPromptFirewall: true,
    requiresSafetyStopDetector: true,
    requiresResultPOST: true,
    defaultTimeoutMs: 10 * 60 * 1000,
    retryPolicy: { maxRetries: 2, backoffMs: 500 },
    safetyProfile: 'zero-confirm',
  },
};

const FORBIDDEN_EXECUTORS = new Set([
  'raw-claude',
  'raw-codex',
  'interactive-claude',
  'interactive-codex',
  'manual-paste',
  'human-wait',
]);

function listExecutors() {
  return Object.values(EXECUTOR_REGISTRY);
}

function getExecutor(executorId) {
  return EXECUTOR_REGISTRY[String(executorId || '').trim()] || null;
}

function validateExecutorPlan(plan = {}) {
  const executorId = String(plan.executorId || plan.executor || '').trim();
  if (FORBIDDEN_EXECUTORS.has(executorId)) {
    return { ok: false, reason: `forbidden executor: ${executorId}` };
  }
  const executor = getExecutor(executorId);
  if (!executor) {
    return { ok: false, reason: `unknown executor: ${executorId || '(empty)'}` };
  }
  const route = String(plan.route || executor.route || '').trim();
  if (route !== ZERO_CONFIRM_ROUTE) {
    return { ok: false, reason: `route must be ${ZERO_CONFIRM_ROUTE}` };
  }
  const command = Array.isArray(plan.command) ? plan.command : buildZeroConfirmRunnerCommand().command;
  const commandText = command.join(' ');
  if (!command.includes('claude') || !command.includes('--dangerously-skip-permissions') || !command.includes('-p')) {
    return { ok: false, reason: `invalid command: ${commandText}` };
  }
  if (plan.shell !== false || plan.stdio !== 'pipe' || plan.interactive !== false || plan.tty !== false) {
    return { ok: false, reason: 'executor must use pipe/stdin zero-confirm route' };
  }
  return { ok: true, executor, route, command, plan };
}

function assertExecutorPolicy(plan = {}) {
  const result = validateExecutorPlan(plan);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function summarizeExecutorPolicy(plan = {}) {
  const result = validateExecutorPlan(plan);
  return {
    ok: result.ok,
    reason: result.reason || '',
    executorId: String(plan.executorId || plan.executor || '').trim(),
    route: String(plan.route || ZERO_CONFIRM_ROUTE).trim(),
    command: Array.isArray(plan.command) ? plan.command.join(' ') : 'claude --dangerously-skip-permissions -p',
    stdio: plan.stdio || 'pipe',
    shell: plan.shell === true ? 'true' : 'false',
    interactive: plan.interactive === true ? 'true' : 'false',
    autoResponder: plan.autoResponder === false ? 'disabled' : 'active',
    promptClassifier: plan.promptClassifier === false ? 'disabled' : 'active',
    firewall: plan.firewall === false ? 'disabled' : 'active',
    safetyStopDetector: plan.safetyStopDetector === false ? 'disabled' : 'active',
    resultPOST: plan.resultPOST === false ? 'optional' : 'required',
  };
}

module.exports = {
  EXECUTOR_REGISTRY,
  FORBIDDEN_EXECUTORS,
  listExecutors,
  getExecutor,
  validateExecutorPlan,
  assertExecutorPolicy,
  summarizeExecutorPolicy,
};
