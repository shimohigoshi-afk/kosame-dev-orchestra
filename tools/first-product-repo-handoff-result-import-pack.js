'use strict';

const TOOL_META = {
  version: '26.0.0',
  title: 'First Product Repo Handoff & Result Import Pack',
  slug: 'first-product-repo-handoff-result-import-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_CANDIDATES = {
  sales_dx:          'kosame-sales-dx',
  anesty_board:      'kosame-anesty-board',
  backoffice_agent:  'kosame-backoffice-agent',
  email_reply_bot:   'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add (automated)',
  'git commit (automated)',
  'git push (automated)',
  'git tag (automated)',
  'deploy (any form)',
  'gcloud deploy',
  'docker build',
  'rm -rf',
  'git reset --hard',
  'git clean -f',
  'read .env or secrets',
  'access customer PII',
  'access insurance / health / financial records'
];

const SENSITIVE_PATTERNS = [
  'api key', 'api_key', 'secret', '.env', 'password', 'token',
  'credential', 'insurance', 'health record', 'patient', 'policyholder',
  'employee salary', 'financial record', 'personal info', 'pii'
];

function detectSensitiveContent(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  return SENSITIVE_PATTERNS.filter(p => lower.includes(p));
}

function parseVerificationResult(raw) {
  if (!raw) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = !lower.includes('error') && !lower.includes('fail') &&
                 !lower.includes('exit code 1') && !lower.includes('npm err');
  return { passed, raw: String(raw) };
}

function parseNodeCheckResult(raw) {
  if (!raw) return { passed: false, raw: null };
  const lower = String(raw).toLowerCase();
  const passed = (lower.includes('ok') || lower.includes('pass')) &&
                 !lower.includes('error') && !lower.includes('fail');
  return { passed, raw: String(raw) };
}

function matchesGlobZone(filePath, pattern) {
  const p = pattern.replace(/^\.\//, '');
  if (p.endsWith('/**')) return filePath.startsWith(p.slice(0, -3) + '/') || filePath === p.slice(0, -3);
  if (p.endsWith('/**/*')) return filePath.startsWith(p.slice(0, -5) + '/');
  if (p.endsWith('/*')) return filePath.startsWith(p.slice(0, -2) + '/');
  if (p.endsWith('*')) return filePath.startsWith(p.slice(0, -1));
  return filePath === p || filePath.includes(p);
}

function checkAllowedFilesOnly(changedFiles, allowedZones, deniedZones) {
  if (!changedFiles || changedFiles.length === 0) return { clean: false, reason: 'No changed files reported' };
  const denied = changedFiles.filter(f => deniedZones.some(d => matchesGlobZone(f, d)));
  if (denied.length > 0) return { clean: false, reason: `Files in denied zones: ${denied.join(', ')}` };
  return { clean: true, reason: 'All changed files in allowed zones' };
}

function buildCommitMessageCandidate(taskGoal, targetProduct, version) {
  const product = targetProduct || 'product';
  const ver     = version ? `v${version} ` : '';
  return `${ver}${product}: ${String(taskGoal || '(task)').slice(0, 60)}`;
}

function buildHandoffImportPack(input) {
  const importId      = `handoff-import-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const workOrder     = input.workOrder || {};

  const isKnownProduct      = SUPPORTED_PRODUCTS.includes(targetProduct);
  const targetRepoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;
  const taskGoal            = String(input.taskGoal || workOrder.taskGoal || '(task goal)').trim();
  const version             = input.version || '';
  const allowedZones        = input.allowedFileZones  || workOrder.filesAllowedToTouch || ['src/**', 'docs/**'];
  const deniedZones         = input.deniedFileZones   || workOrder.filesForbiddenToTouch || ['.env*', 'secrets/**'];

  // Parse Claude's reported results
  const claudeReportSummary     = String(input.claudeReportSummary || '').trim();
  const changedFilesReported    = input.changedFilesReported    || [];
  const verificationRaw         = input.verificationResultsRaw  || input.verificationResultsReported || null;
  const gitStatusReported       = String(input.gitStatusReported || '').trim();
  const risksReported           = input.risksReported           || [];

  const verificationResultsReported = parseVerificationResult(verificationRaw);
  const nodeCheckRaw = input.nodeCheckRaw || null;
  const nodeCheckReported = parseNodeCheckResult(nodeCheckRaw);

  // Sensitive content scan
  const allReportedText = [claudeReportSummary, JSON.stringify(changedFilesReported), gitStatusReported, JSON.stringify(risksReported)].join(' ');
  const sensitiveFound  = detectSensitiveContent(allReportedText);
  const hasSensitiveContent = sensitiveFound.length > 0;

  // File zone check
  const fileZoneCheck = checkAllowedFilesOnly(changedFilesReported, allowedZones, deniedZones);

  // Dangerous operation check
  const dangerousOpsInReport = [];
  const reportLower = allReportedText.toLowerCase();
  const dangerousPatterns = ['git commit', 'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build', 'rm -rf'];
  dangerousPatterns.forEach(p => { if (reportLower.includes(p)) dangerousOpsInReport.push(p); });

  // Acceptance logic
  const acceptedItems = [];
  const rejectedItems = [];
  const blockedItems  = [];

  if (verificationResultsReported.passed) acceptedItems.push('verification passed');
  else blockedItems.push('verification not passed');

  if (nodeCheckReported.passed || nodeCheckRaw === null) acceptedItems.push('node --check passed (or not reported)');
  else blockedItems.push('node --check failed');

  if (fileZoneCheck.clean) acceptedItems.push('changed files within allowed zones');
  else blockedItems.push(fileZoneCheck.reason);

  if (!hasSensitiveContent) acceptedItems.push('no sensitive content in report');
  else { rejectedItems.push(`sensitive content detected: ${sensitiveFound.join(', ')}`); }

  if (dangerousOpsInReport.length === 0) acceptedItems.push('no dangerous operations reported');
  else { rejectedItems.push(`dangerous operations in report: ${dangerousOpsInReport.join(', ')}`); }

  const needsKosameReview  = blockedItems.length > 0 || rejectedItems.length > 0;
  const needsHumanApproval = rejectedItems.length > 0 || dangerousOpsInReport.length > 0 || hasSensitiveContent;

  const commitCandidateReady =
    verificationResultsReported.passed &&
    fileZoneCheck.clean &&
    !hasSensitiveContent &&
    dangerousOpsInReport.length === 0 &&
    blockedItems.length === 0;

  const commitMessageCandidate = commitCandidateReady
    ? buildCommitMessageCandidate(taskGoal, targetProduct, version)
    : '(not ready — resolve blockers first)';

  const tagCandidate = version ? `v${version}` : '(version not specified)';

  const rollbackNote = input.rollbackNote ||
    `git checkout -- <file> for each changed file in ${targetRepoCandidate}. git reset --hard requires explicit じゅんやさん YES.`;

  const notReadyReasons = [];
  if (!isKnownProduct)          notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (!claudeReportSummary)     notReadyReasons.push('claudeReportSummary is empty — no report received');
  if (hasSensitiveContent)      notReadyReasons.push(`Sensitive content detected: ${sensitiveFound.join(', ')}`);
  if (!fileZoneCheck.clean)     notReadyReasons.push(fileZoneCheck.reason);

  const importReady = isKnownProduct && !!claudeReportSummary && !hasSensitiveContent && fileZoneCheck.clean;

  const nextAction = commitCandidateReady
    ? 'Commit candidate ready. Present to こさめ/GPT PM for review, then to じゅんやさん for final YES before git add / commit / push / tag.'
    : needsHumanApproval
      ? `Human approval required. Blockers: ${[...blockedItems, ...rejectedItems].slice(0, 2).join('; ')}`
      : `Review needed. Blockers: ${blockedItems.slice(0, 2).join('; ')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    handoffImportId:     importId,
    targetProduct,
    targetRepoCandidate,
    taskGoal,
    claudeReportSummary,
    changedFilesReported,
    verificationResultsReported,
    nodeCheckReported,
    gitStatusReported,
    risksReported,
    fileZoneCheck,
    sensitiveFound,
    hasSensitiveContent,
    dangerousOpsInReport,
    blockedItems,
    acceptedItems,
    rejectedItems,
    needsKosameReview,
    needsHumanApproval,
    commitCandidateReady,
    commitMessageCandidate,
    tagCandidate,
    rollbackNote,
    importReady,
    notReadyReasons,
    nextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealCommit:  true,
    noRealPush:    true,
    noRealTag:     true,
    noRealDeploy:  true
  };
}

function main() {
  console.log(JSON.stringify(buildHandoffImportPack({
    targetProduct:         'sales_dx',
    taskGoal:              '営業DXにリード向けメール一括返信機能を追加した',
    version:               '1.5.0',
    claudeReportSummary:   '2 files created: src/leads/bulk-email-reply.js, tests/leads/bulk-email-reply.test.js',
    changedFilesReported:  ['src/leads/bulk-email-reply.js', 'tests/leads/bulk-email-reply.test.js'],
    verificationResultsRaw: 'All tests passed.',
    nodeCheckRaw:          'ok',
    gitStatusReported:     '?? src/leads/bulk-email-reply.js\n?? tests/leads/bulk-email-reply.test.js',
    risksReported:         [],
    rollbackNote:          'git checkout -- src/leads/bulk-email-reply.js if needed.',
    allowedFileZones:      ['src/leads/**', 'src/components/**', 'tests/**', 'docs/**'],
    deniedFileZones:       ['.env*', 'secrets/**', 'credentials/**']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  SENSITIVE_PATTERNS,
  buildHandoffImportPack
};
