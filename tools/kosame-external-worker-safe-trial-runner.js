#!/usr/bin/env node
'use strict';

/**
 * KOSAME External Worker Safe Trial Runner v110.60.0
 *
 * v110.58 の sanitized task pack generator と v110.59 の patch intake gate を
 * dryRun 前提でつなぐ安全試験ランナー。
 * 外部 worker へは実送信せず、mock / fixture / simulated patch のみ扱う。
 */

const generator = require('./kosame-sanitized-task-pack-generator');
const patchGate = require('./kosame-patch-intake-gate');
const securityPolicy = require('./kosame-worker-security-policy');
const costLedger = require('./kosame-cost-token-ledger');
const explainability = require('./kosame-router-explainability-dashboard');

const TOOL_META = {
  version: '110.60.0',
  feature: 'v110-60-external-worker-safe-trial-runner',
  slug: 'kosame-external-worker-safe-trial-runner',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(item => (item == null ? [] : [String(item).trim()]))
    .filter(Boolean))];
}

function versionSafeText(task, fallback = 'external worker trial') {
  return securityPolicy.redactForWorker(String(task?.title || fallback)).slice(0, 120);
}

function buildPatchBody(file, taskTitle, taskType) {
  const fileText = String(file || 'docs/trial.md');
  const title = versionSafeText({ title: taskTitle });

  if (/\.md$/i.test(fileText)) {
    return [
      '*** Begin Patch',
      `*** Update File: ${fileText}`,
      '@@',
      '- Old draft note',
      `+ ${title} updated`,
      '*** End Patch',
    ].join('\n');
  }

  if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(fileText)) {
    return [
      '*** Begin Patch',
      `*** Update File: ${fileText}`,
      '@@',
      '-const value = "old";',
      `+const value = "${title.replace(/"/g, '\\"')}";`,
      '*** End Patch',
    ].join('\n');
  }

  if (/\.json$/i.test(fileText)) {
    return [
      '*** Begin Patch',
      `*** Update File: ${fileText}`,
      '@@',
      '-  "status": "old"',
      `+  "status": "${title.replace(/"/g, '\\"')}"`,
      '*** End Patch',
    ].join('\n');
  }

  return [
    '*** Begin Patch',
    `*** Update File: ${fileText}`,
    '@@',
    `- old ${taskType || 'trial'} line`,
    `+ new ${title}`,
    '*** End Patch',
  ].join('\n');
}

function buildMockWorkerOutput(task, sourceTaskPack, context = {}) {
  const changedFiles = uniqueList(
    context.changedFiles
    || sourceTaskPack.allowedFiles
    || task?.file_scope
    || [],
  ).slice(0, 1);
  const targetFile = changedFiles[0] || 'docs/external-worker-trial.md';
  const taskType = costLedger.classifyTaskType(task, context);
  const patchText = context.patchText || buildPatchBody(targetFile, task?.title, taskType);
  const patchSummary = context.patchSummary
    || compactText(
      task?.title,
      taskType === 'routine_docs' ? 'docs trial' : '',
      taskType === 'routine_smoke' ? 'smoke trial' : '',
      taskType === 'routine_ui' ? 'ui wording trial' : '',
      'external worker mock output',
    );

  return {
    kind: 'mock_patch',
    workerType: context.workerType || sourceTaskPack.workerType || null,
    changedFiles,
    patchSummary,
    patchText,
    declaredScope: uniqueList(context.declaredScope || sourceTaskPack.allowedScope || []),
    verifyCommands: uniqueList(context.verifyCommands || sourceTaskPack.verifyCommands || []),
    riskNotes: compactText(context.riskNotes, 'dryRun mock output only'),
    returnDiffOnly: sourceTaskPack.returnDiffOnly === true,
  };
}

function buildVerifyCandidates(sourceTaskPack, patchIntakeGate) {
  return uniqueList([
    ...(sourceTaskPack.verifyCommands || []),
    ...(patchIntakeGate.verifyCommands || []),
    'npm run smoke:v110-60',
    'npm run verify',
  ]);
}

function buildBlockedResult({ task, workerType, sourceTaskPack, reason, status = 'rejected', humanGateReason = reason }) {
  const explanation = explainability.buildRouterExplanation(task, {
    selectedWorker: workerType,
    selectedModel: workerType,
    modelTier: sourceTaskPack.allowedWorkerClass || 'unknown',
    taskType: sourceTaskPack.taskType || costLedger.classifyTaskType(task),
    reason,
    humanGateRequired: true,
    humanGateReason,
    approvalRequired: false,
    expensiveModelBlocked: false,
    safetyNotes: reason,
  }, {
    requestedModel: workerType,
  });

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    dryRun: true,
    taskId: sourceTaskPack.taskId || task?.id || null,
    workerType,
    allowedWorkerClass: sourceTaskPack.allowedWorkerClass || 'unknown',
    status,
    accepted: false,
    rejected: true,
    humanGateRequired: true,
    humanGateReason,
    sourceTaskPack,
    mockWorkerOutput: null,
    patchIntakeGate: null,
    changedFilesAllowed: [],
    forbiddenFilesTouched: [],
    verifyCandidates: buildVerifyCandidates(sourceTaskPack, { verifyCommands: [] }),
    safetyNotes: [
      reason,
      sourceTaskPack.safetyNotes ? String(sourceTaskPack.safetyNotes) : null,
      explanation.safetyNotes,
    ].filter(Boolean),
    recommendedNextAction: 'use_sanitized_only_pack_or_human_gate',
    routerExplanation: explanation,
  };
}

function buildExternalWorkerSafeTrialRun(task, context = {}) {
  const workerType = String(context.workerType || context.requestedModel || '').trim() || null;
  const sourceTaskPack = context.sourceTaskPack || generator.buildSanitizedTaskPack(task, {
    ...context,
    workerType,
    requestedModel: context.requestedModel || workerType || null,
    externalSanitized: true,
  });

  if (sourceTaskPack.allowedWorkerClass !== 'sanitized_only') {
    return buildBlockedResult({
      task,
      workerType: workerType || sourceTaskPack.workerType || null,
      sourceTaskPack,
      reason: 'source task pack must be sanitized_only for external worker trial',
      status: 'rejected',
      humanGateReason: 'source task pack must be sanitized_only',
    });
  }

  if (sourceTaskPack.humanGateRequired) {
    return buildBlockedResult({
      task,
      workerType: workerType || sourceTaskPack.workerType || null,
      sourceTaskPack,
      reason: sourceTaskPack.humanGateReason || 'source task pack requires human gate',
      status: 'human_gate',
      humanGateReason: sourceTaskPack.humanGateReason || 'source task pack requires human gate',
    });
  }

  const defaultMockWorkerOutput = buildMockWorkerOutput(task, sourceTaskPack, {
    ...context,
    workerType: workerType || sourceTaskPack.workerType || null,
  });
  const mockWorkerOutput = context.mockWorkerOutput
    ? {
        ...defaultMockWorkerOutput,
        ...context.mockWorkerOutput,
        changedFiles: uniqueList(context.mockWorkerOutput.changedFiles || defaultMockWorkerOutput.changedFiles).slice(0, 1),
        declaredScope: uniqueList(context.mockWorkerOutput.declaredScope || defaultMockWorkerOutput.declaredScope),
        verifyCommands: uniqueList(context.mockWorkerOutput.verifyCommands || defaultMockWorkerOutput.verifyCommands),
        riskNotes: compactText(context.mockWorkerOutput.riskNotes || defaultMockWorkerOutput.riskNotes),
      }
    : defaultMockWorkerOutput;

  const patchIntakeGate = patchGate.buildPatchIntakeGate({
    sourceTaskPack,
    workerType: workerType || sourceTaskPack.workerType || null,
    changedFiles: mockWorkerOutput.changedFiles,
    patchSummary: mockWorkerOutput.patchSummary,
    diffText: mockWorkerOutput.patchText,
    declaredScope: mockWorkerOutput.declaredScope,
    verifyCommands: mockWorkerOutput.verifyCommands,
    riskNotes: mockWorkerOutput.riskNotes,
    approvalReceived: context.approvalReceived === true,
    taskHint: sourceTaskPack.taskType || costLedger.classifyTaskType(task, context),
  }, {
    sourceTaskPack,
    workerType: workerType || sourceTaskPack.workerType || null,
    changedFiles: mockWorkerOutput.changedFiles,
    patchSummary: mockWorkerOutput.patchSummary,
    diffText: mockWorkerOutput.patchText,
    declaredScope: mockWorkerOutput.declaredScope,
    verifyCommands: mockWorkerOutput.verifyCommands,
    riskNotes: mockWorkerOutput.riskNotes,
    approvalReceived: context.approvalReceived === true,
    taskHint: sourceTaskPack.taskType || costLedger.classifyTaskType(task, context),
  });

  const status = patchIntakeGate.accepted
    ? 'accepted'
    : patchIntakeGate.humanGateRequired
      ? 'human_gate'
      : 'rejected';

  const explanation = explainability.buildRouterExplanation(task, {
    selectedWorker: workerType || sourceTaskPack.workerType || null,
    selectedModel: workerType || sourceTaskPack.workerType || null,
    modelTier: sourceTaskPack.allowedWorkerClass,
    taskType: sourceTaskPack.taskType || costLedger.classifyTaskType(task, context),
    reason: patchIntakeGate.recommendedNextAction || 'external worker trial evaluated',
    costPolicy: patchIntakeGate.routerExplanation?.costPolicy,
    availabilityFallback: patchIntakeGate.routerExplanation?.availabilityFallback,
    workerScorecard: patchIntakeGate.routerExplanation?.workerScorecard,
    approvalRequired: false,
    humanGateRequired: patchIntakeGate.humanGateRequired,
    humanGateReason: patchIntakeGate.humanGateReason,
    safetyNotes: patchIntakeGate.safetyNotes.join('; '),
  }, {
    requestedModel: workerType || sourceTaskPack.workerType || null,
  });

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    dryRun: true,
    taskId: sourceTaskPack.taskId || task?.id || null,
    workerType: workerType || sourceTaskPack.workerType || null,
    allowedWorkerClass: sourceTaskPack.allowedWorkerClass,
    status,
    accepted: patchIntakeGate.accepted,
    rejected: patchIntakeGate.rejected,
    humanGateRequired: patchIntakeGate.humanGateRequired,
    humanGateReason: patchIntakeGate.humanGateReason,
    sourceTaskPack,
    mockWorkerOutput,
    patchIntakeGate,
    changedFilesAllowed: patchIntakeGate.changedFilesAllowed,
    forbiddenFilesTouched: patchIntakeGate.forbiddenFilesTouched,
    verifyCandidates: buildVerifyCandidates(sourceTaskPack, patchIntakeGate),
    safetyNotes: uniqueList([
      ...sourceTaskPack.safetyNotes || [],
      ...patchIntakeGate.safetyNotes || [],
      explanation.safetyNotes,
      patchIntakeGate.humanGateReason,
      patchIntakeGate.recommendedNextAction ? `recommendedNextAction=${patchIntakeGate.recommendedNextAction}` : null,
    ]),
    recommendedNextAction: patchIntakeGate.recommendedNextAction,
    routerExplanation: explanation,
    intakeGateSummary: {
      accepted: patchIntakeGate.accepted,
      rejected: patchIntakeGate.rejected,
      humanGateRequired: patchIntakeGate.humanGateRequired,
      humanGateReason: patchIntakeGate.humanGateReason,
      returnDiffOnlyRespected: patchIntakeGate.returnDiffOnlyRespected,
    },
  };
}

function runExternalWorkerSafeTrial(task, context = {}) {
  return buildExternalWorkerSafeTrialRun(task, context);
}

module.exports = {
  TOOL_META,
  buildExternalWorkerSafeTrialRun,
  runExternalWorkerSafeTrial,
  buildMockWorkerOutput,
  buildPatchBody,
};
