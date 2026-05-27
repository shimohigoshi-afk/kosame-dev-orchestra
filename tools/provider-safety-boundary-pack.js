'use strict';

const TOOL_META = {
  version: '5.2.0',
  title: 'Provider Safety Boundary Pack',
  slug: 'provider-safety-boundary-pack'
};

const SAFETY_BOUNDARIES = {
  kosame:     { allowedDataLevels: ['A', 'B', 'C'], allowsSecrets: false, allowsCustomerData: true,  requiresApproval: false },
  claude:     { allowedDataLevels: ['A', 'B'],       allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  gemini:     { allowedDataLevels: ['A'],             allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  grok:       { allowedDataLevels: ['A'],             allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  deepseek:   { allowedDataLevels: ['A'],             allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  kimi:       { allowedDataLevels: ['A'],             allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  cloudShell: { allowedDataLevels: ['A', 'B'],       allowsSecrets: false, allowsCustomerData: false, requiresApproval: true  },
  human:      { allowedDataLevels: ['A', 'B', 'C'], allowsSecrets: true,  allowsCustomerData: true,  requiresApproval: false }
};

const BLOCKED_INPUTS = ['.env', 'API key', 'Secret', 'customer data', 'insurance policy', 'health check details', 'contracts'];

function checkSafety(provider, dataLevel, inputSummary = '') {
  const boundary = SAFETY_BOUNDARIES[provider];
  if (!boundary) {
    return { safe: false, reason: 'unknown provider', humanApprovalRequired: true };
  }
  if (!boundary.allowedDataLevels.includes(dataLevel)) {
    return { safe: false, reason: `data level ${dataLevel} not allowed for ${provider}`, humanApprovalRequired: true };
  }
  const blocked = BLOCKED_INPUTS.filter(kw => inputSummary.toLowerCase().includes(kw.toLowerCase()));
  if (blocked.length > 0) {
    return { safe: false, reason: `blocked input detected: ${blocked.join(', ')}`, humanApprovalRequired: true };
  }
  return { safe: true, reason: 'within boundary', humanApprovalRequired: boundary.requiresApproval };
}

function buildPacket(input = {}) {
  const provider = input.provider || 'gemini';
  const dataLevel = input.dataLevel || 'A';
  const inputSummary = input.inputSummary || '';
  const safetyCheck = checkSafety(provider, dataLevel, inputSummary);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    safetyBoundaries: SAFETY_BOUNDARIES,
    blockedInputs: BLOCKED_INPUTS,
    safetyCheck
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    provider: process.env.KOSAME_PROVIDER || 'gemini',
    dataLevel: process.env.KOSAME_DATA_LEVEL || 'A',
    inputSummary: process.env.KOSAME_INPUT_SUMMARY || ''
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SAFETY_BOUNDARIES,
  BLOCKED_INPUTS,
  checkSafety,
  buildPacket
};
