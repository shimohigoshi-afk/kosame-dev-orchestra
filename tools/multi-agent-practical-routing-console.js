'use strict';

const TOOL_META = {
  version: '5.0.0',
  title: 'Multi-Agent Practical Routing Console',
  slug: 'multi-agent-practical-routing-console'
};

const PROVIDERS = {
  kosame: 'PM / decision / integration / safety gate',
  gemini: 'bulk reading / drafts / expansion / documentation',
  claude: 'implementation / code repair / refactor',
  grok: 'breakthrough ideas / alternative design / stuck-state recovery',
  deepseek: 'fallback code proposal / low-cost reasoning',
  kimi: 'long context reading / handoff summary',
  cloudShell: 'verify / git status / node check / human-approved execution',
  human: 'final YES / irreversible operation approval'
};

const FORBIDDEN_WITHOUT_APPROVAL = [
  'git commit',
  'git push',
  'git tag',
  'deploy',
  'docker build',
  'gcloud run deploy',
  'rm -rf',
  'git reset --hard',
  'git clean',
  'Secret value read',
  '.env value read',
  'API key value read',
  'customer private data sharing'
];

const DATA_BOUNDARY = {
  levelA_ok: ['public information', 'generic code', 'error messages without secrets', 'synthetic fixtures'],
  levelB_caution: ['partial private repo code', 'internal business logic', 'non-customer system design'],
  levelC_blocked: ['customer data', 'insurance policy details', 'health check details', 'contracts', '.env', 'API keys', 'Secrets']
};

function chooseProvider(task = {}) {
  const type = task.type || 'bulk draft';
  const providerStatus = task.providerStatus || {};
  const dataLevel = task.dataLevel || 'A';

  if (dataLevel === 'C') {
    return { provider: 'kosame', route: 'kosame-human-approval-only', humanApprovalRequired: true };
  }

  if (type.includes('implementation') || type.includes('bugfix') || type.includes('refactor')) {
    if (providerStatus.claude !== 'down') return { provider: 'claude', route: 'claude-primary', humanApprovalRequired: true };
    if (providerStatus.grok !== 'down') return { provider: 'grok', route: 'grok-backup-design', humanApprovalRequired: true };
    return { provider: 'deepseek', route: 'deepseek-fallback-code-proposal', humanApprovalRequired: true };
  }

  if (type.includes('draft') || type.includes('document') || type.includes('bulk') || type.includes('expand')) {
    if (providerStatus.gemini !== 'down') return { provider: 'gemini', route: 'gemini-primary', humanApprovalRequired: true };
    if (providerStatus.grok !== 'down') return { provider: 'grok', route: 'grok-backup-draft', humanApprovalRequired: true };
    return { provider: 'kimi', route: 'kimi-long-context-fallback', humanApprovalRequired: true };
  }

  if (type.includes('strategy') || type.includes('stuck') || type.includes('breakthrough')) {
    if (providerStatus.grok !== 'down') return { provider: 'grok', route: 'grok-breakthrough', humanApprovalRequired: true };
  }

  return { provider: 'kosame', route: 'kosame-vp-triage', humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const assignment = chooseProvider(input.task || {});
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    assignment,
    providers: PROVIDERS,
    dataBoundary: DATA_BOUNDARY,
    forbiddenWithoutApproval: FORBIDDEN_WITHOUT_APPROVAL
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    task: {
      type: process.env.KOSAME_TASK_TYPE || 'bulk draft',
      dataLevel: process.env.KOSAME_DATA_LEVEL || 'A',
      providerStatus: {
        gemini: process.env.KOSAME_GEMINI_STATUS || 'up',
        claude: process.env.KOSAME_CLAUDE_STATUS || 'up',
        grok: process.env.KOSAME_GROK_STATUS || 'up'
      }
    }
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PROVIDERS,
  FORBIDDEN_WITHOUT_APPROVAL,
  DATA_BOUNDARY,
  chooseProvider,
  buildPacket
};

