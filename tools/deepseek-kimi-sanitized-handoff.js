'use strict';

const TOOL_META = {
  version: '110.8.0',
  title: 'DeepSeek / Kimi Sanitized Handoff Pipeline',
  slug: 'deepseek-kimi-sanitized-handoff'
};

const { autoMask } = require('./sensitive-data-auto-masker');
const { evaluateHandoff } = require('./dev-agent-sanitized-handoff-guard-pack');

const SUPPORTED_PROVIDERS = ['deepseek', 'kimi'];

// Content types that are always blocked regardless of masking
const ALWAYS_BLOCKED_CONTENT_TYPES = [
  'deploy_credential', 'raw_production_log', 'unpublished_strategy',
  'billing_detail', 'exact_revenue_figure'
];

// Content types that are safe to send after masking
const SAFE_AFTER_MASKING_CONTENT_TYPES = [
  'abstracted_error_summary',
  'anonymized_code_snippet',
  'pseudocode',
  'generic_architecture_question',
  'public_library_behavior_question',
  'anonymized_stack_trace'
];

function buildHandoffPacket(input) {
  const {
    targetProvider = '',
    content = null,
    contentTypes = [],
    taskDescription = '',
    dryRun = true
  } = input || {};

  const provider = targetProvider.toLowerCase();

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      humanApprovalRequired: true,
      allowed: false,
      reason: `${targetProvider} is not a supported provider for sanitized handoff (supported: ${SUPPORTED_PROVIDERS.join(', ')})`,
      maskedContent: null,
      sanitized: false
    };
  }

  // Step 1: Check for always-blocked content types
  const blockedTypes = contentTypes.filter(ct => ALWAYS_BLOCKED_CONTENT_TYPES.includes(ct));
  if (blockedTypes.length > 0) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      humanApprovalRequired: true,
      allowed: false,
      reason: `Blocked content types present: ${blockedTypes.join(', ')}`,
      blockedContentTypes: blockedTypes,
      maskedContent: null,
      sanitized: false
    };
  }

  // Step 2: Auto-mask sensitive data
  const maskResult = autoMask({ content, targetProvider: provider, dryRun });

  // Step 3: Also mask the taskDescription
  const maskDesc = autoMask({ content: taskDescription, targetProvider: provider, dryRun });

  // Step 4: Evaluate handoff guard
  const allDetectedTypes = [
    ...maskResult.detectedTypes,
    ...maskDesc.detectedTypes,
    ...contentTypes
  ];
  const handoffEval = evaluateHandoff({
    targetProvider: provider,
    sanitized: true,
    contentTypes: allDetectedTypes
  });

  const sanitizationWarnings = [];
  if (maskResult.sensitiveDataFound) {
    sanitizationWarnings.push(`Auto-masked ${maskResult.maskCount} sensitive item(s): ${maskResult.detectedTypes.join(', ')}`);
  }
  if (maskDesc.sensitiveDataFound) {
    sanitizationWarnings.push(`Auto-masked ${maskDesc.maskCount} item(s) in taskDescription: ${maskDesc.detectedTypes.join(', ')}`);
  }

  const allowed = !handoffEval.blocked;

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired: true,
    allowed,
    targetProvider: provider,
    sanitized: true,
    maskedContent: maskResult.maskedContent,
    maskedTaskDescription: maskDesc.maskedContent,
    detectedSensitiveTypes: maskResult.detectedTypes,
    maskCount: maskResult.maskCount + maskDesc.maskCount,
    sanitizationWarnings,
    handoffEvaluation: handoffEval,
    finalDecisionAllowed: false,
    advisoryOnly: true,
    reason: allowed
      ? `Sanitized handoff to ${provider} approved (advisory-only, no final decision)`
      : `Handoff blocked: ${handoffEval.blockedReasons.join('; ')}`,
    supportedProviders: SUPPORTED_PROVIDERS,
    safeContentTypes: SAFE_AFTER_MASKING_CONTENT_TYPES
  };
}

function main() {
  const packet = buildHandoffPacket({
    targetProvider: 'deepseek',
    content: 'Error in module: api_key=sk-abc123, customer_id=cust-456. Stack trace follows.',
    contentTypes: ['anonymized_code_snippet'],
    taskDescription: 'Review this error for architectural issues. Contact support@kosame.ai if needed.',
    dryRun: true
  });
  console.log(JSON.stringify(packet, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PROVIDERS,
  ALWAYS_BLOCKED_CONTENT_TYPES,
  SAFE_AFTER_MASKING_CONTENT_TYPES,
  buildHandoffPacket
};
