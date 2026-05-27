'use strict';

const TOOL_META = {
  version: '5.3.0',
  title: 'Fallback Routing Decision Pack',
  slug: 'fallback-routing-decision-pack'
};

const FALLBACK_CHAINS = {
  claude:   ['grok', 'deepseek', 'kosame'],
  gemini:   ['grok', 'kimi', 'kosame'],
  grok:     ['claude', 'deepseek', 'kosame'],
  deepseek: ['claude', 'grok', 'kosame'],
  kimi:     ['gemini', 'grok', 'kosame'],
  kosame:   ['human']
};

const FALLBACK_POLICY = {
  maxFallbackDepth: 2,
  alwaysHumanApprovalRequired: true,
  finalFallback: 'kosame',
  blockedFallbacks: ['Secret value read', '.env value read', 'API key value read']
};

function getFallbackChain(provider) {
  return FALLBACK_CHAINS[provider] || [FALLBACK_POLICY.finalFallback];
}

function decideFallback(primary, providerStatus = {}, depth = 0) {
  if (depth >= FALLBACK_POLICY.maxFallbackDepth) {
    return { provider: FALLBACK_POLICY.finalFallback, route: 'final-fallback', depth, humanApprovalRequired: true };
  }
  if (providerStatus[primary] !== 'down') {
    return { provider: primary, route: 'primary', depth, humanApprovalRequired: true };
  }
  const chain = getFallbackChain(primary);
  for (const candidate of chain) {
    if (providerStatus[candidate] !== 'down') {
      return { provider: candidate, route: `fallback-depth-${depth + 1}`, depth: depth + 1, humanApprovalRequired: true };
    }
  }
  return { provider: FALLBACK_POLICY.finalFallback, route: 'final-fallback', depth: depth + 1, humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const primary = input.primary || 'gemini';
  const providerStatus = input.providerStatus || {};
  const decision = decideFallback(primary, providerStatus);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    fallbackChains: FALLBACK_CHAINS,
    fallbackPolicy: FALLBACK_POLICY,
    decision
  };
}

function main() {
  const providerStatus = {
    gemini: process.env.KOSAME_GEMINI_STATUS || 'up',
    claude: process.env.KOSAME_CLAUDE_STATUS || 'up',
    grok: process.env.KOSAME_GROK_STATUS || 'up'
  };
  console.log(JSON.stringify(buildPacket({
    primary: process.env.KOSAME_PRIMARY_PROVIDER || 'gemini',
    providerStatus
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  FALLBACK_CHAINS,
  FALLBACK_POLICY,
  getFallbackChain,
  decideFallback,
  buildPacket
};
