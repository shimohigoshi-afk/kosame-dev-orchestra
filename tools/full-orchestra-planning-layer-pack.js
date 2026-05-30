'use strict';

const TOOL_META = {
  version: '8.0.0',
  title: 'Full Orchestra Planning Layer',
  slug: 'full-orchestra-planning-layer-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const TASK_TYPES = [
  'implementation', 'draft', 'strategy', 'review', 'repair', 'release'
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const DATA_LEVELS = ['A', 'B', 'C'];

const AGENT_ROLES = {
  kosame: {
    role: 'PM / 統合 / 安全ゲート / 最終判断 / 採否判定',
    responsibilities: ['task intake', 'planning', 'merge decision', 'final approval', 'safety gate'],
    canEditRepo: false,
    canApprove: true,
    maxDataLevel: 'C'
  },
  gemini: {
    role: '仕様整理 / docs / fixture / assert / 候補出し',
    responsibilities: ['spec clarification', 'documentation', 'fixture generation', 'assertion candidate', 'bulk draft'],
    canEditRepo: false,
    canApprove: false,
    maxDataLevel: 'A'
  },
  claude: {
    role: '実装 / 修正 / verify / 差分整理',
    responsibilities: ['implementation', 'fix', 'verify', 'diff summary', 'repair'],
    canEditRepo: true,
    canApprove: false,
    maxDataLevel: 'B'
  },
  grok: {
    role: '弱点指摘 / 突破案 / 堂々巡り防止',
    responsibilities: ['weakness detection', 'breakthrough proposal', 'loop prevention', 'alternative design'],
    canEditRepo: false,
    canApprove: false,
    maxDataLevel: 'A'
  },
  human: {
    role: 'commit / push / tag / deploy / Secret / 課金 / 本番影響の最終YES',
    responsibilities: ['commit', 'push', 'tag', 'deploy', 'secret management', 'billing', 'production decision'],
    canEditRepo: true,
    canApprove: true,
    maxDataLevel: 'C'
  }
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

function generatePlanningId(projectName, taskType) {
  const ts = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `planning-${slug}-${taskType}-${ts}`;
}

function normalizeGoal(taskGoal, taskType, productLine) {
  return {
    rawGoal: taskGoal,
    normalizedGoal: String(taskGoal || '(task goal)').trim(),
    taskType: TASK_TYPES.includes(taskType) ? taskType : 'implementation',
    productLine: PRODUCT_LINES.includes(productLine) ? productLine : 'backoffice',
    normalizedAt: new Date().toISOString()
  };
}

function buildAgentRoles(requestedAgents, dataLevel, riskLevel) {
  const available = ['kosame', 'gemini', 'claude', 'grok', 'human'];
  const agents = requestedAgents && requestedAgents.length > 0
    ? requestedAgents.filter(a => available.includes(a))
    : available;

  return agents.map(agentId => {
    const def = AGENT_ROLES[agentId];
    const blocked = dataLevel === 'C' && !['kosame', 'human'].includes(agentId);
    return {
      agentId,
      role: def.role,
      responsibilities: def.responsibilities,
      canEditRepo: def.canEditRepo,
      canApprove: def.canApprove,
      blockedByDataLevel: blocked,
      blockedReason: blocked ? `dataLevel C — ${agentId} not permitted for external provider` : null
    };
  });
}

function buildWorkLanes(taskType, productLine, requestedAgents) {
  const lanes = [
    { lane: 'planning',       owner: 'kosame',  parallel: false, note: 'PM intake and task normalization' },
    { lane: 'spec',           owner: 'gemini',  parallel: true,  note: 'Spec clarification and fixture drafting' },
    { lane: 'weakness',       owner: 'grok',    parallel: true,  note: 'Weakness detection and breakthrough proposal' },
    { lane: 'implementation', owner: 'claude',  parallel: false, note: 'Code implementation and verify (after spec/weakness done)' },
    { lane: 'merge_review',   owner: 'kosame',  parallel: false, note: 'Merge decision and adopt/reject/escalate' },
    { lane: 'final_approval', owner: 'human',   parallel: false, note: 'commit / push / tag / deploy final YES' }
  ];
  return lanes.filter(l => {
    if (!requestedAgents || requestedAgents.length === 0) return true;
    return requestedAgents.includes(l.owner);
  });
}

function buildSafetyBoundary(dataLevel, riskLevel) {
  return {
    dataLevel,
    riskLevel,
    externalProviderAllowed: dataLevel !== 'C' && riskLevel !== 'critical',
    levelCNote: dataLevel === 'C' ? 'Level C — Gemini/Grok/Claude/DeepSeek/Kimi blocked. kosame internal only.' : null,
    criticalRiskNote: riskLevel === 'critical' ? 'Critical risk — kosame review required before any dispatch.' : null,
    blockedProviders: dataLevel === 'C' ? ['gemini', 'grok', 'claude', 'deepseek', 'kimi'] : [],
    repoEditOwner: 'claude only — Gemini/Grok must not edit repo directly'
  };
}

function buildApprovalGates(riskLevel, taskType) {
  const gates = [
    { gate: 'spec_approval',   owner: 'kosame', required: true,  note: 'kosame approves spec before implementation starts' },
    { gate: 'impl_approval',   owner: 'kosame', required: true,  note: 'kosame reviews claude diff before merge' },
    { gate: 'commit_gate',     owner: 'human',  required: true,  note: 'human YES required before git commit' },
    { gate: 'push_gate',       owner: 'human',  required: true,  note: 'human YES required before git push' },
    { gate: 'tag_gate',        owner: 'human',  required: true,  note: 'human YES required before git tag' },
    { gate: 'deploy_gate',     owner: 'human',  required: true,  note: 'human YES required before deploy' }
  ];
  if (riskLevel === 'high' || riskLevel === 'critical') {
    gates.unshift({ gate: 'risk_review', owner: 'kosame', required: true, note: 'High/Critical risk — kosame pre-review required' });
  }
  return gates;
}

function buildPacket(input) {
  const projectName     = String(input.projectName || '(unnamed)');
  const repoPath        = String(input.repoPath || '.');
  const taskGoal        = String(input.taskGoal || '(task goal)').trim();
  const productLine     = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const taskType        = TASK_TYPES.includes(input.taskType) ? input.taskType : 'implementation';
  const riskLevel       = RISK_LEVELS.includes(input.riskLevel) ? input.riskLevel : 'low';
  const dataLevel       = DATA_LEVELS.includes(input.dataLevel) ? input.dataLevel : 'A';
  const currentStatus   = String(input.currentStatus || '');
  const requestedAgents = Array.isArray(input.requestedAgents) ? input.requestedAgents : [];

  const planningId     = generatePlanningId(projectName, taskType);
  const normalizedGoal = normalizeGoal(taskGoal, taskType, productLine);
  const agentRoles     = buildAgentRoles(requestedAgents, dataLevel, riskLevel);
  const workLanes      = buildWorkLanes(taskType, productLine, requestedAgents);
  const safetyBoundary = buildSafetyBoundary(dataLevel, riskLevel);
  const approvalGates  = buildApprovalGates(riskLevel, taskType);

  const levelCBlocked = dataLevel === 'C';
  const recommendedNextAction = levelCBlocked
    ? 'Level C data — dispatch to kosame internal only. Gemini/Grok/Claude blocked.'
    : `Build parallel work packet — dispatch spec to Gemini and weakness review to Grok simultaneously`;

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    planningId,
    projectName,
    repoPath,
    taskGoal,
    productLine,
    taskType,
    riskLevel,
    dataLevel,
    currentStatus,
    normalizedGoal,
    agentRoles,
    workLanes,
    safetyBoundary,
    approvalGates,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    projectName:     process.env.KOSAME_PROJECT_NAME   || 'sample-project',
    repoPath:        process.env.KOSAME_REPO_PATH      || '.',
    taskGoal:        process.env.KOSAME_TASK_GOAL      || 'implement release note generator',
    productLine:     process.env.KOSAME_PRODUCT_LINE   || 'backoffice',
    taskType:        process.env.KOSAME_TASK_TYPE      || 'implementation',
    riskLevel:       process.env.KOSAME_RISK_LEVEL     || 'low',
    dataLevel:       process.env.KOSAME_DATA_LEVEL     || 'A',
    currentStatus:   process.env.KOSAME_CURRENT_STATUS || 'git clean, smoke passing',
    requestedAgents: ['kosame', 'gemini', 'claude', 'grok', 'human']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  TASK_TYPES,
  RISK_LEVELS,
  DATA_LEVELS,
  AGENT_ROLES,
  BLOCKED_DANGEROUS_ACTIONS,
  generatePlanningId,
  normalizeGoal,
  buildAgentRoles,
  buildWorkLanes,
  buildSafetyBoundary,
  buildApprovalGates,
  buildPacket
};
