'use strict';

const TOOL_META = {
  version: '109.0.0',
  title: 'KOSAME Dev Orchestra Product Expansion Roadmap Pack',
  slug: 'dev-agent-product-expansion-roadmap-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'insurance data read', 'PDF data read',
  'real send', 'real billing', 'deploy without approval',
  'git push/tag without approval', 'secret read', '.env read', 'destructive delete'
];

const PRODUCTS_ROADMAP = {
  anesty_board: {
    currentStatus: 'PILOT_CANDIDATE',
    dataRisk: 'low',
    pilotReadiness: 'HIGH',
    holdReason: null,
    nextPhase: 'Pilot execution → limited production',
    expansionGoal: 'Task management OS for KOSAME internal team',
    timeline: 'near_term',
    blockers: []
  },
  email_reply_bot: {
    currentStatus: 'DRAFT_ONLY_SAFE',
    dataRisk: 'medium',
    pilotReadiness: 'MEDIUM',
    holdReason: 'Gmail/real send boundary requires explicit clearance',
    nextPhase: 'Draft-only pilot → Gmail integration with Guardian gate',
    expansionGoal: 'Automated email draft generation for business ops',
    timeline: 'medium_term',
    blockers: ['Gmail boundary sign-off required']
  },
  backoffice_agent: {
    currentStatus: 'HOLD',
    dataRisk: 'medium',
    pilotReadiness: 'LOW',
    holdReason: 'Broader scope review and data boundary definition pending',
    nextPhase: 'Scope definition → Guardian review → limited pilot',
    expansionGoal: 'Internal business process automation',
    timeline: 'medium_term',
    blockers: ['scope definition', 'data boundary review']
  },
  sales_dx: {
    currentStatus: 'HOLD_DATA_SENSITIVE',
    dataRisk: 'high',
    pilotReadiness: 'BLOCKED',
    holdReason: 'Real customer/insurance/Gmail/PDF data boundary not cleared',
    nextPhase: 'Data boundary legal/privacy review → security review → limited pilot',
    expansionGoal: 'Sales process DX with AI-assisted outreach',
    timeline: 'long_term',
    blockers: ['insurance data boundary', 'Gmail data boundary', 'PDF data boundary', 'legal/privacy review']
  },
  cloud_run_pm_agent: {
    currentStatus: 'INFRASTRUCTURE_READY',
    dataRisk: 'low',
    pilotReadiness: 'MEDIUM',
    holdReason: 'PM orchestration layer needs production validation',
    nextPhase: 'PM layer validation → production deployment pipeline',
    expansionGoal: 'AI-driven project management automation on Cloud Run',
    timeline: 'medium_term',
    blockers: ['production validation']
  },
  kosame_dev_orchestra: {
    currentStatus: 'V1_COMPLETION_PATH',
    dataRisk: 'low',
    pilotReadiness: 'HIGH',
    holdReason: null,
    nextPhase: 'v1.0 complete → external adoption → multi-team OS',
    expansionGoal: 'AI development team OS used by multiple KOSAME products and external clients',
    timeline: 'near_term',
    blockers: []
  }
};

function buildProductExpansionRoadmap(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `product-expansion-roadmap-${now}`;

  const roadmap = Object.entries(PRODUCTS_ROADMAP).map(([product, info]) => ({
    product,
    ...info,
    safeForImmediatePilot: info.pilotReadiness === 'HIGH' && info.blockers.length === 0,
    dataSensitiveHold: info.dataRisk === 'high' || info.currentStatus.includes('HOLD')
  }));

  const summary = {
    total: roadmap.length,
    pilotReady: roadmap.filter(r => r.safeForImmediatePilot).map(r => r.product),
    dataSensitiveHold: roadmap.filter(r => r.dataSensitiveHold).map(r => r.product),
    mediumTerm: roadmap.filter(r => r.timeline === 'medium_term').map(r => r.product),
    longTerm: roadmap.filter(r => r.timeline === 'long_term').map(r => r.product)
  };

  return {
    productExpansionRoadmapId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    roadmap,
    summary,
    productsRoadmap: PRODUCTS_ROADMAP,

    expansionPrinciple: 'Expand low-risk products first. HOLD data-sensitive products until boundary is cleared.',

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['roadmap execution for each product', 'data boundary expansion', 'production deployment'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Roadmap is plan-only. Each product expansion requires individual Junya approval gate.'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  PRODUCTS_ROADMAP, buildProductExpansionRoadmap
};

if (require.main === module) {
  const r = buildProductExpansionRoadmap({});
  console.log(JSON.stringify({ pilotReady: r.summary.pilotReady, dataSensitiveHold: r.summary.dataSensitiveHold }, null, 2));
}
