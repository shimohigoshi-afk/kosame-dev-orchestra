'use strict';

const TOOL_META = {
  version: '19.0.0',
  title: 'Product Release Candidate Packet Builder',
  slug: 'product-release-candidate-packet-builder-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'secret', '.env', 'api key', 'customer data'
];

const DEFAULT_PRE_PUSH_CHECKLIST = [
  { item: 'git status shows only intended files', required: true },
  { item: 'npm run verify passes (all smoke green)', required: true },
  { item: 'node --check on all new/edited files', required: true },
  { item: 'rollbackNote documented', required: true },
  { item: 'product smoke tests passing', required: true },
  { item: 'こさめ/GPT PM review completed', required: true },
  { item: 'Claude implementation review completed', required: true },
  { item: 'じゅんやさん final YES obtained', required: true }
];

const DEFAULT_PRE_DEPLOY_CHECKLIST = [
  { item: 'All pre-push checks completed', required: true },
  { item: 'Staging environment tested', required: true },
  { item: 'Rollback procedure confirmed', required: true },
  { item: 'No customer/patient/employee PII in deployment', required: true },
  { item: 'No secrets in environment without Secret Manager', required: true },
  { item: 'GitHub Actions CI green', required: true },
  { item: 'こさめ/GPT PM deploy approval', required: true },
  { item: 'じゅんやさん deploy YES obtained', required: true }
];

function buildReleaseCandidatePacket(input) {
  const rcId          = `rc-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown');
  const targetRepo    = String(input.targetRepo || `kosame-${targetProduct}`);
  const taskGoal      = String(input.taskGoal || '(task goal)').trim();
  const intendedFiles = input.intendedFiles || [];
  const deniedFiles   = input.deniedFiles || ['.env', '.env.*', 'secrets/**', 'credentials/**'];
  const version       = String(input.version || '');
  const rollbackNote  = input.rollbackNote || '';
  const verifyPassed  = Boolean(input.verifyPassed);
  const nodeCheckPassed = Boolean(input.nodeCheckPassed);
  const smokePassed   = Boolean(input.smokePassed);

  const verificationSummary = {
    verifyPassed,
    nodeCheckPassed,
    smokePassed,
    allPassed: verifyPassed && nodeCheckPassed && smokePassed
  };

  const isDeniedIncluded = intendedFiles.some(f =>
    deniedFiles.some(d => d.endsWith('*') ? f.startsWith(d.slice(0, -1)) : f.includes(d))
  );

  const releaseNotesDraft = [
    `## ${targetProduct} ${version ? 'v' + version : 'Release'} — Release Notes (Draft)`,
    `### Goal`,
    taskGoal,
    `### Changed Files`,
    intendedFiles.map(f => `- ${f}`).join('\n'),
    `### Verification`,
    `- verify: ${verifyPassed ? 'PASS' : 'FAIL'}`,
    `- node --check: ${nodeCheckPassed ? 'PASS' : 'FAIL'}`,
    `- smoke: ${smokePassed ? 'PASS' : 'FAIL'}`,
    `### Rollback`,
    rollbackNote || '(not specified)'
  ].join('\n');

  const readyForHumanReview = verificationSummary.allPassed && !isDeniedIncluded;

  const safeNextAction = readyForHumanReview
    ? 'Release candidate ready. Present to じゅんやさん for explicit final YES before any push/deploy.'
    : isDeniedIncluded
      ? 'Denied files detected in intendedFiles. Remove before proceeding.'
      : 'Verification not complete. Resolve failures before release candidate.';

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    releaseCandidateId:  rcId,
    targetProduct,
    targetRepo,
    taskGoal,
    intendedFiles,
    deniedFiles,
    isDeniedIncluded,
    verificationSummary,
    releaseNotesDraft,
    rollbackNote,
    prePushChecklist:    DEFAULT_PRE_PUSH_CHECKLIST,
    preDeployChecklist:  DEFAULT_PRE_DEPLOY_CHECKLIST,
    readyForHumanReview,
    safeNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    absolutelyForbidden: [
      'git add (automated)',
      'git commit (automated)',
      'git push (automated)',
      'git tag (automated)',
      'deploy (automated)'
    ],
    noRealRelease:  true,
    noRealDeploy:   true,
    noRealPush:     true
  };
}

function main() {
  console.log(JSON.stringify(buildReleaseCandidatePacket({
    targetProduct: 'sales_dx',
    targetRepo:    'kosame-sales-dx',
    taskGoal:      '営業DXリード管理画面にCSVエクスポート機能を追加した',
    intendedFiles: ['src/leads/csv-export.js', 'tests/leads/csv-export.test.js'],
    version:       '1.2.0',
    rollbackNote:  'git checkout -- src/leads/csv-export.js',
    verifyPassed:  true,
    nodeCheckPassed: true,
    smokePassed:   true
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_PRE_PUSH_CHECKLIST,
  DEFAULT_PRE_DEPLOY_CHECKLIST,
  buildReleaseCandidatePacket
};
