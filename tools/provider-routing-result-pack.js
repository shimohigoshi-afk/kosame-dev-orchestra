/**
 * Provider Routing Result Pack v2.2.0
 *
 * Evaluates a routing request and returns recommended provider and next action.
 */

function evaluateRoutingRequest(request) {
  const {
    task_type,
    risk_level,
    needs_bulk_generation,
    needs_precise_repair,
    needs_architecture_judgment,
    needs_cloud_shell_verify,
    blocked_provider = [],
    human_approval_required,
    urgency
  } = request;

  let recommended_provider = 'claude';
  let fallback_provider = 'human';
  let reason = '';
  let confidence = 'medium';
  let approval_packet_required = false;
  let cloud_shell_commands_needed = false;
  let next_action = '';

  const geminiBlocked = blocked_provider.includes('gemini');
  const claudeBlocked = blocked_provider.includes('claude');

  // Architecture / design judgment → kosame
  if (needs_architecture_judgment) {
    recommended_provider = 'kosame';
    fallback_provider = 'claude';
    reason = 'Architecture judgment requires PM perspective (Kosame).';
    confidence = 'high';
  }
  // Bulk generation + Gemini not blocked → gemini
  else if (needs_bulk_generation && !geminiBlocked) {
    recommended_provider = 'gemini';
    fallback_provider = 'claude';
    reason = 'Bulk generation is best handled by Gemini (wide context window).';
    confidence = 'high';
  }
  // Bulk generation + Gemini blocked → claude
  else if (needs_bulk_generation && geminiBlocked) {
    recommended_provider = 'claude';
    fallback_provider = 'human';
    reason = 'Bulk generation requested but Gemini is blocked. Claude takes over.';
    confidence = 'medium';
  }
  // Precise repair → claude
  else if (needs_precise_repair) {
    recommended_provider = 'claude';
    fallback_provider = 'human';
    reason = 'Precise repair requires tool execution and verify cycle (Claude).';
    confidence = 'high';
  }
  // Cloud shell verify → cloud_shell
  else if (needs_cloud_shell_verify) {
    recommended_provider = 'cloud_shell';
    fallback_provider = 'claude';
    reason = 'Cloud Shell verification requested for GCP infra.';
    confidence = 'high';
    cloud_shell_commands_needed = true;
  }
  // Docs/smoke update → claude (fast)
  else if (['docs_update', 'smoke_update', 'release_record'].includes(task_type)) {
    recommended_provider = 'claude';
    fallback_provider = 'kosame';
    reason = 'Docs/smoke/release update: Claude handles directly.';
    confidence = 'high';
  }
  // Default → claude
  else {
    recommended_provider = 'claude';
    fallback_provider = 'human';
    reason = 'Default routing to Claude.';
    confidence = 'low';
  }

  // Override: if recommended is also blocked
  if (claudeBlocked && recommended_provider === 'claude') {
    recommended_provider = 'human';
    reason += ' Claude is blocked; escalating to human.';
    confidence = 'low';
  }

  // Human approval required for High/Critical risk
  if (risk_level === 'High' || risk_level === 'Critical' || human_approval_required) {
    approval_packet_required = true;
  }

  // Determine required_checks
  const required_checks = ['node --check', 'npm run verify'];
  if (needs_cloud_shell_verify) required_checks.push('cloud_shell_verify');
  if (approval_packet_required) required_checks.push('approval_packet');

  // next_action
  if (recommended_provider === 'gemini') {
    next_action = 'generate_gemini_bulk_task_packet';
  } else if (recommended_provider === 'claude') {
    next_action = 'generate_claude_main_task_packet';
  } else if (recommended_provider === 'kosame') {
    next_action = 'kosame_makes_routing_decision';
  } else if (recommended_provider === 'cloud_shell') {
    next_action = 'run_cloud_shell_verify';
  } else {
    next_action = 'escalate_to_human';
  }

  return {
    task_id: request.task_id,
    recommended_provider,
    fallback_provider,
    reason,
    confidence,
    required_checks,
    approval_packet_required,
    cloud_shell_commands_needed,
    next_action,
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { evaluateRoutingRequest };

if (require.main === module) {
  const { createRoutingRequest } = require('./provider-routing-request-pack.js');
  const request = createRoutingRequest({
    task_id: 'task-demo-001',
    task_title: 'demo routing',
    task_type: 'bulk_generation',
    needs_bulk_generation: true,
    blocked_provider: ['gemini'],
    risk_level: 'Low'
  });
  const result = evaluateRoutingRequest(request);
  console.log(JSON.stringify(result, null, 2));
}
