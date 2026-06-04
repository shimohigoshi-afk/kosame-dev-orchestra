'use strict';

const TOOL_META = {
  version: '83.0.0',
  title: 'KOSAME Dev Orchestra Failure / Retry Pattern Pack',
  slug: 'dev-agent-failure-retry-pattern-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'api key read',
  'customer data read',
  'insurance data read',
  'deploy',
  'git add/commit/push/tag',
  'destructive delete',
  'external repo mutation'
];

const REQUIRED_FAILURES = [
  'verify script replaced by node -e',
  'simulated verification without real logs',
  'wrong relative path in tools/smoke',
  'git add -A included unexpected files',
  'docs count mismatch',
  'Claude prompt missing forbiddenFiles / forbiddenCommands',
  'timeout追加だけで原因未特定'
];

function buildFailureRetryPattern(input = {}) {
  const knownFailures = input.knownFailures || REQUIRED_FAILURES.map((failure, index) => ({
    failureId: `known-failure-${String(index + 1).padStart(2, '0')}`,
    symptom: failure,
    rootCause: index === 0
      ? 'Existing verify chain was overwritten instead of appended'
      : index === 1
        ? 'Report claimed validation without actual command output'
        : 'Implementation or process guard was missing',
    detectedBy: ['Acceptance Gate', 'smoke', 'npm run verify', 'git status'],
    preventionRule: `Prevent: ${failure}`,
    retryPolicy: 'Stop, narrow scope, repair only the failed layer, then rerun real logs',
    doNotRepeat: true
  }));

  return {
    failureRetryPatternId: input.failureRetryPatternId || 'failure-retry-pattern-v83',
    knownFailures,
    retryPatterns: [
      'Narrow the version range to 5-pack chunks',
      'Preserve verify and append new smoke only',
      'Use explicit intended-file add; never git add -A',
      'Require real command logs before commit candidate'
    ],
    antiLoopRules: [
      'Do not add timeout repeatedly without locating the stop point',
      'Do not blame Cloud Shell before checking code and command syntax',
      'Do not proceed to the next version while current smoke is unverified'
    ],
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildFailureRetryPattern(), null, 2));
}

module.exports = {
  TOOL_META,
  REQUIRED_FAILURES,
  DANGEROUS_ACTIONS_DENIED,
  buildFailureRetryPattern
};
