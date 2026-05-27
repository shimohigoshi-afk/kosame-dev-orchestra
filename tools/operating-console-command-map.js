/**
 * Operating Console Command Map v3.0.0
 *
 * Registry of all commands available in the KOSAME Dev Orchestra Operating Console.
 * Organized by category with version, tool path, and usage notes.
 */

const COMMAND_MAP = {
  operator_commands: {
    description: 'Core operator commands (v2.6.0)',
    commands: {
      status: {
        tool: 'tools/kosame-status-command.js',
        fn: 'executeStatusCommand',
        since: '2.6.0',
        requiresHumanApproval: false,
        description: 'Show current repo state and recommend next action'
      },
      'commit-check': {
        tool: 'tools/kosame-commit-check-command.js',
        fn: 'executeCommitCheckCommand',
        since: '2.6.0',
        requiresHumanApproval: false,
        description: 'Verify commit safety (verify/node-check/file-diff)'
      },
      'push-check': {
        tool: 'tools/kosame-push-check-command.js',
        fn: 'executePushCheckCommand',
        since: '2.6.0',
        requiresHumanApproval: true,
        description: 'Verify push readiness — always requires じゅんやさんYES'
      },
      'release-check': {
        tool: 'tools/kosame-release-check-command.js',
        fn: 'executeReleaseCheckCommand',
        since: '2.6.0',
        requiresHumanApproval: true,
        description: 'Verify tag/release readiness — YES only when Actions success'
      },
      dispatch: {
        tool: 'tools/kosame-dispatch-command.js',
        fn: 'executeDispatchCommand',
        since: '2.6.0',
        requiresHumanApproval: false,
        description: 'Route next task to Claude / Gemini / Human Approval'
      }
    }
  },
  status_importers: {
    description: 'Real status importers (v2.7.0)',
    commands: {
      'import-git': {
        tool: 'tools/git-status-importer.js',
        fn: 'importGitStatus',
        since: '2.7.0',
        requiresHumanApproval: false,
        description: 'Parse git status data into normalized snapshot'
      },
      'import-actions': {
        tool: 'tools/github-actions-result-importer.js',
        fn: 'importGitHubActionsResult',
        since: '2.7.0',
        requiresHumanApproval: false,
        description: 'Parse GHA result into actionsStatus snapshot'
      },
      'import-verify': {
        tool: 'tools/verify-result-importer.js',
        fn: 'importVerifyResult',
        since: '2.7.0',
        requiresHumanApproval: false,
        description: 'Parse verify output into verifyStatus snapshot'
      },
      'health-snapshot': {
        tool: 'tools/repository-health-snapshot.js',
        fn: 'createRepositoryHealthSnapshot',
        since: '2.7.0',
        requiresHumanApproval: false,
        description: 'Combine all importers into unified repo health snapshot'
      }
    }
  },
  plan_generators: {
    description: 'One-shot operation plan generators (v2.8.0)',
    commands: {
      'one-shot-plan': {
        tool: 'tools/one-shot-operation-plan.js',
        fn: 'generateOneShotOperationPlan',
        since: '2.8.0',
        requiresHumanApproval: false,
        description: 'Generate complete end-to-end operation plan'
      },
      'command-plan': {
        tool: 'tools/safe-command-plan-generator.js',
        fn: 'generateSafeCommandPlan',
        since: '2.8.0',
        requiresHumanApproval: false,
        description: 'Generate safe/dangerous command plan'
      },
      'claude-prompt': {
        tool: 'tools/claude-task-prompt-generator.js',
        fn: 'generateClaudeTaskPrompt',
        since: '2.8.0',
        requiresHumanApproval: false,
        description: 'Generate structured Claude係長 task prompt'
      },
      'gemini-prompt': {
        tool: 'tools/gemini-bulk-prompt-generator.js',
        fn: 'generateGeminiBulkPrompt',
        since: '2.8.0',
        requiresHumanApproval: false,
        description: 'Generate Gemini課長 bulk generation prompt'
      },
      'approval-summary': {
        tool: 'tools/human-approval-summary-generator.js',
        fn: 'generateHumanApprovalSummary',
        since: '2.8.0',
        requiresHumanApproval: true,
        description: 'Generate approval summary packet for じゅんやさん'
      }
    }
  },
  release_gate: {
    description: 'Release gate / tag readiness (v2.9.0)',
    commands: {
      'release-gate': {
        tool: 'tools/release-gate-controller.js',
        fn: 'evaluateReleaseGate',
        since: '2.9.0',
        requiresHumanApproval: true,
        description: 'Evaluate release gate: open / pending / closed'
      },
      'tag-readiness': {
        tool: 'tools/tag-readiness-packet.js',
        fn: 'generateTagReadinessPacket',
        since: '2.9.0',
        requiresHumanApproval: true,
        description: 'Generate tag readiness packet for じゅんやさん'
      },
      'release-handoff': {
        tool: 'tools/release-handoff-packet.js',
        fn: 'generateReleaseHandoffPacket',
        since: '2.9.0',
        requiresHumanApproval: false,
        description: 'Generate post-release handoff packet with next steps'
      },
      'next-phase': {
        tool: 'tools/post-release-next-phase-suggestion.js',
        fn: 'suggestNextPhase',
        since: '2.9.0',
        requiresHumanApproval: false,
        description: 'Suggest next development phase after release'
      }
    }
  }
};

function getCommandMap() {
  const allCommands = {};
  for (const [category, { commands }] of Object.entries(COMMAND_MAP)) {
    for (const [name, meta] of Object.entries(commands)) {
      allCommands[name] = { ...meta, category };
    }
  }
  return allCommands;
}

function lookupCommand(commandName) {
  const all = getCommandMap();
  return all[commandName] || null;
}

function listHumanApprovalCommands() {
  const all = getCommandMap();
  return Object.entries(all)
    .filter(([, meta]) => meta.requiresHumanApproval)
    .map(([name, meta]) => ({ name, ...meta }));
}

module.exports = { COMMAND_MAP, getCommandMap, lookupCommand, listHumanApprovalCommands };

if (require.main === module) {
  const all = getCommandMap();
  console.log(`Total commands: ${Object.keys(all).length}`);
  console.log(`\nHuman approval required (${listHumanApprovalCommands().length}):`);
  listHumanApprovalCommands().forEach(c => console.log(`  - ${c.name}: ${c.description}`));
}
