'use strict';

const TOOL_META = {
  version: '29.0.0',
  title: 'First Product Repo Result Review Console',
  slug: 'first-product-repo-result-review-console'
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
  'credential', 'private key', 'access key', 'bearer'
];

const CUSTOMER_DATA_PATTERNS = [
  'insurance', 'health record', 'patient', 'policyholder',
  'employee salary', 'financial record', 'personal info', 'pii',
  '個人情報', '保険証券', '健診', '診察'
];

const FORBIDDEN_FILE_PATTERNS = [
  '.env', '.env.production', '.env.local', 'secrets/', 'credentials/',
  'private/', '.ssh/', 'config/secrets', 'config/credentials'
];

const DANGEROUS_OP_PATTERNS = [
  'git commit', 'git push', 'git tag', 'git reset --hard',
  'git clean -f', 'rm -rf', 'deploy', 'gcloud deploy', 'docker build'
];

function scanText(text, patterns) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  return patterns.filter(p => lower.includes(p.toLowerCase()));
}

function checkForbiddenFiles(files) {
  if (!files || files.length === 0) return { clean: true, found: [] };
  const found = files.filter(f =>
    FORBIDDEN_FILE_PATTERNS.some(p => f.toLowerCase().includes(p.toLowerCase()))
  );
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

function buildResultReviewConsole(input) {
  const reviewId      = `result-review-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const claudeReportInputSummary = String(input.claudeReportInputSummary || '').trim();
  const changedFiles             = input.changedFiles || [];
  const allowedZones             = input.allowedFileZones || ['src/**', 'docs/**', 'tests/**'];
  const verificationRaw          = String(input.verificationRaw || '').toLowerCase();
  const businessIntentNote       = String(input.businessIntentNote || '').trim();

  const allReportText = [
    claudeReportInputSummary,
    JSON.stringify(changedFiles),
    verificationRaw,
    businessIntentNote
  ].join(' ');

  // Safety checks
  const secretLeakCheck = {
    found: scanText(allReportText, SECRET_PATTERNS),
    clean: scanText(allReportText, SECRET_PATTERNS).length === 0
  };
  const customerDataLeakCheck = {
    found: scanText(allReportText, CUSTOMER_DATA_PATTERNS),
    clean: scanText(allReportText, CUSTOMER_DATA_PATTERNS).length === 0
  };
  const forbiddenFilesCheck  = checkForbiddenFiles(changedFiles);
  const allowedFilesCheck    = checkAllowedFiles(changedFiles, allowedZones);
  const dangerousOpPatterns  = scanText(allReportText, DANGEROUS_OP_PATTERNS);
  const dangerousOperationCheck = {
    found: dangerousOpPatterns,
    clean: dangerousOpPatterns.length === 0
  };

  // Verification
  const verificationPassed =
    verificationRaw.includes('pass') &&
    !verificationRaw.includes('fail') &&
    !/[1-9]\d* error/.test(verificationRaw) &&
    !verificationRaw.includes('exit code 1');

  const verificationReview = {
    passed: verificationPassed,
    raw: input.verificationRaw || null,
    note: verificationPassed ? 'Verification suite passed' : 'Verification not passed or not reported'
  };

  // Reviews
  const changedFilesReview = {
    files: changedFiles,
    count: changedFiles.length,
    allowedCheck: allowedFilesCheck,
    forbiddenCheck: forbiddenFilesCheck
  };

  const safetyReview = {
    secretLeak:        secretLeakCheck,
    customerDataLeak:  customerDataLeakCheck,
    dangerousOps:      dangerousOperationCheck,
    overallSafe:       secretLeakCheck.clean && customerDataLeakCheck.clean && dangerousOperationCheck.clean
  };

  const businessIntentReview = {
    inputNote: businessIntentNote || '(not provided)',
    aligned:   !!businessIntentNote,
    note:      businessIntentNote
      ? 'Business intent described — human PM review required before approve'
      : 'Business intent not provided — PM review required before approve'
  };

  // Decision logic
  const acceptedItems = [];
  const rejectedItems = [];
  const blockerItems  = [];

  if (verificationPassed)            acceptedItems.push('verification passed');
  else                               blockerItems.push('verification not passed');

  if (allowedFilesCheck.clean)       acceptedItems.push('all files within allowed zones');
  else                               blockerItems.push(allowedFilesCheck.reason);

  if (forbiddenFilesCheck.clean)     acceptedItems.push('no forbidden files touched');
  else                               rejectedItems.push(`forbidden files: ${forbiddenFilesCheck.found.join(', ')}`);

  if (secretLeakCheck.clean)         acceptedItems.push('no secret leak detected');
  else                               rejectedItems.push(`secret leak: ${secretLeakCheck.found.join(', ')}`);

  if (customerDataLeakCheck.clean)   acceptedItems.push('no customer data leak detected');
  else                               rejectedItems.push(`customer data leak: ${customerDataLeakCheck.found.join(', ')}`);

  if (dangerousOperationCheck.clean) acceptedItems.push('no dangerous operations detected');
  else                               rejectedItems.push(`dangerous ops: ${dangerousOperationCheck.found.join(', ')}`);

  const hasCriticalIssue =
    !secretLeakCheck.clean ||
    !customerDataLeakCheck.clean ||
    !forbiddenFilesCheck.clean ||
    !dangerousOperationCheck.clean;

  const hasBlocker = blockerItems.length > 0;

  let reviewDecision;
  if (hasCriticalIssue) {
    reviewDecision = rejectedItems.some(r => r.includes('secret') || r.includes('customer data'))
      ? 'hold'
      : 'reject';
  } else if (hasBlocker) {
    reviewDecision = 'revise';
  } else if (rejectedItems.length > 0) {
    reviewDecision = 'reject';
  } else {
    reviewDecision = 'approve';
  }

  const commitCandidateReady =
    reviewDecision === 'approve' &&
    verificationPassed &&
    allowedFilesCheck.clean &&
    forbiddenFilesCheck.clean &&
    secretLeakCheck.clean &&
    customerDataLeakCheck.clean &&
    dangerousOperationCheck.clean;

  const needsHumanApproval = true;

  const decisionOptions = ['approve', 'revise', 'reject', 'hold'];

  const notReadyReasons = [];
  if (!isKnown)            notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (!claudeReportInputSummary) notReadyReasons.push('claudeReportInputSummary missing');
  if (hasCriticalIssue)    notReadyReasons.push(`Critical issues: ${rejectedItems.join('; ')}`);
  if (hasBlocker)          notReadyReasons.push(`Blockers: ${blockerItems.join('; ')}`);

  const recommendedNextAction = commitCandidateReady
    ? 'Review decision: approve. Commit candidate ready. Present to こさめ/GPT PM, then じゅんやさん final YES.'
    : reviewDecision === 'hold'
      ? 'HOLD: Sensitive content detected. Do not proceed. Escalate to じゅんやさん and こさめ/GPT PM immediately.'
      : reviewDecision === 'reject'
        ? `REJECT: Critical issues found. Do not commit. Issues: ${rejectedItems.join('; ')}`
        : `REVISE: Blockers must be resolved first. Blockers: ${blockerItems.join('; ')}`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    resultReviewId:           reviewId,
    targetProduct,
    targetRepoCandidate:      repoCandidate,
    claudeReportInputSummary,
    changedFilesReview,
    verificationReview,
    safetyReview,
    businessIntentReview,
    allowedFilesCheck,
    forbiddenFilesCheck,
    secretLeakCheck,
    customerDataLeakCheck,
    dangerousOperationCheck,
    acceptedItems,
    rejectedItems,
    blockerItems,
    reviewDecision,
    decisionOptions,
    commitCandidateReady,
    needsHumanApproval,
    notReadyReasons,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealCommit:             true,
    noRealPush:               true,
    noRealTag:                true,
    noRealDeploy:             true
  };
}

function main() {
  console.log(JSON.stringify(buildResultReviewConsole({
    targetProduct:             'sales_dx',
    claudeReportInputSummary:  '2 files created: src/leads/bulk-email-reply.js, tests/leads/bulk-email-reply.test.js. No secrets accessed.',
    changedFiles:              ['src/leads/bulk-email-reply.js', 'tests/leads/bulk-email-reply.test.js'],
    allowedFileZones:          ['src/leads/**', 'tests/**', 'docs/**'],
    verificationRaw:           'All tests passed. 0 errors.',
    businessIntentNote:        '営業DXのリード向け一括メール返信機能。スコープ内のみ変更。'
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
  buildResultReviewConsole
};
