'use strict';

const TOOL_META = {
  "version": "4.3.0",
  "title": "Kosame Approval Compression Pack",
  "slug": "kosame-approval-compression",
  "tool": "tools/kosame-approval-compression.js",
  "smoke": "smoke/dev-agent-kosame-approval-compression-smoke.js",
  "doc": "docs/ai-dev-team/kosame-dev-orchestra-v4.3.0-release-record.md",
  "fixture": "fixtures/kosame-approval-compression.sample.json",
  "purpose": "じゅんやさん receives only the essential YES / NO / HOLD approval items instead of many small checks.",
  "script": "smoke:kosame-approval-compression"
};

const FORBIDDEN_ACTIONS = [
  'rm -rf',
  'git reset --hard',
  'git clean',
  'Secret / .env / API key閲覧',
  'deploy without approval',
  'gcloud run deploy without approval',
  'docker build as automatic step',
  'external API execution',
  'paid API execution',
  'unapproved git push',
  'unapproved git tag'
];

const SAFE_COMMAND_BOUNDARY = [
  'git status -sb',
  'git log --oneline -5',
  'git diff --name-only',
  'node --check',
  'npm run verify',
  'gh run list --limit 10'
];

function buildPacket(input = {}) {
  const status = input.status || 'unknown';
  const actionsStatus = input.actionsStatus || 'unknown';
  const verifyStatus = input.verifyStatus || 'unknown';
  const hasUncommittedChanges = Boolean(input.hasUncommittedChanges);
  const claudeAvailable = input.claudeAvailable !== false;
  const geminiAvailable = input.geminiAvailable !== false;

  let recommendation = 'HOLD';
  let nextAction = 'Collect state before deciding.';

  if (status === 'clean' && actionsStatus === 'success' && verifyStatus === 'success') {
    recommendation = 'YES';
    nextAction = 'Prepare next dry-run operation plan.';
  } else if (hasUncommittedChanges && verifyStatus === 'success') {
    recommendation = 'YES';
    nextAction = 'Prepare commit-check packet and require human approval before commit.';
  } else if (verifyStatus === 'failed' || actionsStatus === 'failed') {
    recommendation = 'HOLD';
    nextAction = 'Generate recovery runbook and route repair to Claude when available.';
  }

  const providerRoute = !claudeAvailable && !geminiAvailable
    ? 'kosame-vp-self-operation'
    : !claudeAvailable
      ? 'gemini-bulk-or-kosame-self'
      : !geminiAvailable
        ? 'claude-repair-or-kosame-self'
        : 'claude-or-gemini-by-task-type';

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    recommendation,
    reason: TOOL_META.purpose,
    providerRoute,
    nextAction,
    safeCommandSuggestion: SAFE_COMMAND_BOUNDARY,
    forbiddenActions: FORBIDDEN_ACTIONS,
    handoffRequired: input.handoffRequired ?? false,
    approvalCompression: {
      yesItems: recommendation === 'YES' ? ['Proceed only after human approval for commit/push/tag.'] : [],
      holdItems: recommendation === 'HOLD' ? ['Do not execute irreversible operations yet.'] : [],
      noItems: []
    }
  };
}

function main() {
  const mode = process.argv[2] || 'packet';
  const packet = buildPacket({
    status: process.env.KOSAME_STATUS || 'clean',
    actionsStatus: process.env.KOSAME_ACTIONS_STATUS || 'success',
    verifyStatus: process.env.KOSAME_VERIFY_STATUS || 'success',
    hasUncommittedChanges: process.env.KOSAME_HAS_CHANGES === '1',
    claudeAvailable: process.env.KOSAME_CLAUDE_AVAILABLE !== '0',
    geminiAvailable: process.env.KOSAME_GEMINI_AVAILABLE !== '0',
    handoffRequired: mode === 'handoff'
  });

  console.log(JSON.stringify(packet, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  TOOL_META,
  FORBIDDEN_ACTIONS,
  SAFE_COMMAND_BOUNDARY,
  buildPacket
};

