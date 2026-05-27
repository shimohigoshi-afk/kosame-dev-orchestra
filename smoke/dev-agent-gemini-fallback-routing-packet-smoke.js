/**
 * Smoke Test: Gemini Fallback Routing Packet v2.1.0
 */

const { generateFallbackRoutingPacket } = require('../tools/gemini-fallback-routing-packet.js');

function runSmokeTest() {
  console.log('Running smoke test: Gemini Fallback Routing Packet v2.1.0');

  const packet = generateFallbackRoutingPacket({
    originalTask: {
      description: 'v2.1.0 Provider Routing 実装',
      targetVersion: '2.1.0',
      targetFiles: ['tools/provider-health-status.js'],
      constraints: ['npm run verify が通ること']
    },
    geminiStopReason: 'auth_error',
    geminiStopDetail: 'metadata server application default credentials',
    currentState: {
      packageVersion: '2.0.0',
      verifyStatus: 'passed',
      lastKnownGoodCommit: '76d0e3b'
    },
    filesModified: [],
    filesNotYetModified: ['tools/provider-health-status.js']
  });

  if (packet.packetType !== 'gemini_fallback_routing_packet') throw new Error('Wrong packetType');
  if (packet.version !== '2.1.0') throw new Error('Version mismatch');
  if (!packet.geminiStatus.isAuthError) throw new Error('isAuthError should be true for auth_error');
  if (packet.geminiStatus.isQuotaError) throw new Error('isQuotaError should be false');
  if (!Array.isArray(packet.claudeInstructions)) throw new Error('claudeInstructions must be array');
  if (packet.claudeInstructions.length === 0) throw new Error('claudeInstructions is empty');
  if (!Array.isArray(packet.safetyConstraints)) throw new Error('safetyConstraints must be array');
  if (!packet.safetyConstraints.some(c => c.includes('git push'))) throw new Error('Missing git push constraint');
  if (!packet.dryRun) throw new Error('dryRun flag missing');

  // metadata server error classification
  if (packet.geminiStatus.triggerClassification !== 'metadata_server_error') {
    throw new Error(`Wrong trigger: ${packet.geminiStatus.triggerClassification}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Gemini Fallback Routing Packet Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
