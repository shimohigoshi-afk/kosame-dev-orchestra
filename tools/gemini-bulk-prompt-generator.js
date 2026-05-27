/**
 * Gemini Bulk Prompt Generator v2.8.0
 *
 * Generates structured bulk-generation prompts for Gemini課長.
 * Output is a ready-to-send prompt object (dryRun — not actually sent).
 */

function generateGeminiBulkPrompt(bulkInput = {}) {
  const {
    taskName = 'unnamed-bulk-task',
    itemsToGenerate = [],
    outputFormat = 'javascript',
    templateHints = [],
    patternExample = '',
    maxTokensPerItem = 1000,
    session_id = ''
  } = bulkInput;

  const itemList = itemsToGenerate.map((item, i) => `${i + 1}. ${item}`).join('\n');

  const prompt = [
    `# Gemini課長 Bulk Generation Task: ${taskName}`,
    ``,
    `## Output Format: ${outputFormat}`,
    ``,
    `## Items to Generate (${itemsToGenerate.length})`,
    itemList || '(no items specified)',
    ``,
    `## Template / Pattern Hints`,
    templateHints.length > 0 ? templateHints.map(h => `- ${h}`).join('\n') : '(none)',
    ``,
    `## Pattern Example`,
    patternExample || '(none provided)',
    ``,
    `## Rules`,
    `- Generate each item in the exact format specified`,
    `- dryRun: true — output only, do not execute`,
    `- Max ~${maxTokensPerItem} tokens per item`,
    `- If unsure about an item, output a placeholder and flag it`
  ].join('\n');

  return {
    generator: 'gemini-bulk-prompt-generator',
    session_id,
    taskName,
    prompt,
    itemCount: itemsToGenerate.length,
    outputFormat,
    templateHints,
    maxTokensPerItem,
    estimatedTotalTokens: itemsToGenerate.length * maxTokensPerItem,
    suitableForGemini: itemsToGenerate.length >= 3,
    fallbackNote: itemsToGenerate.length < 3
      ? 'Small batch — consider using Claude係長 instead'
      : 'Large enough for Gemini課長 bulk processing',
    version: '2.8.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateGeminiBulkPrompt };

if (require.main === module) {
  const result = generateGeminiBulkPrompt({
    taskName: 'Generate smoke test stubs',
    itemsToGenerate: [
      'dev-agent-git-status-importer-smoke.js',
      'dev-agent-github-actions-result-importer-smoke.js',
      'dev-agent-verify-result-importer-smoke.js'
    ],
    outputFormat: 'javascript',
    templateHints: ['follow existing smoke test pattern', 'assert PASS/FAIL with process.exit(1)'],
    maxTokensPerItem: 800
  });
  console.log(JSON.stringify(result, null, 2));
}
