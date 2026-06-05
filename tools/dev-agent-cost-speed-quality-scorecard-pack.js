'use strict';

const TOOL_META = {
  version: '108.0.0',
  title: 'KOSAME Dev Orchestra Cost/Speed/Quality Scorecard Pack',
  slug: 'dev-agent-cost-speed-quality-scorecard-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real billing without approval', 'secret read', '.env read', 'deploy without approval',
  'real customer data read', 'destructive delete', 'real send'
];

const OPERATING_PRINCIPLE = 'Guard only irreversible danger zones; move fast everywhere else.';

const ROUTES = [
  {
    route: 'ClaudeCode_implementation',
    cost: 'medium',
    speed: 'fast',
    quality: 'high',
    risk: 'low',
    humanBurden: 'low',
    maintainability: 'high',
    bestFor: 'file edits, smoke tests, verification, docs'
  },
  {
    route: 'GPTAgent_PM',
    cost: 'medium',
    speed: 'medium',
    quality: 'high',
    risk: 'low',
    humanBurden: 'low',
    maintainability: 'medium',
    bestFor: 'planning, PM decisions, design review, work order building'
  },
  {
    route: 'Gemini_bulk',
    cost: 'low',
    speed: 'fast',
    quality: 'medium',
    risk: 'low',
    humanBurden: 'low',
    maintainability: 'medium',
    bestFor: 'bulk reading, doc summarization, large codebase review'
  },
  {
    route: 'Grok_adversarial',
    cost: 'medium',
    speed: 'medium',
    quality: 'high',
    risk: 'low',
    humanBurden: 'low',
    maintainability: 'low',
    bestFor: 'weakness detection, breakthrough review, red team'
  },
  {
    route: 'LightweightModel',
    cost: 'low',
    speed: 'very_fast',
    quality: 'medium',
    risk: 'low',
    humanBurden: 'low',
    maintainability: 'medium',
    bestFor: 'simple classification, routing decisions, low-stakes tasks'
  },
  {
    route: 'Human_approval_only',
    cost: 'zero_ai_cost',
    speed: 'slowest',
    quality: 'highest',
    risk: 'critical_gate',
    humanBurden: 'high',
    maintainability: 'N/A',
    bestFor: 'deploy, push, tag, billing, secret access, real send — irreversible only'
  }
];

function scoreRoute(route, weights) {
  weights = weights || { cost: 1, speed: 1, quality: 1, risk: 1, humanBurden: 1, maintainability: 1 };
  const scoreMap = { low: 3, medium: 2, high: 1, very_fast: 4, fast: 3, slow: 1, slowest: 0,
    zero_ai_cost: 4, highest: 4, 'N/A': 2, critical_gate: 0 };
  const costScore = scoreMap[route.cost] || 2;
  const speedScore = scoreMap[route.speed] || 2;
  const qualityScore = { low: 1, medium: 2, high: 3, highest: 4 }[route.quality] || 2;
  return { route: route.route, score: costScore + speedScore + qualityScore, bestFor: route.bestFor };
}

function buildCostSpeedQualityScorecard(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `cost-speed-quality-scorecard-${now}`;

  const scoredRoutes = ROUTES.map(r => scoreRoute(r, opts.weights));
  const recommended = scoredRoutes.reduce((best, r) => r.score > best.score ? r : best, scoredRoutes[0]);

  return {
    costSpeedQualityScorecardId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    operatingPrinciple: OPERATING_PRINCIPLE,
    routes: ROUTES,
    scoredRoutes,
    recommendedRoute: recommended,

    routingGuidance: {
      defaultImplementation: 'ClaudeCode_implementation',
      planningDesign: 'GPTAgent_PM',
      bulkReview: 'Gemini_bulk',
      adversarialReview: 'Grok_adversarial',
      simpleClassification: 'LightweightModel',
      irreversibleActions: 'Human_approval_only'
    },

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['route selection for high-cost tasks', 'budget approval for model usage'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Scorecard is planning-only. Model selection within approved routes is AI-autonomous.'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  OPERATING_PRINCIPLE, ROUTES,
  buildCostSpeedQualityScorecard
};

if (require.main === module) {
  const r = buildCostSpeedQualityScorecard({});
  console.log(JSON.stringify({ recommended: r.recommendedRoute, principle: r.operatingPrinciple }, null, 2));
}
