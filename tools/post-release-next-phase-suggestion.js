/**
 * Post-Release Next Phase Suggestion v2.9.0
 *
 * Suggests the next development phase after a release is complete.
 * Considers current version, roadmap, and open issues.
 */

const PHASE_SUGGESTIONS = {
  'v2.9.0': {
    nextVersion: 'v3.0.0',
    phaseName: 'Kosame Dev Orchestra Operating Console Foundation',
    description: 'Integrate v2.6–v2.9 into unified operating console. Add console command map and operating decision packet.',
    keyDeliverables: [
      'tools/kosame-operating-console-foundation.js',
      'tools/kosame-operating-decision-packet.js',
      'tools/operating-console-command-map.js'
    ]
  },
  'v3.0.0': {
    nextVersion: 'v3.1.0',
    phaseName: 'Post-v3.0 Operations',
    description: 'Monitor, stabilize, and extend v3.0 foundation based on operational learnings.',
    keyDeliverables: ['TBD based on operational feedback']
  }
};

function suggestNextPhase(suggestionInput = {}) {
  const {
    completedVersion = '',
    openIssues = [],
    failedSmokes = [],
    providerHealth = {},
    session_id = ''
  } = suggestionInput;

  const versionKey = completedVersion.startsWith('v') ? completedVersion : `v${completedVersion}`;
  const phaseSuggestion = PHASE_SUGGESTIONS[versionKey] || {
    nextVersion: 'TBD',
    phaseName: 'Next Phase',
    description: 'Determine next steps based on current state.',
    keyDeliverables: []
  };

  const immediateActions = [];
  if (failedSmokes.length > 0) {
    immediateActions.push(`Fix failing smokes before next phase: ${failedSmokes.join(', ')}`);
  }
  if (openIssues.length > 0) {
    immediateActions.push(`Resolve open issues: ${openIssues.join(', ')}`);
  }
  if (providerHealth.gemini && providerHealth.gemini.includes('error')) {
    immediateActions.push('Investigate Gemini auth — consider Claude-only mode for next phase');
  }

  const readyForNextPhase = immediateActions.length === 0;

  return {
    suggestion: 'post-release-next-phase-suggestion',
    session_id,
    completedVersion,
    nextVersion: phaseSuggestion.nextVersion,
    phaseName: phaseSuggestion.phaseName,
    description: phaseSuggestion.description,
    keyDeliverables: phaseSuggestion.keyDeliverables,
    immediateActions,
    readyForNextPhase,
    recommendedFirstStep: readyForNextPhase
      ? `Start ${phaseSuggestion.nextVersion} implementation`
      : immediateActions[0],
    openIssues,
    failedSmokes,
    version: '2.9.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { suggestNextPhase, PHASE_SUGGESTIONS };

if (require.main === module) {
  const result = suggestNextPhase({
    completedVersion: '2.9.0',
    openIssues: [],
    failedSmokes: [],
    providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
  });
  console.log(JSON.stringify(result, null, 2));
}
