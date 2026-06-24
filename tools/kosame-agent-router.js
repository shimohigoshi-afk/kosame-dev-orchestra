#!/usr/bin/env node
'use strict';

const { buildInboxPlan } = require('./kosame-command-inbox');
const { buildOrchestraEvidence } = require('./kosame-orchestra-evidence');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildCompleteRunInboxPlan(input = {}, options = {}) {
  const prompt = normalizeText(input.message || input.prompt || input.input || '');
  const inboxPlan = buildInboxPlan({
    input: prompt,
  });
  const orchestration = buildOrchestraEvidence({
    router_decision: inboxPlan.providers && inboxPlan.providers.length
      ? 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first'
      : 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
  });
  const completionMode = normalizeText(options.completionMode || input.completionMode || 'complete-run-first') || 'complete-run-first';
  const assignedLanes = orchestration.assigned_lanes;

  return {
    ...inboxPlan,
    completionMode,
    executionMode: 'complete-run',
    humanApprovalRequired: false,
    commitTagPushRequiresYes: false,
    route: 'zero-confirm',
    executor: 'claude-zero-confirm',
    safety: {
      ...inboxPlan.safety,
      commitTagPushRequiresYes: false,
      completionMode,
    },
    orchestration,
    assignedLanes,
    agentRouter: {
      routerDecision: orchestration.router_decision,
      executor: 'claude-zero-confirm',
      route: 'zero-confirm',
      completionMode,
      assignedLanes,
      nextCommand: inboxPlan.nextCommand,
      workType: inboxPlan.workType,
      repo: inboxPlan.repo,
    },
  };
}

function routeCommand(input = {}, options = {}) {
  const inboxPlan = buildCompleteRunInboxPlan(input, options);
  return {
    ok: true,
    route: 'zero-confirm',
    executor: 'claude-zero-confirm',
    completionMode: inboxPlan.completionMode,
    agentRouter: inboxPlan.agentRouter,
    commandInbox: inboxPlan,
  };
}

module.exports = {
  buildCompleteRunInboxPlan,
  routeCommand,
};
