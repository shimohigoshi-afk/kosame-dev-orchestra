#!/usr/bin/env node
'use strict';

const { detectSafetyStop } = require('./kosame-safety-stop-detector');
const { evaluatePromptFirewall } = require('./kosame-forbidden-prompt-firewall');
const { validateExecutorPlan, summarizeExecutorPolicy: summarizeRegistryExecutorPolicy } = require('./kosame-executor-registry');

function createBlockedExecutorResult(plan, reason) {
  return {
    ok: false,
    blocked: true,
    reason,
    summary: summarizeRegistryExecutorPolicy(plan),
    safetyStop: detectSafetyStop(reason),
    resultPOSTRequired: true,
  };
}

function validateExecutorPlanWithGuards(plan = {}) {
  const policy = validateExecutorPlan(plan);
  if (!policy.ok) return createBlockedExecutorResult(plan, policy.reason);

  const promptText = String(plan.prompt || plan.workOrderPrompt || plan.work_order_prompt || '');
  const safety = detectSafetyStop(promptText);
  if (safety.matched) {
    return createBlockedExecutorResult(plan, safety.reason || 'Safety Stop');
  }
  const firewall = evaluatePromptFirewall(promptText, 'work_order');
  if (!firewall.ok) {
    return createBlockedExecutorResult(plan, firewall.reason || 'Forbidden prompt');
  }

  return {
    ok: true,
    blocked: false,
    reason: '',
    summary: summarizeRegistryExecutorPolicy(plan),
    safetyStop: safety,
    firewall,
    resultPOSTRequired: true,
    policy,
  };
}

function assertExecutorPolicy(plan = {}) {
  const result = validateExecutorPlanWithGuards(plan);
  if (!result.ok) throw new Error(result.reason || 'executor policy blocked');
  return result;
}

module.exports = {
  validateExecutorPlan: validateExecutorPlanWithGuards,
  assertExecutorPolicy,
  createBlockedExecutorResult,
  summarizeExecutorPolicy: summarizeRegistryExecutorPolicy,
};
