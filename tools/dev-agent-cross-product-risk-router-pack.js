'use strict';

const TOOL_META = {
  version: '58.0.0',
  title:   'KOSAME Dev Orchestra Cross-Product Risk Router Pack',
  slug:    'dev-agent-cross-product-risk-router-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const ROUTES = {
  CLAUDE_CODE:         'CLAUDE_CODE',
  GEMINI_REVIEW:       'GEMINI_REVIEW',
  GROK_REVIEW:         'GROK_REVIEW',
  KOSAME_PM:           'KOSAME_PM',
  HUMAN_APPROVAL:      'HUMAN_APPROVAL',
  EXTERNAL_SE_REVIEW:  'EXTERNAL_SE_REVIEW',
  HOLD:                'HOLD'
};

function routeRequest(req) {
  req = req || {};
  const reasons    = [];
  const approvals  = [];
  const routes     = [];

  // Hard blocks → HUMAN_APPROVAL or HOLD
  if (req.secretAccess === true) {
    routes.push(ROUTES.HUMAN_APPROVAL);
    reasons.push('Secret access requires Human approval');
    approvals.push('Human / Junya');
  }
  if (req.deployRequired === true) {
    routes.push(ROUTES.HUMAN_APPROVAL);
    if (req.productionImpact === 'high' || req.productionImpact === 'critical') {
      routes.push(ROUTES.EXTERNAL_SE_REVIEW);
      reasons.push('Deploy with high production impact requires External SE review');
    } else {
      reasons.push('Deploy requires Human approval');
    }
    approvals.push('Human / Junya');
  }
  if (req.customerDataAccess === true) {
    routes.push(ROUTES.KOSAME_PM);
    routes.push(ROUTES.HUMAN_APPROVAL);
    reasons.push('Customer data access requires KOSAME/GPT PM review + Human approval');
    approvals.push('KOSAME / GPT', 'Human / Junya');
  }
  if (req.insuranceDataAccess === true) {
    routes.push(ROUTES.KOSAME_PM);
    routes.push(ROUTES.HUMAN_APPROVAL);
    routes.push(ROUTES.EXTERNAL_SE_REVIEW);
    reasons.push('Insurance data access requires KOSAME/GPT + Human + External SE review');
    approvals.push('KOSAME / GPT', 'Human / Junya', 'External SE');
  }

  // Low confidence + high risk → HOLD
  if (req.confidence === 'low' && (req.dataSensitivity === 'high' || req.dataSensitivity === 'critical' || req.productionImpact === 'high' || req.productionImpact === 'critical')) {
    routes.push(ROUTES.HOLD);
    reasons.push('Low confidence + high risk: route to HOLD for human review');
  }

  // If already routed to gates, return
  if (routes.length > 0) {
    const primaryRoute = routes.includes(ROUTES.HOLD) ? ROUTES.HOLD
      : routes.includes(ROUTES.EXTERNAL_SE_REVIEW) ? ROUTES.EXTERNAL_SE_REVIEW
      : routes.includes(ROUTES.HUMAN_APPROVAL) ? ROUTES.HUMAN_APPROVAL
      : routes[0];

    return {
      assignedRoute:           primaryRoute,
      additionalRoutes:        [...new Set(routes.filter(r => r !== primaryRoute))],
      routeReason:             [...new Set(reasons)],
      requiredApprovals:       [...new Set(approvals)],
      externalReviewRecommended: routes.includes(ROUTES.EXTERNAL_SE_REVIEW),
      blockerItems:            reasons.filter(r => r.toLowerCase().includes('block') || r.toLowerCase().includes('hold')),
      allowedFiles:            [],
      forbiddenFiles:          ['.env', 'secrets/**', 'credentials/**'],
      allowedCommands:         ['git status --short', 'git log --oneline -5'],
      forbiddenCommands:       ['git add', 'git commit', 'git push', 'git tag', 'deploy', 'rm -rf', 'cat .env']
    };
  }

  // Safe routes — no gates triggered
  // Long text / log review → Gemini
  if (req.taskType === 'long_text_review' || req.taskType === 'log_review' || req.taskType === 'bulk_summarization') {
    return makeRoute(ROUTES.GEMINI_REVIEW, 'Long text / log review is best handled by Gemini', req);
  }

  // Breakthrough / alternative proposal → Grok
  if (req.taskType === 'breakthrough_proposal' || req.taskType === 'alternative_approach' || req.taskType === 'research_review') {
    return makeRoute(ROUTES.GROK_REVIEW, 'Breakthrough / alternative proposal is best handled by Grok', req);
  }

  // Docs / smoke / fixture only → Claude Code
  if (['docs_update', 'smoke_addition', 'fixture_addition', 'readme_update', 'runbook_update', 'tool_addition'].includes(req.taskType)) {
    return makeRoute(ROUTES.CLAUDE_CODE, 'Docs / smoke / fixture tasks are safe for Claude Code', req);
  }

  // Default safe → Claude Code
  return makeRoute(ROUTES.CLAUDE_CODE, 'Default safe route: Claude Code', req);
}

function makeRoute(route, reason, req) {
  return {
    assignedRoute:            route,
    additionalRoutes:         [],
    routeReason:              [reason],
    requiredApprovals:        route === ROUTES.HUMAN_APPROVAL ? ['Human / Junya'] : [],
    externalReviewRecommended: route === ROUTES.EXTERNAL_SE_REVIEW,
    blockerItems:             [],
    allowedFiles:             req.taskType && ['docs_update', 'smoke_addition', 'fixture_addition'].includes(req.taskType)
      ? ['docs/**/*.md', 'smoke/*.js', 'fixtures/*.json', 'tools/*.js', 'package.json']
      : [],
    forbiddenFiles:           ['.env', 'secrets/**', 'credentials/**'],
    allowedCommands:          ['node --check', 'npm run verify', 'git status --short'],
    forbiddenCommands:        ['git add', 'git commit', 'git push', 'git tag', 'deploy', 'rm -rf', 'cat .env']
  };
}

function buildRiskRouter(opts) {
  opts = opts || {};
  const now      = opts.timestamp || Date.now();
  const routerId = `risk-router-${now}`;
  const routeResult = routeRequest(opts.request || {});

  return {
    routerId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    request:               opts.request || {},
    ...routeResult,
    nextAction: buildNextAction(routeResult),
    generatedAt: new Date(now).toISOString()
  };
}

function buildNextAction(routeResult) {
  switch (routeResult.assignedRoute) {
    case ROUTES.CLAUDE_CODE:        return 'Claude Codeへ controlled task を投入する';
    case ROUTES.GEMINI_REVIEW:      return 'Geminiへ長文レビュー / bulk summarization を依頼する';
    case ROUTES.GROK_REVIEW:        return 'Grokへ research / alternative proposal を依頼する';
    case ROUTES.KOSAME_PM:          return 'こさめ/GPTがPM判断を行う';
    case ROUTES.HUMAN_APPROVAL:     return 'じゅんやさんの承認を待つ';
    case ROUTES.EXTERNAL_SE_REVIEW: return '外部SEレビューを依頼する';
    case ROUTES.HOLD:               return 'HOLDに入れてじゅんやさんへエスカレーション';
    default:                        return 'こさめ/GPTに確認する';
  }
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  ROUTES,
  routeRequest,
  buildRiskRouter
};

if (require.main === module) {
  // Demo: docs only
  console.log('--- docs_update ---');
  console.log(JSON.stringify(buildRiskRouter({ request: { taskType: 'docs_update' } }), null, 2));
}
