'use strict';

const TOOL_META = {
  version: '5.9.0',
  title: 'Verified One-shot Pipeline Pack',
  slug: 'verified-one-shot-pipeline-pack'
};

const PIPELINE_STAGES = ['intake', 'safety_check', 'provider_select', 'dispatch', 'verify', 'report'];

const PIPELINE_POLICY = {
  requiresHumanApprovalAtStages: ['dispatch', 'report'],
  abortOnSafetyFailure: true,
  verificationRequired: true,
  dryRunDefault: true
};

function runSafetyCheck(task = {}) {
  const blocked = ['.env', 'API key', 'Secret', 'customer data'];
  const summary = (task.description || '').toLowerCase();
  const found = blocked.filter(kw => summary.includes(kw.toLowerCase()));
  if (task.dataLevel === 'C' && task.provider !== 'kosame' && task.provider !== 'human') {
    return { passed: false, reason: 'data level C rejected for external provider' };
  }
  if (found.length > 0) {
    return { passed: false, reason: `blocked content: ${found.join(', ')}` };
  }
  return { passed: true, reason: 'safety check passed' };
}

function runVerification(output = {}) {
  if (!output || typeof output !== 'object') {
    return { passed: false, reason: 'output is not an object' };
  }
  if (!output.result) {
    return { passed: false, reason: 'output missing result field' };
  }
  return { passed: true, reason: 'verification passed' };
}

function runPipeline(task = {}) {
  const stages = {};

  stages.intake = { stage: 'intake', status: 'ok', task };

  const safety = runSafetyCheck(task);
  stages.safety_check = { stage: 'safety_check', status: safety.passed ? 'ok' : 'failed', detail: safety };
  if (!safety.passed) {
    return { ok: false, abortedAt: 'safety_check', stages, humanApprovalRequired: true };
  }

  stages.provider_select = { stage: 'provider_select', status: 'ok', provider: task.provider || 'gemini' };
  stages.dispatch = { stage: 'dispatch', status: 'pending_human_approval', humanApprovalRequired: true };
  stages.verify = { stage: 'verify', status: 'pending', verificationRequired: true };
  stages.report = { stage: 'report', status: 'pending_human_approval', humanApprovalRequired: true };

  return { ok: true, stages, humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const task = input.task || {};
  const pipelineResult = runPipeline(task);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    pipelineStages: PIPELINE_STAGES,
    pipelinePolicy: PIPELINE_POLICY,
    pipelineResult
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    task: {
      description: process.env.KOSAME_TASK_DESCRIPTION || 'implement release note generator',
      provider: process.env.KOSAME_PROVIDER || 'claude',
      dataLevel: process.env.KOSAME_DATA_LEVEL || 'A'
    }
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PIPELINE_STAGES,
  PIPELINE_POLICY,
  runSafetyCheck,
  runVerification,
  runPipeline,
  buildPacket
};
