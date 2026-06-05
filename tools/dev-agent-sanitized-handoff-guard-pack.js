'use strict';

const TOOL_META = {
  version: '110.1.0',
  title: 'Sanitized Handoff Guard Pack',
  slug: 'dev-agent-sanitized-handoff-guard-pack'
};

// Providers that require strict sanitization before any handoff
const EXTERNAL_RISK_PROVIDERS = ['deepseek', 'kimi'];

// Fields that must be removed / abstracted before external handoff
const REQUIRED_REDACT_FIELDS = [
  'apiKeys', 'secrets', 'envContent', 'customerData', 'insuranceData',
  'healthData', 'personalNames', 'emailAddresses', 'phoneNumbers',
  'addresses', 'contractContent', 'billingDetails', 'revenueDetails',
  'companyStrategy', 'rawLogs', 'githubTokens', 'deployCredentials'
];

const ALLOWED_CONTENT_TYPES = [
  'abstractedErrorSummary',
  'generalizedArchitectureQuestion',
  'anonymizedCodeSnippet',
  'nonSensitivePseudoCode',
  'genericRefactorQuestion',
  'publicLibraryBehaviorQuestion'
];

const DENIED_CONTENT_TYPES = [
  'apiKey', 'secret', 'envFile', 'customerData', 'insuranceData',
  'healthData', 'personalName', 'emailAddress', 'phoneNumber',
  'address', 'contractContent', 'billingDetail', 'exactRevenueFigure',
  'unpublishedStrategy', 'rawLog', 'deployCredential'
];

function evaluateHandoff(input) {
  const {
    targetProvider = '',
    sanitized = false,
    contentTypes = []
  } = input || {};

  const provider     = targetProvider.toLowerCase();
  const isExternalRisk = EXTERNAL_RISK_PROVIDERS.includes(provider);
  const deniedFound  = contentTypes.filter(ct => DENIED_CONTENT_TYPES.includes(ct));

  const blockedReasons = [];
  if (isExternalRisk && !sanitized) {
    blockedReasons.push('sanitized:false — handoff to external/China-associated provider is blocked');
  }
  if (deniedFound.length > 0) {
    blockedReasons.push(`denied content types present: ${deniedFound.join(', ')}`);
  }

  const blocked = isExternalRisk && (blockedReasons.length > 0);

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    targetProvider,
    sanitized,
    blocked,
    blockedReasons,
    redactedFields: REQUIRED_REDACT_FIELDS,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
    deniedContentTypes: DENIED_CONTENT_TYPES,
    finalDecisionAllowed: false,
    humanApprovalRequired: isExternalRisk
  };
}

function main() {
  const result = evaluateHandoff({
    targetProvider: 'deepseek',
    sanitized: false,
    contentTypes: ['apiKey', 'customerData']
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  EXTERNAL_RISK_PROVIDERS,
  REQUIRED_REDACT_FIELDS,
  ALLOWED_CONTENT_TYPES,
  DENIED_CONTENT_TYPES,
  evaluateHandoff
};
