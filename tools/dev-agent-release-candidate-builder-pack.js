'use strict';

const TOOL_META = {
  version: '89.0.0',
  title: 'KOSAME Dev Orchestra Release Candidate Builder Pack',
  slug: 'dev-agent-release-candidate-builder-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'api key read',
  'customer data read',
  'insurance data read',
  'deploy',
  'git add/commit/push/tag',
  'destructive delete',
  'external repo mutation'
];

function buildReleaseCandidateBuilder(input = {}) {
  const targetVersion = input.targetVersion || 'v90.0.0';

  return {
    releaseCandidateBuilderId: input.releaseCandidateBuilderId || 'release-candidate-builder-v89',
    targetVersion,
    commitCandidate: input.commitCandidate !== undefined ? input.commitCandidate : true,
    commitMessage: input.commitMessage || `${targetVersion} Add semi-autonomous operation line`,
    tagName: input.tagName || targetVersion,
    tagMessage: input.tagMessage || `${targetVersion} Add semi-autonomous operation line`,
    intendedFiles: input.intendedFiles || ['package.json', 'tools/dev-agent-*.js', 'smoke/dev-agent-*.js', 'fixtures/dev-agent-*.json', 'docs/ai-dev-team/*.md', 'tools/agent-runner-local.js', 'tools/agent-live-call-one-shot.js'],
    excludedFiles: input.excludedFiles || ['kosame-dev-orchestra@14.0.0', 'node', '.env', 'external repos', '*.bak_v85_input_file'],
    requiredPreCommitChecks: input.requiredPreCommitChecks || ['npm run verify', 'target smoke scripts', 'git status --short', 'confirm excluded files untracked'],
    postPushActions: input.postPushActions || ['Actions確認', 'HOME backup', 'PowerShell保存', 'SHA256確認'],
    backupPlan: {
      homeBackup: true,
      powerShellBackup: true,
      sha256Required: true
    },
    humanApprovalRequired: true,
    dryRun: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildReleaseCandidateBuilder(), null, 2));
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildReleaseCandidateBuilder
};
