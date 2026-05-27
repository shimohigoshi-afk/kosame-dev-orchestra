'use strict';

const TOOL_META = {
  version: '5.7.0',
  title: 'Cross-Provider Handoff Packet',
  slug: 'cross-provider-handoff-packet-pack'
};

const HANDOFF_RULES = {
  requiredFields: ['fromProvider', 'toProvider', 'taskSummary', 'dataLevel', 'completedSteps', 'remainingSteps'],
  blockedForExternal: ['.env', 'API key', 'Secret', 'customer data', 'insurance policy', 'health check', 'personal name'],
  externalProviders: ['claude', 'gemini', 'grok', 'deepseek', 'kimi']
};

function validateHandoff(packet = {}) {
  const missing = HANDOFF_RULES.requiredFields.filter(f => !(f in packet));
  if (missing.length > 0) {
    return { valid: false, reason: `missing fields: ${missing.join(', ')}` };
  }

  const isExternal = HANDOFF_RULES.externalProviders.includes(packet.toProvider);
  if (isExternal && packet.dataLevel === 'C') {
    return { valid: false, reason: 'data level C cannot be handed off to external provider' };
  }

  const summary = (packet.taskSummary || '').toLowerCase();
  const blocked = HANDOFF_RULES.blockedForExternal.filter(kw => summary.includes(kw.toLowerCase()));
  if (isExternal && blocked.length > 0) {
    return { valid: false, reason: `blocked content detected: ${blocked.join(', ')}` };
  }

  return { valid: true, reason: 'handoff packet is valid' };
}

function createHandoff(input = {}) {
  const packet = {
    fromProvider: input.fromProvider || 'kosame',
    toProvider: input.toProvider || 'claude',
    taskSummary: input.taskSummary || '(task summary)',
    dataLevel: input.dataLevel || 'A',
    completedSteps: input.completedSteps || [],
    remainingSteps: input.remainingSteps || [],
    handoffAt: new Date().toISOString(),
    humanApprovalRequired: true
  };
  const validation = validateHandoff(packet);
  return { packet, validation };
}

function buildPacket(input = {}) {
  const { packet, validation } = createHandoff(input);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    handoffRules: HANDOFF_RULES,
    packet,
    validation
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    fromProvider: process.env.KOSAME_FROM_PROVIDER || 'kosame',
    toProvider: process.env.KOSAME_TO_PROVIDER || 'claude',
    taskSummary: process.env.KOSAME_TASK_SUMMARY || 'implement feature X',
    dataLevel: process.env.KOSAME_DATA_LEVEL || 'A',
    completedSteps: ['design', 'review'],
    remainingSteps: ['implementation', 'verify']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  HANDOFF_RULES,
  validateHandoff,
  createHandoff,
  buildPacket
};
