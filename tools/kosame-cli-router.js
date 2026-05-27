/**
 * Kosame CLI Router v3.1.0
 *
 * Routes CLI commands to Operating Console Foundation tools.
 * All outputs are dryRun: true — no destructive actions.
 */

const { runOperatingConsole } = require('./kosame-operating-console-foundation');
const { generateHumanApprovalSummary } = require('./human-approval-summary-generator');
const { generateReleaseHandoffPacket } = require('./release-handoff-packet');

const SUPPORTED_CLI_COMMANDS = [
  'status', 'commit-check', 'push-check', 'release-check',
  'dispatch', 'approval', 'handoff'
];

function routeCliCommand(command, input = {}, session_id = '') {
  const startedAt = new Date().toISOString();

  if (!SUPPORTED_CLI_COMMANDS.includes(command)) {
    return {
      router: 'kosame-cli-router',
      command,
      error: `Unknown command: "${command}". Supported: ${SUPPORTED_CLI_COMMANDS.join(', ')}`,
      supported: SUPPORTED_CLI_COMMANDS,
      version: '3.1.0',
      generatedAt: startedAt,
      dryRun: true
    };
  }

  let result;

  switch (command) {
    case 'status':
      result = runOperatingConsole({ command: 'status', input, session_id });
      break;
    case 'commit-check':
      result = runOperatingConsole({ command: 'commit-check', input, session_id });
      break;
    case 'push-check':
      result = runOperatingConsole({ command: 'push-check', input, session_id });
      break;
    case 'release-check':
      result = runOperatingConsole({ command: 'release-check', input, session_id });
      break;
    case 'dispatch':
      result = runOperatingConsole({ command: 'dispatch', input, session_id });
      break;
    case 'approval':
      result = generateHumanApprovalSummary({ ...input, session_id });
      break;
    case 'handoff':
      result = generateReleaseHandoffPacket({ ...input, session_id });
      break;
  }

  return {
    router: 'kosame-cli-router',
    cli_command: `kosame ${command}`,
    ...result,
    router_version: '3.1.0',
    version: '3.1.0',
    generatedAt: startedAt
  };
}

module.exports = { routeCliCommand, SUPPORTED_CLI_COMMANDS };

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const result = routeCliCommand(command, {});
  console.log(JSON.stringify(result, null, 2));
}
