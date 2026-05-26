/**
 * Operator Gemini Next Work Pack v1.1.4
 * 
 * Prepares a task packet for the next Gemini session.
 */

function prepareGeminiTask(data) {
  const { phase, scope, prohibited, reporting } = data;

  return {
    version: '1.1.4',
    timestamp: new Date().toISOString(),
    taskPacket: {
      title: `Gemini Next Work: ${phase}`,
      instructions: [
        `Phase: ${phase}`,
        `Scope: ${scope.join(', ')}`,
        'Constraint: DO NOT execute any shell commands.',
        'Constraint: Use write_file/replace for all changes.',
        `Prohibited: ${prohibited.join(', ')}`
      ],
      expectedOutput: reporting
    }
  };
}

module.exports = { prepareGeminiTask };

// CLI Entry Point
if (require.main === module) {
  const packet = prepareGeminiTask({
    phase: 'v1.2.1-v1.4.0',
    scope: ['Operator Console Web UI Foundation', 'API Endpoints'],
    prohibited: ['git push', 'gcloud deploy', 'npm run verify'],
    reporting: 'Final Report with diff-stat and verification steps.'
  });
  console.log(JSON.stringify(packet, null, 2));
}
