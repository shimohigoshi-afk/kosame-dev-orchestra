/**
 * Agent Dispatch Request Pack v2.3.0
 *
 * Standard input packet for dispatching work to an AI agent.
 */

const DISPATCH_PRIORITIES = ['critical', 'high', 'normal', 'low'];
const DISPATCH_AGENTS = ['gemini', 'claude', 'cloud_shell', 'github_actions', 'human'];

function createDispatchRequest(params = {}) {
  const {
    request_id = `dr-${Date.now()}`,
    task_id,
    task_title = '',
    task_description = '',
    assigned_agent,
    priority = 'normal',
    risk_level = 'Low',
    target_files = [],
    constraints = [],
    forbidden_actions = [],
    requires_verify = true,
    requires_human_approval = false,
    timeout_minutes = 30,
    fallback_agent = null,
    metadata = {}
  } = params;

  if (!DISPATCH_AGENTS.includes(assigned_agent)) {
    throw new Error(`Invalid assigned_agent: ${assigned_agent}. Valid: ${DISPATCH_AGENTS.join(', ')}`);
  }
  if (!DISPATCH_PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority: ${priority}`);
  }

  return {
    request_id,
    task_id,
    task_title,
    task_description,
    assigned_agent,
    priority,
    risk_level,
    target_files,
    constraints,
    forbidden_actions,
    requires_verify,
    requires_human_approval,
    timeout_minutes,
    fallback_agent: fallback_agent || (assigned_agent === 'gemini' ? 'claude' : 'human'),
    metadata,
    status: 'pending',
    version: '2.3.0',
    created_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createDispatchRequest, DISPATCH_PRIORITIES, DISPATCH_AGENTS };

if (require.main === module) {
  const req = createDispatchRequest({
    task_id: 'task-v2.3.0-001',
    task_title: 'v2.3.0 docs生成',
    task_description: 'Agent dispatch execution packのdocs・tools・smokeを追加する',
    assigned_agent: 'claude',
    priority: 'normal',
    risk_level: 'Low',
    target_files: ['docs/ai-dev-team/agent-dispatch-request-v2.3.0.md'],
    requires_verify: true,
    requires_human_approval: false
  });
  console.log(JSON.stringify(req, null, 2));
}
