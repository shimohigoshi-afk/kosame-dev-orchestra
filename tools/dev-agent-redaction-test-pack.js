'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Redaction Test Pack',
  slug: 'dev-agent-redaction-test-pack'
};

const SENSITIVE_TYPE_PATTERNS = {
  api_key:            /(?:api[_\-]?key|apikey)\s*[:=]\s*\S+/i,
  secret:             /(?:secret|password|passwd|pass)\s*[:=]\s*\S+/i,
  env_line:           /^\s*[A-Z_]+=.+$/m,
  token:              /(?:token|bearer|auth)\s*[:=]\s*\S+/i,
  github_credential:  /ghp_[A-Za-z0-9]{36}|github_pat_/i,
  email_address:      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  phone_number:       /(?:\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/,
  customer_data:      /customer[_\s]?data|client[_\s]?record|user[_\s]?pii/i,
  insurance_data:     /insurance|policy[_\s]?number|claim[_\s]?id/i,
  health_data:        /health[_\s]?data|medical|diagnosis|patient/i,
  billing_data:       /billing|credit[_\s]?card|card[_\s]?number|payment/i,
  contract_data:      /contract|nda|agreement[_\s]?signed/i,
  raw_log_identifier: /\b(internal[_\s]?ip|prod[_\s]?server|db[_\s]?host)\s*[:=]/i,
  unpublished_strategy: /unpublished[_\s]?strategy|confidential[_\s]?roadmap/i
};

const ALLOWED_CONTENT_TYPES = [
  'abstracted_error_summary',
  'anonymized_code_snippet',
  'pseudocode',
  'generic_architecture_question',
  'public_library_behavior_question'
];

const DENIED_CONTENT_TYPES = [
  'api_key', 'secret', 'env_line', 'token', 'github_credential',
  'email_address', 'phone_number', 'customer_data', 'insurance_data',
  'health_data', 'billing_data', 'contract_data', 'raw_log_identifier',
  'unpublished_strategy'
];

const EXTERNAL_RISK_PROVIDERS = ['deepseek', 'kimi'];

function runRedactionTest(input) {
  const {
    targetProvider = '',
    content        = '',
    contentTypes   = [],
    sanitized      = false
  } = input || {};

  const provider        = targetProvider.toLowerCase();
  const isExternalRisk  = EXTERNAL_RISK_PROVIDERS.includes(provider);
  const detected        = detectSensitiveTypes(content, contentTypes);
  const blockedReasons  = [];

  if (detected.length > 0) {
    blockedReasons.push(`sensitive content detected: ${detected.join(', ')}`);
  }
  if (isExternalRisk && !sanitized) {
    blockedReasons.push(`unsanitized handoff to external risk provider: ${provider}`);
  }
  if (isExternalRisk && detected.length > 0) {
    blockedReasons.push(`external provider cannot receive sensitive types: ${detected.join(', ')}`);
  }

  const redactionPassed = blockedReasons.length === 0;

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    redactionPassed,
    sanitized: redactionPassed ? sanitized : false,
    detectedSensitiveTypes: detected,
    redactedFields: DENIED_CONTENT_TYPES,
    blockedReasons,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
    deniedContentTypes: DENIED_CONTENT_TYPES,
    targetProvider,
    finalDecisionAllowed: !isExternalRisk,
    humanApprovalRequired: isExternalRisk || !redactionPassed
  };
}

function detectSensitiveTypes(content, declaredTypes) {
  const found = new Set(declaredTypes.filter(t => DENIED_CONTENT_TYPES.includes(t)));
  if (content) {
    for (const [type, pattern] of Object.entries(SENSITIVE_TYPE_PATTERNS)) {
      if (pattern.test(content)) found.add(type);
    }
  }
  return Array.from(found);
}

function main() {
  const result = runRedactionTest({
    targetProvider: 'deepseek',
    content: 'API_KEY=abc123secret',
    sanitized: false
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SENSITIVE_TYPE_PATTERNS,
  ALLOWED_CONTENT_TYPES,
  DENIED_CONTENT_TYPES,
  EXTERNAL_RISK_PROVIDERS,
  runRedactionTest,
  detectSensitiveTypes
};
