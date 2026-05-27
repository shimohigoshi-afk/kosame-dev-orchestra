/**
 * Kosame Safe Command Generator v3.4.0
 *
 * Master safe command generator for こさめ副社長.
 * Routes to commit / push / tag generators based on decision report.
 * All outputs are vetted by deny-command-guard.
 */

const { generateSafeCommitCommands } = require('./safe-commit-command-generator');
const { generateSafePushCommands } = require('./safe-push-command-generator');
const { generateSafeTagCommands } = require('./safe-tag-command-generator');
const { guardCommand, guardCommandList } = require('./deny-command-guard');

const GENERATOR_VERSION = '3.4.0';

function generateSafeCommands(commandInput = {}) {
  const {
    operation = 'status',
    commitInput = {},
    pushInput = {},
    tagInput = {},
    customCommands = [],
    session_id = ''
  } = commandInput;

  let result;
  switch (operation) {
    case 'commit':
      result = generateSafeCommitCommands({ ...commitInput, session_id });
      break;
    case 'push':
      result = generateSafePushCommands({ ...pushInput, session_id });
      break;
    case 'tag':
    case 'release':
      result = generateSafeTagCommands({ ...tagInput, session_id });
      break;
    case 'custom': {
      const guardResult = guardCommandList(customCommands);
      result = {
        generator: 'safe-command-custom',
        session_id,
        commands: customCommands,
        guardResult,
        allSafe: guardResult.allAllowed,
        dryRun: true
      };
      break;
    }
    default:
      result = {
        generator: 'safe-command-noop',
        operation,
        note: `No command generator for operation: ${operation}`,
        dryRun: true
      };
  }

  return {
    ...result,
    generator: 'kosame-safe-command-generator',
    generator_version: GENERATOR_VERSION,
    session_id,
    operation,
    version: GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateSafeCommands, GENERATOR_VERSION };

if (require.main === module) {
  console.log('=== Kosame Safe Command Generator v3.4.0 ===\n');
  const result = generateSafeCommands({
    operation: 'commit',
    commitInput: {
      intendedFiles: ['tools/kosame-safe-command-generator.js', 'package.json'],
      commitMessage: 'feat: add safe command generator pack (v3.4.0)',
      verifyStatus: 'passed'
    }
  });
  console.log(JSON.stringify(result, null, 2));
}
