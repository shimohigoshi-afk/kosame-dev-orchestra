/**
 * Claude Task Prompt Generator v2.8.0
 *
 * Generates structured prompts for Claude係長 task execution.
 * Output is a ready-to-send prompt object (dryRun — not actually sent).
 */

function generateClaudeTaskPrompt(taskInput = {}) {
  const {
    taskType = 'implementation',
    taskName = 'unnamed-task',
    description = '',
    targetFiles = [],
    constraints = [],
    verifyCommand = 'npm run verify',
    context = '',
    session_id = ''
  } = taskInput;

  const DEFAULT_CONSTRAINTS = [
    'ANESTY Board本体には触らない',
    '/home/shimohigoshi/anesty-board には触らない',
    'Secret / .env / API key を読まない',
    '外部APIを実行しない',
    'git push / git tag しない',
    'rm -rf しない'
  ];

  const allConstraints = [...DEFAULT_CONSTRAINTS, ...constraints];

  const prompt = [
    `# Claude係長 Task: ${taskName}`,
    ``,
    `## Task Type: ${taskType}`,
    ``,
    `## Description`,
    description || '(description not provided)',
    ``,
    `## Target Files`,
    targetFiles.length > 0 ? targetFiles.map(f => `- ${f}`).join('\n') : '- (not specified)',
    ``,
    `## Context`,
    context || '(no additional context)',
    ``,
    `## Constraints (MUST follow)`,
    allConstraints.map(c => `- ${c}`).join('\n'),
    ``,
    `## Completion Criteria`,
    `- Run \`${verifyCommand}\` and confirm all smokes PASS`,
    `- Report: files changed, assertions passed, any issues found`,
    ``,
    `## Safety`,
    `dryRun: true — do not execute dangerous operations autonomously.`
  ].join('\n');

  return {
    generator: 'claude-task-prompt-generator',
    session_id,
    taskType,
    taskName,
    prompt,
    targetFiles,
    constraints: allConstraints,
    verifyCommand,
    estimatedComplexity: targetFiles.length > 5 ? 'high' : targetFiles.length > 2 ? 'medium' : 'low',
    version: '2.8.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateClaudeTaskPrompt };

if (require.main === module) {
  const result = generateClaudeTaskPrompt({
    taskType: 'implementation',
    taskName: 'Add kosame-status-command',
    description: 'Implement executeStatusCommand with deriveStatusNextAction',
    targetFiles: ['tools/kosame-status-command.js', 'smoke/dev-agent-kosame-status-command-smoke.js'],
    constraints: ['v2.5.0 semi-auto packs を壊さない']
  });
  console.log(JSON.stringify(result, null, 2));
}
