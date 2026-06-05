'use strict';

const TOOL_META = {
  version: '110.2.0',
  title: 'Gate-Supervised Autopilot Pack',
  slug: 'dev-agent-gate-supervised-autopilot-pack'
};

const AUTOPILOT_MODE = 'GATE_SUPERVISED';

const NORMAL_ACTIONS = [
  'create_local_tool_files',
  'create_smoke_tests',
  'create_fixtures',
  'create_docs',
  'update_package_scripts',
  'update_verify_script',
  'run_node_check',
  'run_smoke_tests',
  'run_npm_run_verify',
  'inspect_git_status',
  'prepare_commit_candidate_report',
  'generate_next_command_suggestions'
];

const APPROVAL_GATE_ACTIONS = [
  'git_add',
  'git_commit',
  'git_tag',
  'git_push',
  'deploy',
  'docker_build',
  'gcloud_commands',
  'npm_publish',
  'read_secrets',
  'edit_env',
  'access_customer_data',
  'access_insurance_data',
  'access_health_data',
  'send_email',
  'send_discord',
  'send_sns',
  'live_external_message',
  'billing_action',
  'contract_action',
  'payment_action',
  'expensive_model_escalation',
  'destructive_operations'
];

const FORBIDDEN_AUTONOMOUS_ACTIONS = [
  'git_commit_without_approval',
  'git_tag_without_approval',
  'git_push_without_approval',
  'deploy_without_approval',
  'read_env_or_secrets',
  'touch_customer_data',
  'touch_insurance_data',
  'touch_health_data',
  'live_external_send',
  'billing_payment_contract_without_approval',
  'destructive_delete_without_approval'
];

const GPT_CONSTRAINT_POLICY = {
  allowedRoles: [
    'summarize_logs',
    'format_commands',
    'clean_claude_prompts',
    'explain_errors',
    'classify_small_text',
    'prepare_handoff_snippets'
  ],
  forbiddenRoles: [
    'decide_task_order',
    'change_agreed_sequence',
    'move_from_v110_2_to_other_task',
    'suggest_anesty_board_work',
    'say_too_early_or_lets_reconsider_without_dangerous_gate',
    'act_as_pm_or_court_or_judge'
  ],
  gptRole: 'execution_assistant_only'
};

const CLAUDE_LOAD_POLICY = {
  receiveFullLogs: false,
  receiveFailureSnapshot: true,
  receiveSummarizedContext: true,
  recommendedPreprocessor: 'gemini',
  alternativeProvider: 'grok',
  lastResortAdvisory: 'deepseek_kimi_sanitized_only'
};

const GEMINI_PREPROCESS_POLICY = {
  useForLongInputs: true,
  preprocessBeforeClaudeReceives: true,
  purpose: 'reduce_claude_context_load'
};

function evaluateAction(input) {
  const { action = '' } = input || {};
  const actionKey = action.toLowerCase().replace(/[\s\-]/g, '_');

  const isNormal        = NORMAL_ACTIONS.includes(actionKey);
  const isApprovalGate  = APPROVAL_GATE_ACTIONS.includes(actionKey);
  const isForbidden     = FORBIDDEN_AUTONOMOUS_ACTIONS.includes(actionKey);

  if (isForbidden || isApprovalGate) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      autopilotMode: AUTOPILOT_MODE,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      action,
      shouldProceedAutomatically: false,
      shouldAskUser: true,
      humanApprovalRequired: true,
      approvalMessage: `Human approval required before executing: ${action}`,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  if (isNormal) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      autopilotMode: AUTOPILOT_MODE,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      action,
      shouldProceedAutomatically: true,
      shouldAskUser: false,
      humanApprovalRequired: false,
      approvalMessage: null,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    autopilotMode: AUTOPILOT_MODE,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    action,
    shouldProceedAutomatically: false,
    shouldAskUser: true,
    humanApprovalRequired: true,
    approvalMessage: `Unknown action — human review required: ${action}`,
    gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
    claudeLoadPolicy: CLAUDE_LOAD_POLICY,
    geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
  };
}

function buildPolicyReport() {
  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    autopilotMode: AUTOPILOT_MODE,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    normalActions: NORMAL_ACTIONS,
    approvalGateActions: APPROVAL_GATE_ACTIONS,
    forbiddenAutonomousActions: FORBIDDEN_AUTONOMOUS_ACTIONS,
    humanApprovalRequired: true,
    gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
    claudeLoadPolicy: CLAUDE_LOAD_POLICY,
    geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
  };
}

function main() {
  const report = buildPolicyReport();
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  AUTOPILOT_MODE,
  NORMAL_ACTIONS,
  APPROVAL_GATE_ACTIONS,
  FORBIDDEN_AUTONOMOUS_ACTIONS,
  GPT_CONSTRAINT_POLICY,
  CLAUDE_LOAD_POLICY,
  GEMINI_PREPROCESS_POLICY,
  evaluateAction,
  buildPolicyReport
};
