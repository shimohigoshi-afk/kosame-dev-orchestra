/**
 * One-shot Operation Plan v2.8.0
 *
 * Generates a complete end-to-end operation plan:
 * Claude prompt + Gemini prompt + safe command plan + human approval summary.
 */

const { generateClaudeTaskPrompt } = require('./claude-task-prompt-generator');
const { generateGeminiBulkPrompt } = require('./gemini-bulk-prompt-generator');
const { generateSafeCommandPlan } = require('./safe-command-plan-generator');
const { generateHumanApprovalSummary } = require('./human-approval-summary-generator');

function generateOneShotOperationPlan(planInput = {}) {
  const {
    operationName = 'unnamed-operation',
    targetVersion = '',
    taskDescription = '',
    targetFiles = [],
    commands = [],
    itemsToGenerate = [],
    dangerousCommands = [],
    riskLevel = 'Low',
    needsGemini = false,
    needsHumanApproval = false,
    constraints = [],
    consequences = [],
    session_id = ''
  } = planInput;

  const claudePrompt = generateClaudeTaskPrompt({
    taskType: 'implementation',
    taskName: operationName,
    description: taskDescription,
    targetFiles,
    constraints,
    session_id
  });

  const geminiPrompt = needsGemini
    ? generateGeminiBulkPrompt({ taskName: `${operationName} bulk gen`, itemsToGenerate, session_id })
    : null;

  const commandPlan = generateSafeCommandPlan({
    taskName: operationName,
    targetVersion,
    commands,
    session_id
  });

  const approvalSummary = (needsHumanApproval || commandPlan.dangerousStepCount > 0)
    ? generateHumanApprovalSummary({
        actionTitle: operationName,
        actionType: riskLevel === 'Critical' ? 'git_tag' : 'general',
        dangerousCommands: dangerousCommands.length > 0 ? dangerousCommands : commandPlan.dangerousCommands,
        riskLevel,
        reason: taskDescription,
        consequences,
        session_id
      })
    : null;

  const phases = [];
  if (needsGemini && geminiPrompt) phases.push('gemini_bulk_gen');
  phases.push('claude_implementation');
  if (commandPlan.safeStepCount > 0) phases.push('safe_commands');
  if (approvalSummary) phases.push('human_approval');

  return {
    plan: 'one-shot-operation-plan',
    session_id,
    operationName,
    targetVersion,
    phases,
    claudePrompt,
    geminiPrompt,
    commandPlan,
    approvalSummary,
    requiresHumanApproval: !!approvalSummary,
    riskLevel,
    totalCommands: commands.length,
    safeCommandCount: commandPlan.safeStepCount,
    dangerousCommandCount: commandPlan.dangerousStepCount,
    version: '2.8.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateOneShotOperationPlan };

if (require.main === module) {
  const result = generateOneShotOperationPlan({
    operationName: 'v2.8.0-release',
    targetVersion: '2.8.0',
    taskDescription: 'Implement v2.8.0 One-shot Operation Plan Generator pack',
    targetFiles: [
      'tools/one-shot-operation-plan.js',
      'tools/safe-command-plan-generator.js',
      'tools/claude-task-prompt-generator.js',
      'tools/gemini-bulk-prompt-generator.js',
      'tools/human-approval-summary-generator.js'
    ],
    commands: ['npm run verify', 'git add -p', 'git commit -m "v2.8.0"', 'git push origin main', 'git tag v2.8.0'],
    needsHumanApproval: true,
    riskLevel: 'High',
    dangerousCommands: ['git push origin main', 'git tag v2.8.0'],
    consequences: ['v2.8.0 commit lands on main', 'tag v2.8.0 created']
  });
  console.log(JSON.stringify(result, null, 2));
}
