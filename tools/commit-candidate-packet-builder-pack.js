'use strict';

const TOOL_META = {
  version: '16.0.0',
  title: 'Commit Candidate Packet Builder',
  slug: 'commit-candidate-packet-builder-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'secret', '.env', 'api key'
];

const DEFAULT_GITHUB_ACTIONS_CHECKLIST = [
  'Confirm GitHub Actions CI triggered after push',
  'Check Actions tab for green status',
  'Review test results and lint output',
  'Confirm no unexpected workflow failures',
  'Notify こさめ/GPT PM of CI result before tagging'
];

function buildPrePushChecklist(input) {
  return [
    { item: 'git status shows only intended files', required: true,  note: 'run: git status --short' },
    { item: 'git diff --stat matches expected changes', required: true, note: 'run: git diff --stat HEAD' },
    { item: 'npm run verify passes (all smoke green)', required: true, note: 'run: npm run verify' },
    { item: 'node --check on all new/edited JS files', required: true, note: 'run: node --check <file>' },
    { item: 'rollbackNote is documented', required: true,  note: input.rollbackNote || '(not set)' },
    { item: 'humanApprovalRequired: じゅんやさんの最終YES取得済み', required: true, note: 'explicit YES only' },
    { item: 'commit message reviewed and approved',    required: true, note: 'see commitMessageCandidate' },
    { item: 'tag candidate reviewed (if applicable)',  required: false, note: 'see tagCandidate' }
  ];
}

function buildStagedFilesPreview(intendedFiles) {
  return intendedFiles.map(f => ({ file: f, action: 'add', note: 'dry-run only — not actually staged' }));
}

function buildDiffStatPreview(intendedFiles) {
  return {
    note:  'dry-run preview only — run `git diff --stat HEAD` for actual diff',
    files: intendedFiles.map(f => ({ file: f, estimate: 'N lines changed (actual TBD)' }))
  };
}

function buildCommitCandidatePacket(input) {
  const packetId           = `commit-candidate-${Date.now()}`;
  const taskGoal           = String(input.taskGoal || '(task goal)').trim();
  const intendedFiles      = input.intendedFiles   || [];
  const deniedFiles        = input.deniedFiles     || [
    '.env', '.env.*', 'secrets/**', 'credentials/**'
  ];
  const version            = String(input.version || '');
  const commitMsgBody      = String(input.commitMsgBody || taskGoal).trim();
  const rollbackNote       = input.rollbackNote    || '';
  const verifyPassed       = input.verifyPassed    !== undefined ? Boolean(input.verifyPassed) : false;
  const nodeCheckPassed    = input.nodeCheckPassed !== undefined ? Boolean(input.nodeCheckPassed) : false;

  const commitMessageCandidate = [
    `v${version} ${commitMsgBody}`,
    '',
    `- dryRun: true`,
    `- humanApprovalRequired: true`,
    `- 対象ファイル: ${intendedFiles.join(', ')}`
  ].join('\n');

  const tagCandidate = version ? `v${version}` : '(version not specified)';

  const stagedFilesPreview = buildStagedFilesPreview(intendedFiles);
  const diffStatPreview    = buildDiffStatPreview(intendedFiles);
  const prePushChecklist   = buildPrePushChecklist({ rollbackNote });

  const isDeniedFileIncluded = intendedFiles.some(f =>
    deniedFiles.some(d => d.endsWith('*') ? f.startsWith(d.slice(0, -1)) : f.includes(d))
  );

  const readyForHumanReview = verifyPassed && nodeCheckPassed && !isDeniedFileIncluded;

  const safeNextAction = readyForHumanReview
    ? 'Commit candidate packet ready. Present to じゅんやさん for explicit final YES before any git operation.'
    : 'Not ready: resolve verify/node-check failures or remove denied files from intendedFiles.';

  return {
    version:              TOOL_META.version,
    title:                TOOL_META.title,
    dryRun:               true,
    humanApprovalRequired: true,
    packetId,
    taskGoal,
    intendedFiles,
    deniedFiles,
    stagedFilesPreview,
    diffStatPreview,
    commitMessageCandidate,
    tagCandidate,
    prePushChecklist,
    githubActionsChecklist: DEFAULT_GITHUB_ACTIONS_CHECKLIST,
    rollbackNote,
    isDeniedFileIncluded,
    verifyPassed,
    nodeCheckPassed,
    readyForHumanReview,
    safeNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    absolutelyForbidden: [
      'git add (automated)',
      'git commit (automated)',
      'git push (automated)',
      'git tag (automated)'
    ],
    note: 'このpacketは git add / git commit / git push / git tag を実行しない。じゅんやさんの明示的YESが必要。'
  };
}

function main() {
  console.log(JSON.stringify(buildCommitCandidatePacket({
    taskGoal:       'v14.5.0–v16.0.0 packs implementation',
    intendedFiles:  [
      'tools/approval-packet-practical-review-runner-pack.js',
      'tools/first-safe-docs-edit-execution-pack.js',
      'tools/post-edit-verification-collector-pack.js',
      'tools/commit-candidate-packet-builder-pack.js',
      'package.json'
    ],
    deniedFiles:    ['.env', '.env.*', 'secrets/**'],
    version:        '16.0.0',
    commitMsgBody:  'Add Approval Practical Review, Safe Docs Edit, Verification Collector, Commit Candidate Builder',
    rollbackNote:   'git checkout -- <files> to revert. git reset --hard requires explicit human approval.',
    verifyPassed:   true,
    nodeCheckPassed: true
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_GITHUB_ACTIONS_CHECKLIST,
  buildCommitCandidatePacket
};
