/**
 * Kosame CLI Entry v3.1.0
 *
 * Cloud Shell上でこさめ副社長の判断系toolを呼び出す入口。
 * Usage: node tools/kosame-cli-entry.js <command> [--session=<id>]
 * All operations are dryRun: true.
 */

const { routeCliCommand, SUPPORTED_CLI_COMMANDS } = require('./kosame-cli-router');

const CLI_VERSION = '3.1.0';

const DEMO_INPUTS = {
  status: {
    packageVersion: '3.1.0',
    branch: 'main',
    headCommit: 'HEAD',
    originCommit: 'HEAD',
    hasUncommittedChanges: false,
    uncommittedFiles: [],
    actionsStatus: 'success',
    verifyStatus: 'passed'
  },
  'commit-check': {
    intended_files: [],
    actual_changed_files: [],
    verify_status: 'not_run',
    node_check_status: 'not_run',
    risk_level: 'Low'
  },
  'push-check': {
    headCommit: '',
    originCommit: '',
    branch: 'main',
    verify_status: 'not_run',
    commit_ready: false,
    working_tree_clean: true
  },
  'release-check': {
    target_version: '3.1.0',
    package_version: '3.1.0',
    actions_status: 'unknown',
    verify_status: 'not_run',
    working_tree_clean: true,
    release_docs_exist: false
  },
  dispatch: {
    task_type: 'unknown',
    risk_level: 'Low',
    gemini_available: false,
    needs_repair: false,
    needs_bulk_gen: false
  },
  approval: {
    actionTitle: 'Pending Action',
    riskLevel: 'High',
    recommendation: 'HOLD'
  },
  handoff: {
    releasedVersion: '3.1.0',
    tagCreated: false,
    pushedToRemote: false
  }
};

function runCli(args = []) {
  const command = args[0] || 'status';
  const sessionArg = args.find(a => a.startsWith('--session='));
  const session_id = sessionArg ? sessionArg.split('=')[1] : `cli-${Date.now()}`;

  if (command === '--help' || command === 'help') {
    return {
      cli: 'kosame-cli-entry',
      version: CLI_VERSION,
      usage: 'node tools/kosame-cli-entry.js <command> [--session=<id>]',
      supported_commands: SUPPORTED_CLI_COMMANDS,
      examples: SUPPORTED_CLI_COMMANDS.map(c => `  node tools/kosame-cli-entry.js ${c}`),
      note: 'All operations are dryRun: true — no destructive actions.',
      dryRun: true,
      generatedAt: new Date().toISOString()
    };
  }

  const input = DEMO_INPUTS[command] || {};
  const result = routeCliCommand(command, input, session_id);

  return {
    cli: 'kosame-cli-entry',
    version: CLI_VERSION,
    session_id,
    ...result
  };
}

module.exports = { runCli, CLI_VERSION, DEMO_INPUTS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const result = runCli(args);
  console.log(JSON.stringify(result, null, 2));
}
