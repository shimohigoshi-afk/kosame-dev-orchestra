/**
 * Safe Command Plan Generator v2.8.0
 *
 * Generates a sequenced plan of safe commands for a task.
 * Marks dangerous commands as requiring human approval.
 */

const DANGEROUS_COMMANDS = ['git push', 'git tag', 'gcloud deploy', 'docker build', 'rm -rf', 'git reset --hard', 'git clean'];

function classifyCommand(cmd) {
  const lower = cmd.toLowerCase();
  const isDangerous = DANGEROUS_COMMANDS.some(d => lower.includes(d.toLowerCase()));
  return { command: cmd, safe: !isDangerous, requiresHumanApproval: isDangerous };
}

function generateSafeCommandPlan(planInput = {}) {
  const {
    taskName = 'unnamed-task',
    targetVersion = '',
    commands = [],
    context = '',
    session_id = ''
  } = planInput;

  const classifiedCommands = commands.map((cmd, index) => ({
    step: index + 1,
    ...classifyCommand(cmd)
  }));

  const safeCommands = classifiedCommands.filter(c => c.safe);
  const dangerousCommands = classifiedCommands.filter(c => c.requiresHumanApproval);

  const safeToAutoExecute = dangerousCommands.length === 0;

  return {
    generator: 'safe-command-plan-generator',
    session_id,
    taskName,
    targetVersion,
    context,
    plan: classifiedCommands,
    safeCommands: safeCommands.map(c => c.command),
    dangerousCommands: dangerousCommands.map(c => c.command),
    totalSteps: classifiedCommands.length,
    safeStepCount: safeCommands.length,
    dangerousStepCount: dangerousCommands.length,
    safeToAutoExecute,
    humanApprovalRequired: !safeToAutoExecute,
    executionNote: safeToAutoExecute
      ? 'All commands are safe. Claude係長が自動実行可。'
      : `${dangerousCommands.length}件の危険コマンドあり。じゅんやさんのYES後に実行。`,
    version: '2.8.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateSafeCommandPlan, classifyCommand };

if (require.main === module) {
  const result = generateSafeCommandPlan({
    taskName: 'v2.8.0-release',
    targetVersion: '2.8.0',
    commands: [
      'npm run verify',
      'git add tools/one-shot-operation-plan.js',
      'git commit -m "v2.8.0 One-shot plan generator"',
      'git push origin main',
      'git tag v2.8.0'
    ]
  });
  console.log(JSON.stringify(result, null, 2));
}
