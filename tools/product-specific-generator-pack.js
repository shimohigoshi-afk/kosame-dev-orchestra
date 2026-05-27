'use strict';

const TOOL_META = {
  version: '6.3.0',
  title: 'Product-specific Generator Pack',
  slug: 'product-specific-generator-pack'
};

const PRODUCT_CONFIGS = {
  sales_dx: {
    primaryProvider: 'claude',
    bulkProvider: 'gemini',
    breakthroughProvider: 'grok',
    defaultRiskLevel: 'medium',
    requiredVerifications: ['node --check', 'npm run verify', 'E2E smoke'],
    approvalRequired: true,
    notes: 'Sales DX workflows may contain customer interaction data — enforce Level A only for external providers.'
  },
  email_reply: {
    primaryProvider: 'claude',
    bulkProvider: 'gemini',
    breakthroughProvider: 'grok',
    defaultRiskLevel: 'medium',
    requiredVerifications: ['node --check', 'npm run verify', 'reply format check'],
    approvalRequired: true,
    notes: 'Email reply content must be sanitized before external dispatch — no customer names or PII.'
  },
  ai_bot: {
    primaryProvider: 'claude',
    bulkProvider: 'gemini',
    breakthroughProvider: 'grok',
    defaultRiskLevel: 'low',
    requiredVerifications: ['node --check', 'npm run verify', 'bot response smoke'],
    approvalRequired: true,
    notes: 'AI bot prompts must use Level A only — no customer session data.'
  },
  backoffice: {
    primaryProvider: 'claude',
    bulkProvider: 'gemini',
    breakthroughProvider: 'grok',
    defaultRiskLevel: 'low',
    requiredVerifications: ['node --check', 'npm run verify'],
    approvalRequired: true,
    notes: 'Backoffice tools are generally Level A/B safe — verify data classification before dispatch.'
  },
  anesty_board: {
    primaryProvider: 'kosame',
    bulkProvider: 'gemini',
    breakthroughProvider: 'grok',
    defaultRiskLevel: 'critical',
    requiredVerifications: ['node --check', 'npm run verify', 'ANESTY Board isolation check'],
    approvalRequired: true,
    notes: 'ANESTY Board is Level C — kosame internal only. Never dispatch to external providers.'
  },
  cloud_run_launch_pack: {
    primaryProvider: 'claude',
    bulkProvider: 'gemini',
    breakthroughProvider: 'kosame',
    defaultRiskLevel: 'high',
    requiredVerifications: ['node --check', 'npm run verify', 'deploy preflight'],
    approvalRequired: true,
    notes: 'Cloud Run launch packs involve deploy operations — all gated by Human Approval.'
  }
};

function getProductConfig(productLine) {
  return PRODUCT_CONFIGS[productLine] || PRODUCT_CONFIGS.backoffice;
}

function generateWorkBreakdown(productLine, taskGoal = '') {
  const config = getProductConfig(productLine);
  return {
    productLine,
    taskGoal,
    phases: [
      { phase: 'design',         owner: 'kosame',                      humanApprovalRequired: false },
      { phase: 'implementation', owner: config.primaryProvider,         humanApprovalRequired: true  },
      { phase: 'bulk_content',   owner: config.bulkProvider,           humanApprovalRequired: true  },
      { phase: 'breakthrough',   owner: config.breakthroughProvider,   humanApprovalRequired: true  },
      { phase: 'verify',         owner: 'cloudShell',                  humanApprovalRequired: true  },
      { phase: 'release',        owner: 'human',                       humanApprovalRequired: true  }
    ]
  };
}

function generateProviderAssignment(productLine, preferredProvider = null) {
  const config = getProductConfig(productLine);
  return {
    productLine,
    primary:      preferredProvider || config.primaryProvider,
    bulk:         config.bulkProvider,
    breakthrough: config.breakthroughProvider,
    execution:    'cloudShell',
    approval:     'human',
    pm:           'kosame'
  };
}

function generateVerificationPlan(productLine) {
  const config = getProductConfig(productLine);
  return {
    productLine,
    steps: config.requiredVerifications.map(step => ({ step, required: true })),
    humanApprovalRequired: true
  };
}

function generateForProduct(input = {}) {
  const productLine = input.productLine || 'backoffice';
  const taskGoal = input.taskGoal || '(task goal)';
  const preferredProvider = input.preferredProvider || null;
  const config = getProductConfig(productLine);

  return {
    productLine,
    config,
    workBreakdown: generateWorkBreakdown(productLine, taskGoal),
    providerAssignment: generateProviderAssignment(productLine, preferredProvider),
    verificationPlan: generateVerificationPlan(productLine),
    humanApprovalRequired: true
  };
}

function buildPacket(input = {}) {
  const generated = generateForProduct(input);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    supportedProductLines: Object.keys(PRODUCT_CONFIGS),
    productConfigs: PRODUCT_CONFIGS,
    generated
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    productLine: process.env.KOSAME_PRODUCT_LINE || 'backoffice',
    taskGoal: process.env.KOSAME_TASK_GOAL || 'implement feature X',
    preferredProvider: process.env.KOSAME_PREFERRED_PROVIDER || null
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_CONFIGS,
  getProductConfig,
  generateWorkBreakdown,
  generateProviderAssignment,
  generateVerificationPlan,
  generateForProduct,
  buildPacket
};
