#!/usr/bin/env node
'use strict';

/**
 * KOSAME Agent Handoff Coordination Gate v110.64.0
 *
 * DryRun / mock / fixture gate for coordinating parallel AI work.
 * It checks version collisions, repo collisions, role collisions, and
 * danger gates before the handoff plan is accepted.
 */

const securityPolicy = require('./kosame-worker-security-policy');
const ipGate = require('./kosame-ip-protection-gate');
const costLedger = require('./kosame-cost-token-ledger');
const workerScorecard = require('./kosame-worker-scorecard');
const explainability = require('./kosame-router-explainability-dashboard');

const TOOL_META = {
  version: '110.64.0',
  feature: 'v110-64-agent-handoff-coordination-gate',
  slug: 'kosame-agent-handoff-coordination-gate',
};

const STATUS = {
  safe: 'safe',
  caution: 'caution',
  blocked: 'blocked',
  human_gate: 'human_gate',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';
const DEFAULT_TARGET_REPO = 'kosame-dev-orchestra';
const DEFAULT_TARGET_VERSION = '110.64.0';

const RESERVED_VERSION_OWNERS = {
  '110.63.0': 'claude',
  '110.64.0': 'gpt',
  '110.65.0': 'gemini',
};

const ROLE_BOUNDARIES = {
  gpt: {
    label: 'GPT coordination gate',
    preferredScopes: ['coordination', 'handoff', 'routing', 'budget', 'explainability', 'human gate', 'review summary'],
    blockedScopes: ['implementation', 'repo edit', 'file edit', 'patch write', 'deploy', 'push'],
    notes: 'GPT owns the coordination gate only; it should not take implementation scope.',
  },
  claude: {
    label: 'Claude implementation/review lane',
    preferredScopes: ['implementation', 'repair', 'final review', 'quality review', 'release review'],
    blockedScopes: ['coordination gate', 'handoff ownership'],
    notes: 'Claude owns v110.63 implementation work; it should not claim the GPT coordination slot.',
  },
  gemini: {
    label: 'Gemini cautious review lane',
    preferredScopes: ['docs', 'preprocessing', 'google', 'iam', 'cloud run', 'caution review', 'bulk work'],
    blockedScopes: ['coordination gate ownership'],
    notes: 'Gemini is reserved for v110.65 and Google/IAM/Cloud Run caution work.',
  },
  grok: {
    label: 'Grok review/breakthrough lane',
    preferredScopes: ['review', 'breakthrough', 'adversarial', 'risk', 'missing pieces'],
    blockedScopes: ['final decision', 'implementation', 'commit', 'push', 'deploy'],
    notes: 'Grok is review-only and should not own the final gate.',
  },
  deepseek: {
    label: 'DeepSeek sanitized lane',
    preferredScopes: ['docs', 'smoke', 'ui', 'light code', 'utility', 'helper', 'sanitized'],
    blockedScopes: ['secret', 'customer', 'sales dx', 'transcriber', 'ip core', 'billing', 'lead management', 'anesty board'],
    notes: 'DeepSeek/opencode must remain sanitized_only.',
  },
};

const DANGER_PATTERNS = {
  salesDx: /(?:営業DX|sales ?dx|sales-dx|transcriber)/i,
  anestyBoard: /(?:ANESTY Board|anesty-board|anesty_board|KOSAME Dev Orchestra core)/i,
  secret: /(?:api[_-]?key|token|secret|credential|password|\.env|credentials?)/i,
  customer: /(?:customer(?:_?data|_?info)?|顧客(?:情報|データ)?|個人情報|pii)/i,
  billing: /(?:billing|pricing|subscription|revenue model|課金|lead management|営業導線)/i,
  ipCore: /(?:full architecture|core architecture|orchestration|smart router|事業モデル|顧客管理|営業導線|課金導線|IP core|IP\/core)/i,
  highCost: /(?:gpt-5\.5|high cost|expensive model|高コスト)/i,
};

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
    .flatMap(value => (value == null ? [] : [String(value).trim()]))
    .filter(Boolean))];
}

function normalizeAgent(agent) {
  const value = String(agent || '').trim().toLowerCase();
  if (!value) return 'gpt';
  if (value.includes('claude')) return 'claude';
  if (value.includes('gemini')) return 'gemini';
  if (value.includes('grok')) return 'grok';
  if (value.includes('deepseek') || value.includes('opencode') || value.includes('cheap_code_worker') || value.includes('sanitized_worker')) return 'deepseek';
  if (value.includes('gpt')) return 'gpt';
  return value;
}

function normalizeRepo(repo) {
  const text = String(repo || '').trim();
  if (!text) return '';
  const cleaned = text.replace(/\/+$/, '');
  return cleaned.split(/[\\/]/).pop();
}

function normalizeVersion(version) {
  const text = String(version || '').trim().replace(/^v/i, '');
  if (/^\d+\.\d+$/.test(text)) return `${text}.0`;
  if (/^\d+\.\d+\.\d+$/.test(text)) return text;
  return text;
}

function isAllowedRepo(repo) {
  const normalized = normalizeRepo(repo);
  return normalized === DEFAULT_TARGET_REPO;
}

function scopeTextFrom(item = {}) {
  return compactText(
    item.scope,
    item.scopeText,
    item.taskScope,
    item.taskTitle,
    item.taskSummary,
    item.description,
    item.notes,
    item.dangerGates,
    item.allowedScope,
    item.forbiddenScope,
  );
}

function detectDangerFlags(text) {
  const source = String(text || '');
  const secretLeakDetected = securityPolicy.detectSecretLikeText(source).length > 0 || DANGER_PATTERNS.secret.test(source);
  const customerDataDetected = DANGER_PATTERNS.customer.test(source);
  const salesDxDetected = DANGER_PATTERNS.salesDx.test(source);
  const anestyBoardDetected = DANGER_PATTERNS.anestyBoard.test(source);
  const billingOrLeadManagementDetected = DANGER_PATTERNS.billing.test(source);
  const ipCoreDetected = ipGate.detectProtectedIP(source).length > 0 || DANGER_PATTERNS.ipCore.test(source);
  const highCostDetected = DANGER_PATTERNS.highCost.test(source);

  return {
    secretLeakDetected,
    customerDataDetected,
    salesDxDetected,
    anestyBoardDetected,
    billingOrLeadManagementDetected,
    ipCoreDetected,
    highCostDetected,
    hasDanger: secretLeakDetected
      || customerDataDetected
      || salesDxDetected
      || anestyBoardDetected
      || billingOrLeadManagementDetected
      || ipCoreDetected
      || highCostDetected,
    hits: uniqueList([
      ...(secretLeakDetected ? ['secret'] : []),
      ...(customerDataDetected ? ['customer'] : []),
      ...(salesDxDetected ? ['sales_dx'] : []),
      ...(anestyBoardDetected ? ['anesty_board'] : []),
      ...(billingOrLeadManagementDetected ? ['billing'] : []),
      ...(ipCoreDetected ? ['ip_core'] : []),
      ...(highCostDetected ? ['high_cost'] : []),
    ]),
  };
}

function buildWorkItems(plan = {}, context = {}) {
  const rawItems = Array.isArray(plan.workItems) && plan.workItems.length > 0
    ? plan.workItems
    : (Array.isArray(plan.versionClaims) && plan.versionClaims.length > 0
      ? plan.versionClaims
      : [{
          agent: plan.assignedAgent || context.assignedAgent || 'gpt',
          version: plan.targetVersion || context.targetVersion || DEFAULT_TARGET_VERSION,
          repo: plan.targetRepo || context.targetRepo || DEFAULT_TARGET_REPO,
          scope: plan.scope || plan.taskScope || plan.handoffScope || plan.taskType || 'coordination_gate',
          requestedModel: plan.requestedModel || context.requestedModel || 'gpt-5.4-mini',
          approvalReceived: plan.approvalReceived ?? context.approvalReceived ?? false,
          sanitizedOnly: plan.sanitizedOnly ?? context.sanitizedOnly ?? false,
          dangerGates: plan.dangerGates || context.dangerGates || [],
          taskTitle: plan.taskTitle || context.taskTitle || 'Agent handoff coordination gate',
          taskSummary: plan.taskSummary || context.taskSummary || '',
        }]);

  return rawItems.map((item, index) => ({
    itemId: String(item.itemId || item.id || `coord-${String(index + 1).padStart(2, '0')}`),
    agent: normalizeAgent(item.agent || item.assignedAgent || item.role || context.assignedAgent || 'gpt'),
    version: normalizeVersion(item.version || item.targetVersion || context.targetVersion || DEFAULT_TARGET_VERSION),
    repo: normalizeRepo(item.repo || item.targetRepo || context.targetRepo || DEFAULT_TARGET_REPO),
    scope: uniqueList(item.scope || item.taskScope || item.allowedScope || item.roleScope || item.taskType || item.taskTitle || item.taskSummary),
    taskTitle: String(item.taskTitle || item.title || context.taskTitle || 'Agent handoff coordination gate').trim(),
    taskSummary: String(item.taskSummary || item.summary || context.taskSummary || '').trim(),
    requestedModel: String(item.requestedModel || context.requestedModel || '').trim(),
    approvalReceived: item.approvalReceived ?? context.approvalReceived ?? false,
    sanitizedOnly: item.sanitizedOnly ?? context.sanitizedOnly ?? false,
    dangerGates: uniqueList(item.dangerGates || context.dangerGates || []),
    notes: String(item.notes || context.notes || '').trim(),
  }));
}

function allowedScopeMatches(agent, scopeText) {
  const role = ROLE_BOUNDARIES[agent];
  if (!role) return false;
  const text = String(scopeText || '').toLowerCase();
  return role.preferredScopes.some(scope => text.includes(String(scope).toLowerCase()));
}

function blockedScopeMatches(agent, scopeText) {
  const role = ROLE_BOUNDARIES[agent];
  if (!role) return true;
  const text = String(scopeText || '').toLowerCase();
  return role.blockedScopes.some(scope => text.includes(String(scope).toLowerCase()));
}

function buildWorkItemResult(item, context = {}) {
  const scopeText = scopeTextFrom(item);
  const dangerFlags = detectDangerFlags(compactText(scopeText, item.dangerGates, item.notes, item.requestedModel, item.version, item.repo));
  const workerScore = workerScorecard.getWorkerScorecard(item.agent);
  const requestedModelId = item.requestedModel || workerScore.modelId;
  const costAssessment = costLedger.evaluateRequestedModel(
    requestedModelId,
    { title: item.taskTitle, description: compactText(item.taskSummary, scopeText) },
    {
      approvalReceived: item.approvalReceived === true,
      externalSanitized: item.sanitizedOnly === true || workerScore.sanitizedOnly === true,
    },
  );

  const blockedReasons = [];
  const cautions = [];
  const humanGateReasons = [];

  if (!item.agent || !ROLE_BOUNDARIES[item.agent]) {
    blockedReasons.push(`unsupported agent: ${item.agent || '(empty)'}`);
  }

  if (!isAllowedRepo(item.repo)) {
    blockedReasons.push(`repo collision: ${item.repo || '(missing)'}`);
  }

  const owner = RESERVED_VERSION_OWNERS[item.version];
  if (owner && owner !== item.agent) {
    blockedReasons.push(`version collision: v${item.version} belongs to ${owner}, not ${item.agent}`);
  }

  if (item.version === DEFAULT_TARGET_VERSION && item.agent !== 'gpt') {
    blockedReasons.push(`v${DEFAULT_TARGET_VERSION} coordination gate must be owned by gpt`);
  }

  if (item.agent === 'gpt' && item.version && item.version !== DEFAULT_TARGET_VERSION) {
    blockedReasons.push(`gpt coordination gate must not claim v${item.version}`);
  }

  if (dangerFlags.salesDxDetected) {
    blockedReasons.push('salesDX/transcriber scope detected');
  }
  if (dangerFlags.anestyBoardDetected) {
    blockedReasons.push('ANESTY Board scope detected');
  }
  if (dangerFlags.secretLeakDetected) {
    blockedReasons.push('Secret/API key/.env/credentials detected');
  }
  if (dangerFlags.customerDataDetected) {
    blockedReasons.push('customer data detected');
  }
  if (dangerFlags.billingOrLeadManagementDetected) {
    blockedReasons.push('billing/lead management detected');
  }
  if (dangerFlags.ipCoreDetected) {
    blockedReasons.push('IP/core/full architecture detected');
  }

  if (item.agent === 'deepseek') {
    if (item.sanitizedOnly !== true && workerScore.sanitizedOnly !== true) {
      blockedReasons.push('DeepSeek/opencode must be sanitized_only');
    } else if (!allowedScopeMatches(item.agent, scopeText)) {
      blockedReasons.push('DeepSeek/opencode scope must stay small and sanitized');
    } else {
      cautions.push('external sanitized-only lane');
    }
  }

  if (item.agent === 'grok') {
    if (blockedScopeMatches(item.agent, scopeText) || /final decision|implementation|commit|push|deploy/i.test(scopeText)) {
      blockedReasons.push('Grok is review/breakthrough only, not implementation or final decision');
    } else if (!allowedScopeMatches(item.agent, scopeText)) {
      cautions.push('review/breakthrough lane only');
    }
  }

  if (item.agent === 'gemini') {
    if (item.version === DEFAULT_TARGET_VERSION) {
      blockedReasons.push('Gemini must not claim the GPT coordination slot');
    } else if (blockedScopeMatches(item.agent, scopeText)) {
      blockedReasons.push('Gemini scope collision');
    } else if (!allowedScopeMatches(item.agent, scopeText)) {
      cautions.push('Gemini is reserved for cautious review / Google-IAM support');
    }
  }

  if (item.agent === 'claude') {
    if (item.version === DEFAULT_TARGET_VERSION) {
      blockedReasons.push('Claude must not claim the GPT coordination slot');
    } else if (blockedScopeMatches(item.agent, scopeText)) {
      blockedReasons.push('Claude scope collision');
    } else if (!allowedScopeMatches(item.agent, scopeText)) {
      cautions.push('Claude lane is implementation/final review only');
    }
  }

  if (item.agent === 'gpt' && !scopeText.toLowerCase().includes('coordination') && !scopeText.toLowerCase().includes('handoff')) {
    blockedReasons.push('GPT coordination lane must remain coordination/handoff only');
  }

  if (costAssessment.selectionBlocked) {
    humanGateReasons.push(costAssessment.approvalRequired ? 'high cost model requires explicit human approval' : 'requested model blocked by policy');
  }
  if (costAssessment.approvalRequired && !costAssessment.approvalReceived) {
    humanGateReasons.push('high cost model needs explicit approval before use');
  }
  if (costAssessment.approvalRequired && costAssessment.approvalReceived) {
    cautions.push('high cost model approved explicitly');
  }

  if (item.requestedModel === 'gpt-5.5' && !costAssessment.approvalReceived) {
    humanGateReasons.push('gpt-5.5 requires explicit human approval');
  }

  const coordinationReason = compactText(
    item.taskTitle,
    item.taskSummary,
    `agent=${item.agent}`,
    item.version ? `v${item.version}` : '',
    item.repo ? `repo=${item.repo}` : '',
    blockedReasons[0] || humanGateReasons[0] || cautions[0] || 'coordination checked',
  );

  let status = STATUS.safe;
  if (blockedReasons.length > 0) {
    status = STATUS.blocked;
  } else if (humanGateReasons.length > 0) {
    status = STATUS.human_gate;
  } else if (cautions.length > 0 || item.agent === 'deepseek' || item.agent === 'grok' || item.agent === 'claude' || item.agent === 'gemini') {
    status = STATUS.caution;
  }

  const nextAllowedAction = status === STATUS.blocked
    ? 'revise_handoff_plan_and_resubmit'
    : status === STATUS.human_gate
      ? 'request_human_approval'
      : status === STATUS.caution
        ? 'proceed_with_guardrails'
        : 'proceed';

  return {
    itemId: item.itemId,
    assignedAgent: item.agent,
    targetVersion: item.version || null,
    targetRepo: item.repo || null,
    scope: item.scope,
    requestedModel: item.requestedModel || requestedModelId,
    approvalReceived: item.approvalReceived === true,
    sanitizedOnly: item.sanitizedOnly === true || workerScore.sanitizedOnly === true,
    status,
    blockedReasons: uniqueList(blockedReasons),
    cautions: uniqueList(cautions),
    humanGateRequired: status === STATUS.human_gate,
    humanGateReason: status === STATUS.human_gate ? uniqueList(humanGateReasons).join('; ') : 'human gate not required',
    nextAllowedAction,
    coordinationReason,
    dangerGates: uniqueList([
      ...(dangerFlags.hits || []),
      ...(item.dangerGates || []),
    ]),
    dangerFlags,
    costAssessment,
    workerScore,
    notes: item.notes || '',
  };
}

function summariseItems(itemResults) {
  const blockedReasons = [];
  const cautions = [];
  const humanGateReasons = [];
  const dangerGates = [];

  for (const item of itemResults) {
    blockedReasons.push(...(item.blockedReasons || []));
    cautions.push(...(item.cautions || []));
    dangerGates.push(...(item.dangerGates || []));
    if (item.humanGateRequired) {
      humanGateReasons.push(item.humanGateReason);
    }
  }

  const blocked = uniqueList(blockedReasons);
  const caution = uniqueList(cautions);
  const gateReasons = uniqueList(humanGateReasons);
  const collisionFlags = {
    versionCollisionDetected: blocked.some(reason => /version collision/i.test(reason)),
    repoCollisionDetected: blocked.some(reason => /repo collision/i.test(reason)),
    roleCollisionDetected: blocked.some(reason => /coordination slot|scope collision|unsupported agent|review\/breakthrough only|sanitized_only|cautious review|implementation or final decision/i.test(reason)),
    dangerGateDetected: blocked.some(reason => /secret|customer|billing|ip\/core|salesDX|ANESTY/i.test(reason)) || gateReasons.length > 0,
  };

  let status = STATUS.safe;
  if (blocked.length > 0) status = STATUS.blocked;
  else if (gateReasons.length > 0) status = STATUS.human_gate;
  else if (caution.length > 0) status = STATUS.caution;

  const humanGateRequired = status === STATUS.human_gate;
  const humanGateReason = humanGateRequired
    ? gateReasons[0] || 'coordination requires human approval'
    : 'human gate not required';

  const nextAllowedAction = status === STATUS.blocked
    ? 'revise_handoff_plan_and_resubmit'
    : status === STATUS.human_gate
      ? 'request_human_approval'
      : status === STATUS.caution
        ? 'proceed_with_guardrails'
        : 'proceed';

  return {
    status,
    blockedReasons: blocked,
    cautions: caution,
    humanGateRequired,
    humanGateReason,
    nextAllowedAction,
    coordinationReason: compactText(
      blocked[0] || gateReasons[0] || caution[0] || nextAllowedAction,
    ),
    dangerGates: uniqueList(dangerGates),
    ...collisionFlags,
  };
}

function buildCoordinationSummary(plan = {}, summary = {}, itemResults = []) {
  const assignedAgent = normalizeAgent(plan.assignedAgent || 'gpt');
  const targetVersion = normalizeVersion(plan.targetVersion || DEFAULT_TARGET_VERSION);
  const targetRepo = normalizeRepo(plan.targetRepo || DEFAULT_TARGET_REPO);
  const versionClaims = uniqueList(itemResults.map(item => item.targetVersion).filter(Boolean));
  const humanGateReason = summary.humanGateReason || 'human gate not required';
  const blockedReasons = summary.blockedReasons || [];
  const cautions = summary.cautions || [];
  return {
    assignedAgent,
    targetVersion,
    targetRepo,
    versionClaims,
    status: summary.status,
    blockedReasons,
    cautions,
    humanGateRequired: summary.humanGateRequired,
    humanGateReason,
    nextAllowedAction: summary.nextAllowedAction,
    roleBoundary: ROLE_BOUNDARIES[assignedAgent] || null,
    readyForHandoff: summary.status === STATUS.safe || summary.status === STATUS.caution,
  };
}

function buildAgentHandoffCoordinationGate(plan = {}, context = {}) {
  const assignedAgent = normalizeAgent(plan.assignedAgent || context.assignedAgent || 'gpt');
  const targetVersion = normalizeVersion(plan.targetVersion || context.targetVersion || DEFAULT_TARGET_VERSION);
  const targetRepo = normalizeRepo(plan.targetRepo || context.targetRepo || DEFAULT_TARGET_REPO);
  const workItems = buildWorkItems(plan, context);

  const topLevelBlockedReasons = [];
  if (assignedAgent !== 'gpt') {
    topLevelBlockedReasons.push(`coordination gate must be owned by gpt (got ${assignedAgent})`);
  }
  if (targetVersion !== DEFAULT_TARGET_VERSION) {
    topLevelBlockedReasons.push(`targetVersion must be v${DEFAULT_TARGET_VERSION} for the coordination gate`);
  }
  if (!isAllowedRepo(targetRepo)) {
    topLevelBlockedReasons.push(`targetRepo must be ${DEFAULT_TARGET_REPO}`);
  }

  const itemResults = workItems.map(item => buildWorkItemResult(item, context));
  const summary = summariseItems(itemResults);
  const blockedReasons = uniqueList([...topLevelBlockedReasons, ...summary.blockedReasons]);
  const cautions = uniqueList(summary.cautions);

  let status = summary.status;
  if (topLevelBlockedReasons.length > 0) {
    status = STATUS.blocked;
  }

  const humanGateRequired = status === STATUS.human_gate;
  const humanGateReason = humanGateRequired
    ? summary.humanGateReason
    : 'human gate not required';

  const coordinationTask = {
    title: plan.taskTitle || context.taskTitle || 'Agent handoff coordination gate',
    description: compactText(
      plan.taskSummary,
      context.taskSummary,
      `assignedAgent=${assignedAgent}`,
      `targetVersion=v${targetVersion}`,
      `targetRepo=${targetRepo}`,
      blockedReasons.join('; '),
      cautions.join('; '),
    ),
    file_scope: uniqueList([
      ...(Array.isArray(plan.allowedFiles) ? plan.allowedFiles : []),
      ...(Array.isArray(plan.changedFiles) ? plan.changedFiles : []),
    ]),
  };

  const coordinatorScorecard = workerScorecard.getWorkerScorecard('gpt-5.4-mini');
  const costPolicy = costLedger.buildLedgerRecord(coordinationTask, {
    verifyRunCount: Number(context.verifyRunCount || 0),
    approvalReceived: context.approvalReceived === true,
  });

  const coordinationPacket = {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    dryRun: true,
    assignedAgent,
    targetVersion,
    targetRepo,
    status,
    blockedReasons,
    cautions,
    humanGateRequired,
    humanGateReason,
    nextAllowedAction: summary.nextAllowedAction,
    coordinationReason: summary.coordinationReason || compactText(
      plan.taskTitle || context.taskTitle || 'Agent handoff coordination gate',
      summary.nextAllowedAction,
    ),
    versionCollisionDetected: summary.versionCollisionDetected,
    repoCollisionDetected: summary.repoCollisionDetected,
    roleCollisionDetected: summary.roleCollisionDetected,
    dangerGateDetected: summary.dangerGateDetected,
    dangerGates: summary.dangerGates,
    workItems: itemResults,
    coordinationSummary: buildCoordinationSummary(plan, summary, itemResults),
    approvalReceived: context.approvalReceived === true,
    requestedModel: plan.requestedModel || context.requestedModel || 'gpt-5.4-mini',
    costPolicy,
    coordinatorScorecard,
  };

  const routerExplanation = explainability.buildRouterExplanation(
    coordinationTask,
    {
      selectedWorker: coordinatorScorecard.workerName,
      selectedModel: coordinatorScorecard.modelId,
      modelTier: coordinatorScorecard.modelTier,
      taskType: 'handoff_coordination',
      reason: compactText(
        status,
        assignedAgent ? `assignedAgent=${assignedAgent}` : '',
        targetVersion ? `targetVersion=v${targetVersion}` : '',
        targetRepo ? `targetRepo=${targetRepo}` : '',
        blockedReasons[0] || cautions[0] || humanGateReason,
      ),
      costPolicy,
      workerScorecard: coordinatorScorecard,
      coordinationGate: coordinationPacket,
      humanGateRequired,
      humanGateReason,
      approvalRequired: false,
      safetyNotes: compactText(
        status === STATUS.safe ? 'handoff coordination safe.' : '',
        status === STATUS.caution ? 'handoff coordination caution.' : '',
        status === STATUS.human_gate ? 'handoff coordination requires human approval.' : '',
        status === STATUS.blocked ? 'handoff coordination blocked.' : '',
      ),
    },
    {
      requestedModel: coordinationPacket.requestedModel,
      approvalReceived: coordinationPacket.approvalReceived,
      coordinationGate: coordinationPacket,
    },
  );

  return {
    ...coordinationPacket,
    routerExplanation,
    safetyNotes: uniqueList([
      ...blockedReasons,
      ...cautions,
      routerExplanation.safetyNotes,
      status === STATUS.safe ? 'v110.63 and v110.65 ownership collision checks remain reserved.' : null,
      status === STATUS.caution ? 'parallel agents may continue, but review the cautions.' : null,
      status === STATUS.human_gate ? 'human approval required before coordination proceeds.' : null,
      status === STATUS.blocked ? 'revise the handoff plan before proceeding.' : null,
    ]),
  };
}

function evaluateAgentHandoffCoordination(plan, context = {}) {
  return buildAgentHandoffCoordinationGate(plan, context);
}

module.exports = {
  TOOL_META,
  STATUS,
  HUMAN_GATE,
  DEFAULT_TARGET_REPO,
  DEFAULT_TARGET_VERSION,
  RESERVED_VERSION_OWNERS,
  ROLE_BOUNDARIES,
  buildAgentHandoffCoordinationGate,
  evaluateAgentHandoffCoordination,
  buildWorkItems,
  buildWorkItemResult,
  detectDangerFlags,
  normalizeAgent,
  normalizeRepo,
  normalizeVersion,
};
