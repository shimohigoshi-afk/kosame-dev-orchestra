'use strict';

const TOOL_META = {
  version: '69.0.0',
  title:   'KOSAME Dev Orchestra Guardian Defensive Red Team Dry-Run Pack',
  slug:    'dev-agent-guardian-defensive-red-team-dry-run-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real exploit execution',
  'real penetration test without authorization',
  'real attack simulation against production'
];

const DEFAULT_RED_TEAM_SCENARIOS = [
  {
    scenarioId:    'rt-001',
    name:          'Secret leak via log output',
    attackVector:  'API key or token accidentally logged to Cloud Logging',
    dryRunTest:    'Search Cloud Logging query for known secret patterns (regex scan on log entries)',
    defenseCheck:  'No secret values appear in logs',
    expectedResult: 'No secrets found in logs',
    severity:      'critical',
    status:        'dry_run_pending',
    realAttack:    false
  },
  {
    scenarioId:    'rt-002',
    name:          'Unauthorized API endpoint access',
    attackVector:  'Unauthenticated request to Cloud Run endpoint that should require auth',
    dryRunTest:    'Review Cloud Run authentication configuration (not actual exploit attempt)',
    defenseCheck:  'Authentication is enforced on all sensitive endpoints',
    expectedResult: 'All sensitive endpoints require valid token',
    severity:      'critical',
    status:        'dry_run_pending',
    realAttack:    false
  },
  {
    scenarioId:    'rt-003',
    name:          'Customer data cross-tenant access',
    attackVector:  'User from tenant A accessing tenant B data via manipulated request',
    dryRunTest:    'Code review: verify tenant ID is validated on every data access',
    defenseCheck:  'Tenant isolation is enforced at code level',
    expectedResult: 'Tenant isolation verified in code',
    severity:      'critical',
    status:        'dry_run_pending',
    realAttack:    false
  },
  {
    scenarioId:    'rt-004',
    name:          'Prompt injection via user input',
    attackVector:  'Malicious user input that modifies AI system prompt behavior',
    dryRunTest:    'Review prompt construction code for injection-safe patterns',
    defenseCheck:  'User input is sanitized before inclusion in AI prompts',
    expectedResult: 'Prompt injection mitigated in code review',
    severity:      'high',
    status:        'dry_run_pending',
    realAttack:    false
  },
  {
    scenarioId:    'rt-005',
    name:          'Insecure direct object reference (IDOR)',
    attackVector:  'Incrementing IDs to access other users\' records',
    dryRunTest:    'Code review: verify authorization check on every resource access',
    defenseCheck:  'Resource ownership is validated, not just authentication',
    expectedResult: 'Authorization checks confirmed in code',
    severity:      'high',
    status:        'dry_run_pending',
    realAttack:    false
  },
  {
    scenarioId:    'rt-006',
    name:          'Insurance disclosure duty violation via AI output',
    attackVector:  'AI generates text that inadvertently constitutes disclosure duty violation',
    dryRunTest:    'Review AI output guardrails for insurance-specific prohibited expressions',
    defenseCheck:  'AI output filtered for disclosure-duty-violating expressions',
    expectedResult: 'Guardrails confirmed for insurance sales context',
    severity:      'critical',
    status:        'dry_run_pending',
    realAttack:    false
  }
];

function evaluateDefenseStatus(scenarios, overrides) {
  overrides = overrides || {};
  const results = scenarios.map(s => ({
    ...s,
    status: overrides[s.scenarioId] || s.status
  }));
  const criticalFailed = results.filter(s => s.severity === 'critical' && s.status === 'defense_failed');
  if (criticalFailed.length > 0) return { overallStatus: 'DEFENSE_FAILED', failedScenarios: criticalFailed.map(s => s.scenarioId) };
  const anyFailed = results.some(s => s.status === 'defense_failed');
  if (anyFailed) return { overallStatus: 'PARTIAL_DEFENSE_FAILURE', failedScenarios: [] };
  return { overallStatus: 'DRY_RUN_PENDING', failedScenarios: [] };
}

function buildRedTeamDryRun(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const runId  = `red-team-dry-run-${now}`;
  const scenarios = opts.scenarios || JSON.parse(JSON.stringify(DEFAULT_RED_TEAM_SCENARIOS));
  const defenseEval = evaluateDefenseStatus(scenarios, opts.overrideStatuses);

  return {
    runId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    product:               opts.product || 'KOSAME Dev Orchestra',
    redTeamScenarios:      scenarios,
    defenseCheckResults:   scenarios.map(s => ({
      scenarioId:    s.scenarioId,
      name:          s.name,
      status:        (opts.overrideStatuses || {})[s.scenarioId] || s.status,
      realAttack:    false
    })),
    overallStatus:         defenseEval.overallStatus,
    failedScenarios:       defenseEval.failedScenarios,
    realAttackExecuted:    false,
    recommendations: opts.recommendations || [
      '全シナリオのdry_run_pendingを完了させてから本番公開を判断する',
      'critical severity のシナリオは外部SE / セキュリティ専門家にレビューを依頼する',
      '実ペネトレーションテストは別途人間承認ゲートを通す'
    ],
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_RED_TEAM_SCENARIOS,
  evaluateDefenseStatus,
  buildRedTeamDryRun
};

if (require.main === module) {
  const result = buildRedTeamDryRun({});
  console.log(JSON.stringify(result, null, 2));
}
