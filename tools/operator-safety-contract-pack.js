/**
 * Operator Safety Contract Pack v1.2.4
 *
 * Defines and validates the safety boundaries for all operator actions.
 */

const FORBIDDEN_ACTIONS = [
  'git push',
  'git commit',
  'git tag',
  'gcloud run deploy',
  'docker build',
  'docker push',
  'rm -rf',
  'git reset --hard',
  'git clean',
  'printenv',
  'env'
];

const ALLOWED_ACTIONS = [
  'node --check',
  'npm run verify',
  'git status',
  'git diff',
  'git diff --stat',
  'git diff --name-only',
  'File create',
  'File edit'
];

function validateAction(action) {
  const isForbidden = FORBIDDEN_ACTIONS.some(f => action.includes(f));
  const isAllowed = ALLOWED_ACTIONS.some(a => action.includes(a));

  return {
    action,
    isForbidden,
    isAllowed,
    verdict: isForbidden ? 'BLOCKED' : isAllowed ? 'ALLOWED' : 'REQUIRES_REVIEW'
  };
}

function generateSafetyContract() {
  return {
    version: '1.2.4',
    timestamp: new Date().toISOString(),
    contract: 'Local Operator Console Safety Contract',
    forbiddenActions: FORBIDDEN_ACTIONS,
    allowedActions: ALLOWED_ACTIONS,
    principle: 'dry-run / local-only / human approval gate before any external effect',
    humanApprovalRequired: [
      'git commit', 'git push', 'git tag', 'deploy', 'gcloud', 'Secret access', 'billing API'
    ],
    dryRun: true
  };
}

module.exports = { generateSafetyContract, validateAction, FORBIDDEN_ACTIONS, ALLOWED_ACTIONS };

if (require.main === module) {
  const result = generateSafetyContract();
  console.log(JSON.stringify(result, null, 2));
}
