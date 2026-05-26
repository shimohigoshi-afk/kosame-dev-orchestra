/**
 * Operator Local Console CLI v1.1.0
 * 
 * Unified entry point for Operator CLI.
 */

const { routeCommand } = require('./operator-cli-command-router.js');

function runConsole(command, args) {
  // This tool delegates to the router
  return routeCommand(command, args);
}

module.exports = { runConsole };

// CLI Entry Point
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  if (!command) {
    console.log('KOSAME Operator Local Console v1.1.0');
    console.log('Usage: node tools/operator-local-console-cli.js <command> [args]');
    console.log('Available commands: status, next, approval, handoff, verify, actions, dashboard');
    process.exit(0);
  }

  const result = runConsole(command, args);
  console.log(JSON.stringify(result, null, 2));
}
