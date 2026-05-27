/**
 * Provider Routing Request Pack v2.2.0
 *
 * Creates a routing request packet for Kosame to determine next AI provider.
 */

const TASK_TYPES = ['bulk_generation', 'precise_repair', 'architecture_design', 'cloud_infra', 'docs_update', 'smoke_update', 'release_record'];
const PROVIDERS = ['gemini', 'claude', 'kosame', 'cloud_shell', 'github_actions', 'human'];
const URGENCY_LEVELS = ['low', 'normal', 'high', 'critical'];
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

function createRoutingRequest(params = {}) {
  const {
    task_id = `task-${Date.now()}`,
    task_title = '',
    task_type = 'docs_update',
    target_files = [],
    urgency = 'normal',
    risk_level = 'Low',
    needs_bulk_generation = false,
    needs_precise_repair = false,
    needs_architecture_judgment = false,
    needs_cloud_shell_verify = false,
    blocked_provider = [],
    forbidden_actions = [],
    human_approval_required = false
  } = params;

  if (!TASK_TYPES.includes(task_type)) {
    throw new Error(`Invalid task_type: ${task_type}. Valid: ${TASK_TYPES.join(', ')}`);
  }
  if (!URGENCY_LEVELS.includes(urgency)) {
    throw new Error(`Invalid urgency: ${urgency}`);
  }
  if (!RISK_LEVELS.includes(risk_level)) {
    throw new Error(`Invalid risk_level: ${risk_level}`);
  }

  return {
    task_id,
    task_title,
    task_type,
    target_files,
    urgency,
    risk_level,
    needs_bulk_generation,
    needs_precise_repair,
    needs_architecture_judgment,
    needs_cloud_shell_verify,
    blocked_provider,
    forbidden_actions,
    human_approval_required,
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createRoutingRequest, TASK_TYPES, PROVIDERS, URGENCY_LEVELS, RISK_LEVELS };

if (require.main === module) {
  const request = createRoutingRequest({
    task_id: 'task-v2.2.0-001',
    task_title: 'v2.2.0 Provider Router Practical Pack 実装',
    task_type: 'bulk_generation',
    target_files: ['tools/provider-routing-result-pack.js'],
    urgency: 'normal',
    risk_level: 'Low',
    needs_bulk_generation: true,
    needs_precise_repair: false,
    blocked_provider: ['gemini'],
    forbidden_actions: ['git push', 'deploy'],
    human_approval_required: false
  });
  console.log(JSON.stringify(request, null, 2));
}
