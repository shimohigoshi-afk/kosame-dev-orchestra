/**
 * Kosame Operator Command Console v2.6.0
 *
 * Integrates all operator commands into a unified console.
 * Commands: status / commit-check / push-check / release-check / dispatch
 */

const { executeStatusCommand } = require('./kosame-status-command');
const { executeCommitCheckCommand } = require('./kosame-commit-check-command');
const { executePushCheckCommand } = require('./kosame-push-check-command');
const { executeReleaseCheckCommand } = require('./kosame-release-check-command');
const { executeDispatchCommand } = require('./kosame-dispatch-command');

const CONSOLE_VERSION = '2.6.0';
const SUPPORTED_COMMANDS = ['status', 'commit-check', 'push-check', 'release-check', 'dispatch'];

function runOperatorConsole(commandName, input = {}) {
  const startedAt = new Date().toISOString();

  if (!SUPPORTED_COMMANDS.includes(commandName)) {
    return {
      console: 'kosame-operator-command-console',
      command: commandName,
      error: `Unknown command: "${commandName}". Supported: ${SUPPORTED_COMMANDS.join(', ')}`,
      supported_commands: SUPPORTED_COMMANDS,
      version: CONSOLE_VERSION,
      generatedAt: startedAt,
      dryRun: true
    };
  }

  let result;
  switch (commandName) {
    case 'status':
      result = executeStatusCommand(input);
      break;
    case 'commit-check':
      result = executeCommitCheckCommand(input);
      break;
    case 'push-check':
      result = executePushCheckCommand(input);
      break;
    case 'release-check':
      result = executeReleaseCheckCommand(input);
      break;
    case 'dispatch':
      result = executeDispatchCommand(input);
      break;
  }

  return {
    console: 'kosame-operator-command-console',
    console_version: CONSOLE_VERSION,
    ...result,
    generatedAt: startedAt
  };
}

function listCommands() {
  return {
    console: 'kosame-operator-command-console',
    console_version: CONSOLE_VERSION,
    supported_commands: SUPPORTED_COMMANDS,
    descriptions: {
      status: 'Show current repo state and recommend next action',
      'commit-check': 'Verify commit safety (verify/node-check/file-diff)',
      'push-check': 'Verify push readiness (always requires じゅんやさんYES)',
      'release-check': 'Verify tag/release readiness (YES only when Actions success)',
      dispatch: 'Route next task to Claude / Gemini / Human Approval'
    },
    dryRun: true
  };
}

module.exports = { runOperatorConsole, listCommands, SUPPORTED_COMMANDS, CONSOLE_VERSION };

if (require.main === module) {
  console.log('=== Kosame Operator Command Console v2.6.0 ===\n');

  console.log('-- list --');
  console.log(JSON.stringify(listCommands(), null, 2));

  console.log('\n-- status --');
  const statusResult = runOperatorConsole('status', {
    packageVersion: '2.6.0',
    headCommit: 'abc1234',
    originCommit: 'abc1234',
    branch: 'main',
    hasUncommittedChanges: false,
    actionsStatus: 'success',
    verifyStatus: 'passed'
  });
  console.log(JSON.stringify(statusResult, null, 2));

  console.log('\n-- dispatch --');
  const dispatchResult = runOperatorConsole('dispatch', {
    task_type: 'repair',
    needs_repair: true,
    verify_status: 'failed'
  });
  console.log(JSON.stringify(dispatchResult, null, 2));
}
