/**
 * Kosame Operating Console Foundation v3.0.0
 *
 * Top-level integration of all KOSAME Dev Orchestra operating tools.
 * Provides the unified entry point for こさめ副社長 operations.
 */

const { runOperatorConsole, listCommands } = require('./kosame-operator-command-console');
const { createRepositoryHealthSnapshot } = require('./repository-health-snapshot');
const { generateOperatingDecisionPacket } = require('./kosame-operating-decision-packet');
const { getCommandMap, listHumanApprovalCommands, COMMAND_MAP } = require('./operating-console-command-map');

const FOUNDATION_VERSION = '3.0.0';

function runOperatingConsole(request = {}) {
  const {
    command = '',
    input = {},
    session_id = '',
    mode = 'command'
  } = request;

  if (mode === 'decision') {
    return generateOperatingDecisionPacket({ ...input, session_id });
  }

  if (mode === 'health') {
    return createRepositoryHealthSnapshot({ ...input, session_id });
  }

  if (mode === 'list') {
    return {
      foundation: 'kosame-operating-console-foundation',
      foundation_version: FOUNDATION_VERSION,
      ...listCommands(),
      commandMap: getCommandMap(),
      humanApprovalCommands: listHumanApprovalCommands(),
      generatedAt: new Date().toISOString()
    };
  }

  const result = runOperatorConsole(command, input);
  return {
    foundation: 'kosame-operating-console-foundation',
    foundation_version: FOUNDATION_VERSION,
    mode: 'command',
    ...result
  };
}

function getFoundationStatus() {
  const allCommands = getCommandMap();
  const commandCount = Object.keys(allCommands).length;
  const categories = Object.keys(COMMAND_MAP);

  return {
    foundation: 'kosame-operating-console-foundation',
    foundation_version: FOUNDATION_VERSION,
    status: 'operational',
    commandCount,
    categories,
    humanApprovalCommandCount: listHumanApprovalCommands().length,
    capabilities: [
      'operator-command-console (v2.6.0)',
      'real-status-import (v2.7.0)',
      'one-shot-operation-plan (v2.8.0)',
      'release-gate (v2.9.0)',
      'operating-decision-packet (v3.0.0)',
      'command-map (v3.0.0)'
    ],
    safetyConstraints: [
      'git push / tag always requires じゅんやさんYES',
      'dryRun: true on all outputs',
      'no external API calls',
      'no shell execution'
    ],
    dryRun: true,
    generatedAt: new Date().toISOString()
  };
}

module.exports = { runOperatingConsole, getFoundationStatus, FOUNDATION_VERSION };

if (require.main === module) {
  console.log('=== Kosame Operating Console Foundation v3.0.0 ===\n');

  console.log('-- foundation status --');
  console.log(JSON.stringify(getFoundationStatus(), null, 2));

  console.log('\n-- decision mode (all green) --');
  const decision = runOperatingConsole({
    mode: 'decision',
    input: {
      currentState: {
        actionsStatus: 'success',
        verifyStatus: 'passed',
        workingTreeClean: true,
        isAhead: false,
        overallHealth: 'healthy',
        packageVersion: '3.0.0'
      },
      sessionGoal: 'Stable operation'
    }
  });
  console.log(JSON.stringify(decision, null, 2));
}
