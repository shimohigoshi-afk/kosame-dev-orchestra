'use strict';

const TOOL_META = {
  version: '110.2.0',
  title: 'Failure Snapshot + Gate-Supervised Autopilot Integrated Gate Pack',
  slug: 'dev-agent-failure-snapshot-gate-autopilot-pack'
};

const { buildSnapshot, FAILURE_TYPES } = require('./dev-agent-failure-snapshot-pack.js');
const {
  evaluateAction,
  NORMAL_ACTIONS,
  APPROVAL_GATE_ACTIONS,
  FORBIDDEN_AUTONOMOUS_ACTIONS,
  GPT_CONSTRAINT_POLICY,
  CLAUDE_LOAD_POLICY,
  GEMINI_PREPROCESS_POLICY
} = require('./dev-agent-gate-supervised-autopilot-pack.js');

const GATE_DECISIONS = {
  AUTO_PROCEED:                      'AUTO_PROCEED',
  NEEDS_HUMAN_APPROVAL:              'NEEDS_HUMAN_APPROVAL',
  SNAPSHOT_REQUIRED:                 'SNAPSHOT_REQUIRED',
  BLOCKED_DANGEROUS_ACTION:          'BLOCKED_DANGEROUS_ACTION',
  BLOCKED_CONTEXT_OVERLOAD:          'BLOCKED_CONTEXT_OVERLOAD',
  BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF: 'BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF'
};

const SENSITIVE_DATA_KEYWORDS = [
  'secret', 'env', 'api_key', 'customer_data', 'insurance_data', 'health_data',
  '.env', 'apikey', 'token', 'password', 'credential'
];

const EXTERNAL_UNSANITIZED_PROVIDERS = ['deepseek', 'kimi'];

function classifyGate(input) {
  const {
    action             = '',
    failureType        = null,
    targetProvider     = null,
    sanitized          = true,
    contextOverloaded  = false,
    snapshotInput      = null
  } = input || {};

  const actionKey = action.toLowerCase().replace(/[\s\-]/g, '_');

  // Context overload → BLOCKED_CONTEXT_OVERLOAD or SNAPSHOT_REQUIRED
  if (contextOverloaded || failureType === 'context_too_large') {
    const snap = snapshotInput
      ? buildSnapshot({ ...snapshotInput, failureType: 'context_too_large' })
      : buildSnapshot({ failureType: 'context_too_large', failureSummary: 'Context too large — snapshot produced' });
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      gateDecision: GATE_DECISIONS.BLOCKED_CONTEXT_OVERLOAD,
      reason: 'Context too large — use failure snapshot, not full log',
      shouldReadFullLog: false,
      humanApprovalRequired: false,
      snapshot: snap,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  // Provider failure → SNAPSHOT_REQUIRED
  if (failureType && FAILURE_TYPES.includes(failureType) && failureType !== 'unknown') {
    if (['provider_timeout', 'provider_unavailable', 'verification_failed',
         'smoke_failed', 'ambiguous_output', 'budget_gate', 'human_gate'].includes(failureType)) {
      const snap = snapshotInput
        ? buildSnapshot({ ...snapshotInput, failureType })
        : buildSnapshot({ failureType, failureSummary: `Provider failure: ${failureType}` });
      return {
        tool: TOOL_META.slug,
        version: TOOL_META.version,
        dryRun: true,
        realProductActionsExecuted: false,
        dangerousActionsDenied: true,
        gateDecision: GATE_DECISIONS.SNAPSHOT_REQUIRED,
        reason: `Failure detected: ${failureType} — snapshot generated for handoff`,
        humanApprovalRequired: failureType === 'budget_gate' || failureType === 'human_gate',
        snapshot: snap,
        gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
        claudeLoadPolicy: CLAUDE_LOAD_POLICY,
        geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
      };
    }
  }

  // External unsanitized handoff → BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF
  if (targetProvider && EXTERNAL_UNSANITIZED_PROVIDERS.includes(targetProvider.toLowerCase()) && !sanitized) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      gateDecision: GATE_DECISIONS.BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF,
      reason: `Handoff to ${targetProvider} requires sanitized content — unsanitized handoff blocked`,
      humanApprovalRequired: true,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  // Sensitive data check
  const isSensitive = SENSITIVE_DATA_KEYWORDS.some(k => actionKey.includes(k));
  if (isSensitive) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      gateDecision: GATE_DECISIONS.BLOCKED_DANGEROUS_ACTION,
      reason: `Action touches sensitive data: ${action}`,
      humanApprovalRequired: true,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  // Evaluate normal vs gate action
  const evaluation = evaluateAction({ action: actionKey });

  if (evaluation.humanApprovalRequired) {
    const isApprovalGate = APPROVAL_GATE_ACTIONS.includes(actionKey)
      || FORBIDDEN_AUTONOMOUS_ACTIONS.includes(actionKey);
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      gateDecision: GATE_DECISIONS.NEEDS_HUMAN_APPROVAL,
      reason: evaluation.approvalMessage || `Approval gate: ${action}`,
      humanApprovalRequired: true,
      approvalMessage: evaluation.approvalMessage,
      gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
      claudeLoadPolicy: CLAUDE_LOAD_POLICY,
      geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
    };
  }

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    gateDecision: GATE_DECISIONS.AUTO_PROCEED,
    reason: `Routine local action — proceed automatically: ${action}`,
    humanApprovalRequired: false,
    shouldProceedAutomatically: true,
    shouldAskUser: false,
    gptConstraintPolicy: GPT_CONSTRAINT_POLICY,
    claudeLoadPolicy: CLAUDE_LOAD_POLICY,
    geminiPreprocessPolicy: GEMINI_PREPROCESS_POLICY
  };
}

function main() {
  const result = classifyGate({ action: 'create_local_tool_files' });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  GATE_DECISIONS,
  SENSITIVE_DATA_KEYWORDS,
  EXTERNAL_UNSANITIZED_PROVIDERS,
  classifyGate
};
