'use strict';

const TOOL_META = {
  version: '8.5.0',
  title: 'Multi-Agent Parallel Work Pack',
  slug: 'multi-agent-parallel-work-pack'
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const PARALLEL_MODES = ['full', 'partial', 'sequential'];

const AGENT_TASK_TEMPLATES = {
  kosame: {
    role: 'PM / 統合 / 安全ゲート',
    promptTemplate: (taskGoal, productLine) =>
      `こさめ副社長として、以下タスクのPM判断をしてください。\nタスク: ${taskGoal}\nProductLine: ${productLine}\n判断結果をJSON形式で返してください。repoは触らないでください。`,
    canEditRepo: false,
    tier: 'internal'
  },
  gemini: {
    role: '仕様整理 / docs / fixture / assert',
    promptTemplate: (taskGoal, productLine) =>
      `You are a spec clarification and documentation specialist.\nTask: ${taskGoal}\nProductLine: ${productLine}\nProvide: spec clarification, fixture candidates, assert candidates. No customer data. Do NOT edit the repo directly.`,
    canEditRepo: false,
    tier: 'primary'
  },
  claude: {
    role: '実装 / 修正 / verify',
    promptTemplate: (taskGoal, productLine) =>
      `You are a precise implementation engineer.\nTask: ${taskGoal}\nProductLine: ${productLine}\nDo not read secrets, .env, or API key values. Return result as JSON. You are the only agent allowed to edit the repo.`,
    canEditRepo: true,
    tier: 'primary'
  },
  grok: {
    role: '弱点指摘 / 突破案 / 堂々巡り防止',
    promptTemplate: (taskGoal, productLine) =>
      `You are a weakness detector and breakthrough analyst.\nTask: ${taskGoal}\nProductLine: ${productLine}\nProvide: weakness list, breakthrough proposals, loop prevention suggestions. No confidential data. Do NOT edit the repo.`,
    canEditRepo: false,
    tier: 'secondary'
  }
};

function generateParallelWorkId(projectName) {
  const ts = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `parallel-${slug}-${ts}`;
}

function buildAgentTaskPacket(agentId, taskGoal, productLine, taskType, dataLevel) {
  const def = AGENT_TASK_TEMPLATES[agentId];
  if (!def) return null;

  const levelCBlocked = dataLevel === 'C' && !['kosame'].includes(agentId);
  return {
    agentId,
    role: def.role,
    prompt: levelCBlocked
      ? `[BLOCKED: Level C data — ${agentId} not permitted]`
      : def.promptTemplate(taskGoal, productLine),
    canEditRepo: def.canEditRepo,
    tier: def.tier,
    levelCBlocked,
    blockedReason: levelCBlocked ? `dataLevel C — ${agentId} not permitted for external provider` : null,
    taskGoal,
    productLine,
    taskType,
    humanApprovalRequired: true,
    dryRun: true
  };
}

function buildExecutionOrder(parallelMode, availableAgents) {
  if (parallelMode === 'sequential') {
    return availableAgents.map((a, i) => ({ step: i + 1, agentId: a, parallel: false }));
  }

  const specAgents  = availableAgents.filter(a => ['gemini', 'grok'].includes(a));
  const implAgents  = availableAgents.filter(a => ['claude'].includes(a));
  const pmAgents    = availableAgents.filter(a => ['kosame'].includes(a));
  const humanAgents = availableAgents.filter(a => ['human'].includes(a));

  const order = [];
  let step = 1;

  if (pmAgents.length > 0) {
    order.push({ step, agentIds: pmAgents, parallel: false, note: 'PM intake first' });
    step++;
  }
  if (specAgents.length > 0) {
    order.push({ step, agentIds: specAgents, parallel: parallelMode === 'full', note: 'Gemini+Grok run in parallel' });
    step++;
  }
  if (implAgents.length > 0) {
    order.push({ step, agentIds: implAgents, parallel: false, note: 'Claude implements after spec/weakness done' });
    step++;
  }
  if (humanAgents.length > 0) {
    order.push({ step, agentIds: humanAgents, parallel: false, note: 'Human final approval last' });
    step++;
  }
  return order;
}

function buildConflictPolicy() {
  return {
    simultaneousEditsPolicy: 'denied',
    repoEditOwner: 'claude',
    conflictResolution: 'kosame arbitrates — Gemini/Grok outputs are text only, not file patches',
    deniedActions: [
      'Gemini editing repo files directly',
      'Grok editing repo files directly',
      'Multiple agents editing same file simultaneously'
    ]
  };
}

function buildPacket(input) {
  const planningPacket  = input.planningPacket || {};
  const availableAgents = Array.isArray(input.availableAgents) && input.availableAgents.length > 0
    ? input.availableAgents
    : ['kosame', 'gemini', 'claude', 'grok'];
  const parallelMode        = PARALLEL_MODES.includes(input.parallelMode) ? input.parallelMode : 'full';
  const maxConcurrentAgents = Number(input.maxConcurrentAgents) || 3;
  const dataLevel           = ['A', 'B', 'C'].includes(input.dataLevel) ? input.dataLevel : 'A';
  const riskLevel           = ['low', 'medium', 'high', 'critical'].includes(input.riskLevel) ? input.riskLevel : 'low';

  const taskGoal   = planningPacket.taskGoal   || String(input.taskGoal   || '(task goal)');
  const productLine = planningPacket.productLine || String(input.productLine || 'backoffice');
  const taskType   = planningPacket.taskType   || String(input.taskType   || 'implementation');
  const projectName = planningPacket.projectName || String(input.projectName || '(unnamed)');

  const parallelWorkId = generateParallelWorkId(projectName);

  const agentTaskPackets = availableAgents
    .map(a => buildAgentTaskPacket(a, taskGoal, productLine, taskType, dataLevel))
    .filter(Boolean);

  const executionOrder  = buildExecutionOrder(parallelMode, availableAgents);
  const conflictPolicy  = buildConflictPolicy();

  const deniedSharedEdits = [
    'Gemini must not edit repo — text output only',
    'Grok must not edit repo — text output only',
    'kosame must not edit repo directly — routes to claude',
    'No two agents may edit the same file simultaneously'
  ];

  const safetyBoundary = {
    dataLevel,
    riskLevel,
    externalProviderAllowed: dataLevel !== 'C',
    repoEditOwner: 'claude only'
  };

  const recommendedNextAction = dataLevel === 'C'
    ? 'Level C blocked — dispatch only to kosame'
    : `Dispatch Gemini+Grok in parallel (step 2), then Claude after both complete (step 3)`;

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    parallelWorkId,
    projectName,
    taskGoal,
    productLine,
    taskType,
    dataLevel,
    riskLevel,
    parallelMode,
    maxConcurrentAgents,
    agentTaskPackets,
    executionOrder,
    conflictPolicy,
    deniedSharedEdits,
    safetyBoundary,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  const sample = buildPacket({
    planningPacket: {
      projectName: 'sample-project',
      taskGoal: 'implement release note generator',
      productLine: 'backoffice',
      taskType: 'implementation'
    },
    availableAgents: ['kosame', 'gemini', 'claude', 'grok'],
    parallelMode: 'full',
    maxConcurrentAgents: 3,
    dataLevel: 'A',
    riskLevel: 'low'
  });
  console.log(JSON.stringify(sample, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PARALLEL_MODES,
  AGENT_TASK_TEMPLATES,
  BLOCKED_DANGEROUS_ACTIONS,
  generateParallelWorkId,
  buildAgentTaskPacket,
  buildExecutionOrder,
  buildConflictPolicy,
  buildPacket
};
