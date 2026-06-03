'use strict';

const TOOL_META = {
  version: '38.0.0',
  title: 'First Real Product Repo Result Acceptance Gate',
  slug: 'first-real-product-repo-result-acceptance-gate'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_CANDIDATES = {
  sales_dx:           'kosame-sales-dx',
  anesty_board:       'kosame-anesty-board',
  backoffice_agent:   'kosame-backoffice-agent',
  email_reply_bot:    'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy (any form)',
  'docker build',
  'gcloud deploy',
  'git push (automated)',
  'git tag (automated)',
  'git commit (automated)',
  'git add (automated)',
  'secret read',
  'env read',
  'customer data read',
  'destructive delete (rm -rf, git clean -f, git reset --hard)'
];

const SECRET_PATTERNS = [
  'api key', 'api_key', 'secret', '.env', 'password', 'token',
  'credential', 'private key', 'access key', 'bearer', 'auth key'
];

const CUSTOMER_DATA_PATTERNS = [
  'insurance', 'health record', 'patient', 'policyholder', 'employee salary',
  'financial record', 'personal info', 'pii', '個人情報', '保険証券', '健診', '診察',
  '氏名', '住所', '電話番号'
];

const DANGEROUS_OP_PATTERNS = [
  'git commit', 'git push', 'git tag', 'git reset --hard',
  'git clean -f', 'rm -rf', 'deploy', 'gcloud deploy', 'docker build'
];

const FORBIDDEN_FILE_PATTERNS = [
  '.env', 'secrets/', 'credentials/', 'private/', '.ssh/',
  'config/secrets', 'config/credentials', 'insurance/', 'health/'
];

const DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

function scanText(text, patterns) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  return patterns.filter(p => lower.includes(p.toLowerCase()));
}

function checkForbiddenFiles(files) {
  if (!files || files.length === 0) return { clean: true, found: [] };
  const found = files.filter(f => FORBIDDEN_FILE_PATTERNS.some(p => f.toLowerCase().includes(p)));
  return { clean: found.length === 0, found };
}

function checkAllowedFiles(files, allowedZones) {
  if (!files || files.length === 0) return { clean: false, reason: 'No files reported' };
  if (!allowedZones || allowedZones.length === 0) return { clean: true, reason: 'No zone restrictions' };
  const denied = files.filter(f => !allowedZones.some(z => {
    const zone = z.replace(/^\.\//, '').replace(/\/\*\*.*$/, '');
    return f.startsWith(zone) || f === zone;
  }));
  return denied.length === 0
    ? { clean: true, reason: 'All files within allowed zones' }
    : { clean: false, reason: `Out-of-zone files: ${denied.join(', ')}` };
}

function buildAcceptanceGate(input) {
  const gateId        = `acceptance-gate-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const reportedTaskSummary = String(input.reportedTaskSummary || '').trim();
  const changedFiles        = input.changedFiles || [];
  const allowedZones        = input.allowedFileZones || ['docs/**', 'README.md', 'smoke/**'];
  const verificationRaw     = String(input.verificationRaw || '').toLowerCase();
  const businessIntentNote  = String(input.businessIntentNote || '').trim();

  const allReportText = [reportedTaskSummary, JSON.stringify(changedFiles), verificationRaw, businessIntentNote].join(' ');

  const secretLeakReview = {
    found: scanText(allReportText, SECRET_PATTERNS),
    clean: scanText(allReportText, SECRET_PATTERNS).length === 0
  };
  const customerDataLeakReview = {
    found: scanText(allReportText, CUSTOMER_DATA_PATTERNS),
    clean: scanText(allReportText, CUSTOMER_DATA_PATTERNS).length === 0
  };
  const forbiddenScopeReview = checkForbiddenFiles(changedFiles);
  const allowedFilesReview   = checkAllowedFiles(changedFiles, allowedZones);
  const dangerousOps         = scanText(allReportText, DANGEROUS_OP_PATTERNS);
  const dangerousOperationReview = { found: dangerousOps, clean: dangerousOps.length === 0 };

  const verificationPassed =
    verificationRaw.includes('pass') &&
    !verificationRaw.includes('fail') &&
    !/[1-9]\d* error/.test(verificationRaw) &&
    !verificationRaw.includes('exit code 1');

  const changedFilesReview    = { files: changedFiles, count: changedFiles.length, allowedZones };
  const verificationReview    = { passed: verificationPassed, raw: input.verificationRaw || null };
  const safetyReview          = {
    secretLeak:       secretLeakReview,
    customerDataLeak: customerDataLeakReview,
    dangerousOps:     dangerousOperationReview,
    overallSafe:      secretLeakReview.clean && customerDataLeakReview.clean && dangerousOperationReview.clean
  };
  const businessIntentReview  = { note: businessIntentNote || '(not provided)', aligned: !!businessIntentNote };
  const forbiddenScopeCheck   = forbiddenScopeReview;

  const acceptedItems = [];
  const rejectedItems = [];
  const blockerItems  = [];

  if (verificationPassed)                   acceptedItems.push('verification passed');
  else                                      blockerItems.push('verification not passed');

  if (allowedFilesReview.clean)             acceptedItems.push('all files within allowed zones');
  else                                      blockerItems.push(allowedFilesReview.reason);

  if (forbiddenScopeCheck.clean)            acceptedItems.push('no forbidden scope files');
  else                                      rejectedItems.push(`forbidden scope: ${forbiddenScopeCheck.found.join(', ')}`);

  if (secretLeakReview.clean)               acceptedItems.push('no secret leak detected');
  else                                      rejectedItems.push(`secret leak: ${secretLeakReview.found.join(', ')}`);

  if (customerDataLeakReview.clean)         acceptedItems.push('no customer data leak detected');
  else                                      rejectedItems.push(`customer data leak: ${customerDataLeakReview.found.join(', ')}`);

  if (dangerousOperationReview.clean)       acceptedItems.push('no dangerous operations');
  else                                      rejectedItems.push(`dangerous ops: ${dangerousOps.join(', ')}`);

  const hasCriticalIssue = !secretLeakReview.clean || !customerDataLeakReview.clean || !dangerousOperationReview.clean || !forbiddenScopeCheck.clean;

  let acceptanceDecision;
  if (!isKnown) {
    acceptanceDecision = 'reject';
  } else if (rejectedItems.some(r => r.includes('secret') || r.includes('customer data') || r.includes('dangerous'))) {
    acceptanceDecision = 'hold';
  } else if (hasCriticalIssue) {
    acceptanceDecision = 'reject';
  } else if (blockerItems.length > 0) {
    acceptanceDecision = 'revise';
  } else if (rejectedItems.length > 0) {
    acceptanceDecision = 'reject';
  } else {
    acceptanceDecision = 'approve';
  }

  const commitCandidateReady =
    acceptanceDecision === 'approve' &&
    verificationPassed &&
    allowedFilesReview.clean &&
    forbiddenScopeCheck.clean &&
    secretLeakReview.clean &&
    customerDataLeakReview.clean &&
    dangerousOperationReview.clean;

  const needsHumanApproval = true;

  const recommendedNextAction = commitCandidateReady
    ? 'Acceptance gate: approve. Commit candidate ready. こさめ/GPT PM final review → じゅんやさん YES before git add/commit/push/tag.'
    : acceptanceDecision === 'hold'
      ? `HOLD: Critical issue detected (${rejectedItems[0]}). Escalate to じゅんやさん immediately. Do NOT proceed.`
      : acceptanceDecision === 'reject'
        ? `REJECT: ${rejectedItems.join('; ')}. Do not commit.`
        : `REVISE: ${blockerItems.join('; ')}`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    acceptanceGateId:         gateId,
    targetProduct,
    targetRepoCandidate:      repoCandidate,
    reportedTaskSummary,
    changedFilesReview,
    verificationReview,
    safetyReview,
    businessIntentReview,
    forbiddenScopeReview:     forbiddenScopeCheck,
    secretLeakReview,
    customerDataLeakReview,
    dangerousOperationReview,
    acceptedItems,
    rejectedItems,
    blockerItems,
    acceptanceDecision,
    decisionOptions:          DECISION_OPTIONS,
    commitCandidateReady,
    needsHumanApproval,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealCommit:             true,
    noRealPush:               true,
    noRealTag:                true,
    noRealDeploy:             true
  };
}

function main() {
  console.log(JSON.stringify(buildAcceptanceGate({
    targetProduct:        'email_reply_bot',
    reportedTaskSummary:  'README.md に目次・概要セクションを追加。1ファイル変更。検証パス。Secretなし。',
    changedFiles:         ['README.md'],
    allowedFileZones:     ['docs/**', 'README.md', 'smoke/**'],
    verificationRaw:      'All tests passed.',
    businessIntentNote:   'Email Reply BOT の README 整備完了。docs限定変更。'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  SECRET_PATTERNS,
  CUSTOMER_DATA_PATTERNS,
  FORBIDDEN_FILE_PATTERNS,
  DECISION_OPTIONS,
  buildAcceptanceGate
};
