/**
 * Human Approval Gate Controller v2.5.0
 *
 * Enforces human approval for: git push, git tag, deploy, Secret,
 * billing API, customer data, destructive delete, production changes.
 */

const GATE_REQUIRED_ACTIONS = [
  'git_push',
  'git_tag',
  'deploy',
  'cloud_run_deploy',
  'secret_change',
  'env_change',
  'api_key_change',
  'billing_api_call',
  'customer_data_access',
  'destructive_delete',
  'production_config_change',
  'external_service_publish'
];

function checkApprovalGate(requested_action) {
  const normalizedAction = requested_action.toLowerCase().replace(/[\s-]/g, '_');

  const isGated = GATE_REQUIRED_ACTIONS.some(ga =>
    normalizedAction.includes(ga) || ga.includes(normalizedAction)
  );

  return {
    requested_action,
    gate_required: isGated,
    gate_reason: isGated
      ? 'この操作はじゅんやさんの最終YESが必要です。approval packetを生成してから提示してください。'
      : 'AIチームが実行可能な操作です。',
    proceed: !isGated,
    approval_tools: isGated ? ['tools/kosame-approval-packet-generator.js'] : [],
    version: '2.5.0',
    dryRun: true
  };
}

function evaluateActionList(actions = []) {
  const results = actions.map(a => checkApprovalGate(a));
  const gated = results.filter(r => r.gate_required);
  const free = results.filter(r => !r.gate_required);

  return {
    total: actions.length,
    gated_count: gated.length,
    free_count: free.length,
    gated_actions: gated.map(r => r.requested_action),
    free_actions: free.map(r => r.requested_action),
    human_approval_required: gated.length > 0,
    safe_to_proceed_without_human: gated.length === 0,
    results,
    version: '2.5.0',
    dryRun: true
  };
}

module.exports = { checkApprovalGate, evaluateActionList, GATE_REQUIRED_ACTIONS };

if (require.main === module) {
  const actions = [
    'git push',
    'npm run verify',
    'git tag v2.5.0',
    'deploy to Cloud Run',
    'node --check',
    'customer_data_access'
  ];
  const result = evaluateActionList(actions);
  console.log(`Gated (${result.gated_count}): ${result.gated_actions.join(', ')}`);
  console.log(`Free (${result.free_count}): ${result.free_actions.join(', ')}`);
}
