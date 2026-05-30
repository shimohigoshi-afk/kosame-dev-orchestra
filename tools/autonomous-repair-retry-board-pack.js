'use strict';

const TOOL_META = {
  version: '9.5.0',
  title: 'Autonomous Repair & Retry Board',
  slug: 'autonomous-repair-retry-board-pack'
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const FAILURE_TYPES = [
  'syntax_error',
  'verify_failure',
  'missing_file',
  'provider_unavailable',
  'safety_block',
  'unclear_spec',
  'human_approval_required',
  'repeated_failure'
];

const RETRY_TARGETS = {
  syntax_error:             { agent: 'claude',  action: 'fix syntax error in implementation', maxRetries: 3 },
  verify_failure:           { agent: 'claude',  action: 'fix failing verify / smoke tests',   maxRetries: 3 },
  missing_file:             { agent: 'claude',  action: 'create missing file',                maxRetries: 2 },
  provider_unavailable:     { agent: 'fallback', action: 'route to available fallback provider', maxRetries: 2 },
  safety_block:             { agent: 'kosame',  action: 'review safety block — escalate to kosame', maxRetries: 1 },
  unclear_spec:             { agent: 'kosame',  action: 'route to Gemini for spec clarification, kosame for arbitration', maxRetries: 2 },
  human_approval_required:  { agent: 'human',   action: 'route to じゅんやさん for final YES/NO', maxRetries: 1 },
  repeated_failure:         { agent: 'stop',    action: 'stop — repeated failure limit reached, escalate to こさめ', maxRetries: 0 }
};

const FALLBACK_PROVIDER_CHAIN = ['claude', 'grok', 'kosame', 'human'];

function generateRepairBoardId(failedStep) {
  const ts = Date.now();
  const slug = String(failedStep || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `repair-${slug}-${ts}`;
}

function classifyFailure(failureType, errorSummary, previousAttempts) {
  const normalized = FAILURE_TYPES.includes(failureType) ? failureType : 'verify_failure';
  const attemptCount = Number(previousAttempts) || 0;

  if (attemptCount >= 3 && normalized !== 'human_approval_required') {
    return { classified: 'repeated_failure', original: normalized, attemptCount };
  }

  const syntaxKeywords = /syntaxerror|unexpected token|parse error/i;
  const verifyKeywords = /fail|error|assert|smoke/i;
  const missingKeywords = /cannot find module|no such file|enoent/i;
  const providerKeywords = /unavailable|timeout|rate limit|503|502/i;
  const safetyKeywords = /blocked|safety|forbidden|denied|level c/i;

  if (normalized === 'verify_failure' && errorSummary) {
    const text = String(errorSummary);
    if (syntaxKeywords.test(text)) return { classified: 'syntax_error', original: normalized, attemptCount };
    if (missingKeywords.test(text)) return { classified: 'missing_file', original: normalized, attemptCount };
    if (providerKeywords.test(text)) return { classified: 'provider_unavailable', original: normalized, attemptCount };
    if (safetyKeywords.test(text)) return { classified: 'safety_block', original: normalized, attemptCount };
  }

  return { classified: normalized, original: normalized, attemptCount };
}

function buildRetryTarget(failureClassification, providerStatus) {
  const { classified } = failureClassification;
  const def = RETRY_TARGETS[classified] || RETRY_TARGETS.verify_failure;

  let resolvedAgent = def.agent;
  if (def.agent === 'fallback') {
    const available = FALLBACK_PROVIDER_CHAIN.filter(p => {
      if (!providerStatus) return true;
      return providerStatus[p] !== 'unavailable';
    });
    resolvedAgent = available[0] || 'kosame';
  }

  const shouldStop = classified === 'repeated_failure' || def.maxRetries === 0;

  return {
    agent: resolvedAgent,
    action: def.action,
    maxRetries: def.maxRetries,
    shouldStop,
    stopReason: shouldStop ? 'repeated_failure or maxRetries=0 — escalate to こさめ' : null
  };
}

function buildRepairInstructionPacket(failureType, failedStep, errorSummary, retryTarget, riskLevel, dataLevel) {
  return {
    failureType,
    failedStep,
    errorSummary: String(errorSummary || '(no error summary)').slice(0, 500),
    repairOwner: retryTarget.agent,
    repairAction: retryTarget.action,
    repairSteps: buildRepairSteps(retryTarget.agent, failureType),
    riskLevel,
    dataLevel,
    noAutoFileWrite: true,
    note: '自動修正を実行しない。実ファイルを書き換えない。repair instruction packetを生成するだけ。',
    generatedAt: new Date().toISOString()
  };
}

function buildRepairSteps(agent, failureType) {
  const stepsMap = {
    claude: [
      'Read error summary carefully',
      'Identify root cause in failing file',
      'Apply minimal fix (no unrelated changes)',
      'Re-run node --check on modified files',
      'Re-run relevant smoke test',
      'Re-run npm run verify',
      'Report result to こさめ'
    ],
    kosame: [
      'Review safety block or spec ambiguity',
      'Clarify specification with Gemini if needed',
      'Make go/no-go decision',
      'Route back to claude if safe to retry, else escalate to human'
    ],
    human: [
      'Review escalation summary',
      'Provide final YES/NO decision',
      'じゅんやさんは最終YESのみ — 作業員に戻さない'
    ],
    stop: [
      'STOP: repeated failure limit reached',
      'Escalate full error history to こさめ副社長',
      'Do not retry automatically'
    ]
  };
  return stepsMap[agent] || stepsMap.stop;
}

function buildEscalationPolicy(riskLevel, retryTarget) {
  return {
    escalateTo: retryTarget.shouldStop ? 'こさめ副社長' : 'claude (retry)',
    maxRetries: retryTarget.maxRetries,
    escalateAfterRetries: retryTarget.maxRetries,
    highRiskEscalation: riskLevel === 'high' || riskLevel === 'critical'
      ? 'Immediate escalation to こさめ副社長 — no auto retry on high/critical risk'
      : null
  };
}

function buildStopConditions() {
  return [
    'repeated_failure: 3+ consecutive failures → stop and escalate',
    'safety_block: always escalate to kosame — no auto retry',
    'human_approval_required: always route to human — never auto-bypass',
    'provider_unavailable after all fallbacks tried → escalate to kosame',
    'riskLevel=critical: no auto retry — always human approval first'
  ];
}

function buildPacket(input) {
  const failureType      = String(input.failureType || 'verify_failure');
  const failedStep       = String(input.failedStep  || '(unknown step)');
  const errorSummary     = input.errorSummary     || null;
  const providerStatus   = input.providerStatus   || {};
  const previousAttempts = Number(input.previousAttempts) || 0;
  const riskLevel        = ['low', 'medium', 'high', 'critical'].includes(input.riskLevel) ? input.riskLevel : 'low';
  const dataLevel        = ['A', 'B', 'C'].includes(input.dataLevel) ? input.dataLevel : 'A';

  const repairBoardId         = generateRepairBoardId(failedStep);
  const failureClassification = classifyFailure(failureType, errorSummary, previousAttempts);
  const retryTargetAgent      = buildRetryTarget(failureClassification, providerStatus);
  const repairInstructionPacket = buildRepairInstructionPacket(
    failureClassification.classified, failedStep, errorSummary, retryTargetAgent, riskLevel, dataLevel
  );
  const retryLimit         = retryTargetAgent.maxRetries;
  const escalationPolicy   = buildEscalationPolicy(riskLevel, retryTargetAgent);
  const stopConditions     = buildStopConditions();
  const humanApprovalRequired = ['safety_block', 'human_approval_required', 'repeated_failure'].includes(failureClassification.classified)
    || riskLevel === 'critical';

  const recommendedNextAction = retryTargetAgent.shouldStop
    ? 'STOP — escalate to こさめ副社長 immediately'
    : `Route repair instruction to ${retryTargetAgent.agent}`;

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired,
    repairBoardId,
    failureClassification,
    retryTargetAgent,
    repairInstructionPacket,
    retryLimit,
    escalationPolicy,
    stopConditions,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    failureType:       process.env.KOSAME_FAILURE_TYPE       || 'syntax_error',
    failedStep:        process.env.KOSAME_FAILED_STEP        || 'implementation',
    errorSummary:      process.env.KOSAME_ERROR_SUMMARY      || 'SyntaxError: Unexpected token } at line 42',
    providerStatus:    {},
    previousAttempts:  0,
    riskLevel:         process.env.KOSAME_RISK_LEVEL         || 'low',
    dataLevel:         process.env.KOSAME_DATA_LEVEL         || 'A'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  FAILURE_TYPES,
  RETRY_TARGETS,
  FALLBACK_PROVIDER_CHAIN,
  BLOCKED_DANGEROUS_ACTIONS,
  generateRepairBoardId,
  classifyFailure,
  buildRetryTarget,
  buildRepairInstructionPacket,
  buildRepairSteps,
  buildEscalationPolicy,
  buildStopConditions,
  buildPacket
};
