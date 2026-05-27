'use strict';

const TOOL_META = {
  version: '5.1.0',
  title: 'Provider Pool Policy Pack',
  slug: 'provider-pool-policy-pack'
};

const PROVIDER_POOL = {
  primary: ['kosame', 'claude', 'gemini'],
  secondary: ['grok', 'deepseek', 'kimi'],
  execution: ['cloudShell'],
  approval: ['human']
};

const POOL_POLICY = {
  maxConcurrentExternal: 2,
  requiresHumanApprovalTiers: ['execution', 'approval'],
  externalProviders: ['gemini', 'claude', 'grok', 'deepseek', 'kimi'],
  internalProviders: ['kosame', 'cloudShell', 'human']
};

function getPool(tier) {
  return PROVIDER_POOL[tier] || [];
}

function evaluatePool(providers = []) {
  const external = providers.filter(p => POOL_POLICY.externalProviders.includes(p));
  const internal = providers.filter(p => POOL_POLICY.internalProviders.includes(p));
  const exceedsLimit = external.length > POOL_POLICY.maxConcurrentExternal;
  return {
    external,
    internal,
    exceedsLimit,
    compliant: !exceedsLimit,
    humanApprovalRequired: true
  };
}

function buildPacket(input = {}) {
  const providers = input.providers || PROVIDER_POOL.primary;
  const evaluation = evaluatePool(providers);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    providerPool: PROVIDER_POOL,
    poolPolicy: POOL_POLICY,
    evaluation
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    providers: (process.env.KOSAME_PROVIDERS || 'kosame,claude,gemini').split(',')
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PROVIDER_POOL,
  POOL_POLICY,
  getPool,
  evaluatePool,
  buildPacket
};
