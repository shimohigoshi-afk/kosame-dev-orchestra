#!/usr/bin/env node
'use strict';

const { buildCompleteRunInboxPlan } = require('./kosame-agent-router');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildResumePacket(gapPacket = {}, context = {}) {
  const gapId = normalizeText(gapPacket.gapId || `gap-${Date.now()}`);
  const originalRunId = normalizeText(context.runId || context.workOrderId || gapPacket.workOrderId || '');
  const resumePrompt = [
    `# resume ${gapId}`,
    gapPacket.resumeHint || gapPacket.summary || '復帰してください。',
    ...(Array.isArray(gapPacket.tasks) ? gapPacket.tasks : []),
  ].filter(Boolean).join('\n');
  const routePlan = buildCompleteRunInboxPlan({
    message: resumePrompt,
    selectedProjectId: context.selectedProjectId,
    selectedProjectPath: context.selectedProjectPath,
    selectedProjectLabel: context.selectedProjectLabel,
  }, { completionMode: 'resume-engine' });

  return {
    resumeId: `resume-${Date.now()}`,
    gapId,
    originalRunId,
    route: routePlan.route,
    executor: routePlan.executor,
    commandInbox: routePlan,
    resumeCommand: 'node tools/kosame-complete-run-daemon.js --resume',
    resumePrompt,
    summary: `resume from ${gapPacket.stopReason || gapPacket.category || 'unknown'}`,
  };
}

module.exports = {
  buildResumePacket,
};
