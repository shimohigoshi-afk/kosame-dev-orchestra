/**
 * Semi-Auto Operation Policy v2.5.0
 *
 * Defines what Kosame can decide autonomously vs. what requires じゅんやさん's final YES.
 */

const KOSAME_AUTO_DECISIONS = [
  'provider_routing',
  'verify_proceed',
  'claude_repair_switch',
  'commit_candidate_judgment',
  'docs_smoke_tools_update',
  'gemini_fallback_to_claude',
  'approval_packet_submit',
  'dispatch_queue_order',
  'session_phase_advance',
  'retry_or_fallback_decision'
];

const JUNYA_REQUIRED_DECISIONS = [
  'git_push',
  'git_tag',
  'deploy',
  'cloud_run_production',
  'secret_env_api_key',
  'billing_api',
  'customer_data',
  'destructive_delete',
  'production_change',
  'external_service_publish'
];

function classifyDecision(decision_type) {
  if (KOSAME_AUTO_DECISIONS.includes(decision_type)) {
    return {
      decision_type,
      authority: 'kosame',
      requires_junya: false,
      description: 'こさめが推奨YES/NOを出す。実行はAI側で完結。',
      approval_packet_needed: false
    };
  }

  if (JUNYA_REQUIRED_DECISIONS.includes(decision_type)) {
    return {
      decision_type,
      authority: 'junya',
      requires_junya: true,
      description: 'じゅんやさんの最終YESが必要。approval packetを生成してから提示する。',
      approval_packet_needed: true
    };
  }

  return {
    decision_type,
    authority: 'kosame_with_caution',
    requires_junya: false,
    description: '判断材料を整理し、リスクが低ければこさめが決定。高リスクはじゅんやさんへ。',
    approval_packet_needed: false
  };
}

function getPolicySnapshot() {
  return {
    policy_type: 'semi_auto_operation_policy',
    kosame_auto_decisions: KOSAME_AUTO_DECISIONS,
    junya_required_decisions: JUNYA_REQUIRED_DECISIONS,
    principle: 'じゅんやさんをYES地獄に入れない。危険操作のみ最終YES/NOを求める。',
    version: '2.5.0',
    dryRun: true
  };
}

module.exports = { classifyDecision, getPolicySnapshot, KOSAME_AUTO_DECISIONS, JUNYA_REQUIRED_DECISIONS };

if (require.main === module) {
  const decisions = ['provider_routing', 'git_push', 'commit_candidate_judgment', 'deploy'];
  decisions.forEach(d => {
    const result = classifyDecision(d);
    console.log(`[${result.authority.toUpperCase()}] ${d}: ${result.description}`);
  });
}
