'use strict';

const TOOL_META = {
  version: '7.3.0',
  title: 'Result Import & Review Pack',
  slug: 'result-import-review-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const PROVIDERS = ['claude', 'gemini', 'grok', 'deepseek', 'kimi', 'kosame', 'human'];

const REVIEW_STATUSES = [
  'success', 'failure', 'incomplete', 'needs_repair', 'pending_approval'
];

const BLOCKED_DANGEROUS_ACTIONS = [
  'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard', 'git clean',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance policy sharing',
  'health check info sharing', 'personal name in minutes sharing'
];

const FAILURE_INDICATORS = [
  'error', 'Error', 'ERROR',
  'failed', 'FAILED', 'fail',
  'exception', 'Exception',
  'AssertionError', 'TypeError', 'SyntaxError', 'ReferenceError',
  'not found', 'undefined is not', 'cannot read',
  'npm ERR', 'node:internal',
  'PASS: 0', 'FAIL:'
];

const SUCCESS_INDICATORS = [
  'PASS:', 'pass:', 'success', 'Success', 'SUCCESS',
  'completed', 'done', 'Done',
  '✓', '✔', 'passed',
  'npm run verify: OK', 'smoke PASS'
];

const INCOMPLETE_INDICATORS = [
  'TODO', 'FIXME', 'WIP', 'work in progress',
  'not implemented', 'placeholder', 'stub',
  'incomplete', 'partial', 'in progress'
];

function detectStatus(providerResult) {
  const text = typeof providerResult === 'string'
    ? providerResult
    : JSON.stringify(providerResult || '');

  if (typeof providerResult === 'object' && providerResult !== null) {
    if (providerResult.status && REVIEW_STATUSES.includes(providerResult.status)) {
      return providerResult.status;
    }
    if (providerResult.success === true)  return 'success';
    if (providerResult.success === false) return 'failure';
    if (providerResult.approvalRequired === true) return 'pending_approval';
  }

  const hasFailure     = FAILURE_INDICATORS.some(kw => text.includes(kw));
  const hasSuccess     = SUCCESS_INDICATORS.some(kw => text.includes(kw));
  const hasIncomplete  = INCOMPLETE_INDICATORS.some(kw => text.toLowerCase().includes(kw.toLowerCase()));

  if (hasFailure)    return 'failure';
  if (hasIncomplete) return 'incomplete';
  if (hasSuccess)    return 'success';

  return 'incomplete';
}

function identifyIssues(text, status) {
  const issues = [];
  const t = typeof text === 'string' ? text : JSON.stringify(text || '');

  if (t.includes('SyntaxError'))     issues.push({ type: 'syntax_error',    description: 'SyntaxError detected in output' });
  if (t.includes('AssertionError'))  issues.push({ type: 'verify_failure',  description: 'AssertionError — smoke/test failed' });
  if (t.includes('not found') || t.includes('Cannot find module'))
                                     issues.push({ type: 'missing_file',    description: 'File or module not found' });
  if (t.includes('TypeError'))       issues.push({ type: 'type_error',      description: 'TypeError detected' });
  if (t.includes('ReferenceError'))  issues.push({ type: 'reference_error', description: 'ReferenceError detected' });
  if (t.includes('npm ERR'))         issues.push({ type: 'npm_error',       description: 'npm error detected' });
  if (t.toLowerCase().includes('undefined'))
                                     issues.push({ type: 'undefined_value', description: 'Undefined value encountered' });
  if (t.includes('TODO') || t.includes('FIXME'))
                                     issues.push({ type: 'incomplete',      description: 'TODO/FIXME markers found — task incomplete' });

  if (status === 'failure' && issues.length === 0) {
    issues.push({ type: 'unknown_failure', description: 'Failure detected but specific error type unclear — route to kosame' });
  }
  return issues;
}

function normalizeResult(providerResult, provider, taskGoal) {
  const raw = typeof providerResult === 'string' ? providerResult : JSON.stringify(providerResult || '(empty result)');
  return {
    provider: PROVIDERS.includes(provider) ? provider : 'unknown',
    taskGoal: String(taskGoal || '').trim(),
    rawResult: raw.slice(0, 2000),
    rawTruncated: raw.length > 2000,
    importedAt: new Date().toISOString()
  };
}

function determineNextAction(status, issues, provider, productLine) {
  if (status === 'success' && issues.length === 0) {
    return 'Route to kosame for final review and approval packet generation';
  }
  if (status === 'pending_approval') {
    return 'Route to human for final YES/NO approval';
  }
  if (issues.some(i => i.type === 'syntax_error')) {
    return 'Route to claude for syntax error repair';
  }
  if (issues.some(i => i.type === 'verify_failure')) {
    return 'Route to claude for verify failure repair';
  }
  if (issues.some(i => i.type === 'missing_file')) {
    return 'Route to claude for missing file repair';
  }
  if (issues.some(i => i.type === 'incomplete')) {
    return `Re-dispatch to ${provider} with clarified doneCriteria`;
  }
  if (issues.some(i => i.type === 'unknown_failure')) {
    return 'Route to kosame — unclear failure, requires human triage';
  }
  if (status === 'failure') {
    return 'Route to repair-loop-controller for failure analysis';
  }
  if (status === 'incomplete') {
    return `Re-dispatch to ${provider} with more specific task breakdown`;
  }
  return 'Route to kosame for review';
}

function generateImportId(provider, taskGoal) {
  const ts = Date.now();
  const slug = String(taskGoal || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `import-${provider}-${slug}-${ts}`;
}

function buildPacket(input) {
  const providerResult = input.providerResult !== undefined ? input.providerResult : '(no result provided)';
  const provider       = PROVIDERS.includes(input.provider) ? input.provider : 'unknown';
  const taskGoal       = String(input.taskGoal    || '(task goal)').trim();
  const taskType       = String(input.taskType    || 'implementation');
  const productLine    = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';

  const importId       = generateImportId(provider, taskGoal);
  const normalizedResult = normalizeResult(providerResult, provider, taskGoal);
  const detectedStatus = detectStatus(providerResult);
  const issues         = identifyIssues(providerResult, detectedStatus);
  const nextAction     = determineNextAction(detectedStatus, issues, provider, productLine);

  const reviewDecision = {
    status: detectedStatus,
    issueCount: issues.length,
    issues,
    approved: detectedStatus === 'success' && issues.length === 0,
    requiresRepair: detectedStatus === 'failure' || detectedStatus === 'incomplete' || issues.length > 0,
    requiresHumanApproval: detectedStatus === 'pending_approval' || productLine === 'anesty_board',
    reviewedAt: new Date().toISOString()
  };

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    importId,
    taskGoal,
    taskType,
    productLine,
    provider,
    normalizedResult,
    reviewDecision,
    recommendedNextAction: nextAction,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS
  };
}

function main() {
  const sampleResult = process.env.KOSAME_PROVIDER_RESULT || 'PASS: all smoke tests passed. npm run verify: OK. Files changed: tools/example.js';
  console.log(JSON.stringify(buildPacket({
    providerResult: sampleResult,
    provider:       process.env.KOSAME_PROVIDER     || 'claude',
    taskGoal:       process.env.KOSAME_TASK_GOAL    || 'implement release note generator',
    taskType:       process.env.KOSAME_TASK_TYPE    || 'implementation',
    productLine:    process.env.KOSAME_PRODUCT_LINE || 'backoffice'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  PROVIDERS,
  REVIEW_STATUSES,
  BLOCKED_DANGEROUS_ACTIONS,
  FAILURE_INDICATORS,
  SUCCESS_INDICATORS,
  INCOMPLETE_INDICATORS,
  detectStatus,
  identifyIssues,
  normalizeResult,
  determineNextAction,
  generateImportId,
  buildPacket
};
