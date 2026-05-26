/**
 * Operator Claude Escalation Pack v1.1.3
 * 
 * Prepares an escalation packet for Claude.
 */

function prepareEscalation(data) {
  const { feature, failedSmoke, errorLog, safeFiles, protectedFiles, verifyCmd } = data;

  const handoff = `Hello Claude. Gemini has made great progress on ${feature}, but we've hit a roadblock. 
Specifically, the following tests are failing: ${failedSmoke.join(', ')}.
Error details: ${errorLog}

We've already implemented the core logic. Could you please resolve these failures?
- **Safe to edit**: ${safeFiles.join(', ')}
- **Do not touch**: ${protectedFiles.join(', ')}
- **Verification**: Please run \`${verifyCmd}\` to confirm the fix.

Thank you for your senior technical expertise!`;

  return {
    version: '1.1.3',
    timestamp: new Date().toISOString(),
    escalationPacket: {
      handoff: handoff,
      context: {
        feature: feature,
        failedSmoke: failedSmoke,
        errorLog: errorLog,
        safeFiles: safeFiles,
        protectedFiles: protectedFiles,
        verifyCmd: verifyCmd
      }
    }
  };
}

module.exports = { prepareEscalation };

// CLI Entry Point
if (require.main === module) {
  const packet = prepareEscalation({
    feature: 'Operator Console v1.1.x',
    failedSmoke: ['dev-agent-operator-local-console-cli-smoke.js'],
    errorLog: 'ReferenceError: routeCommand is not defined',
    safeFiles: ['tools/operator-local-console-cli.js'],
    protectedFiles: ['tools/operator-cli-command-router.js'],
    verifyCmd: 'npm run verify'
  });
  console.log(JSON.stringify(packet, null, 2));
}
