'use strict';

const TOOL_META = {
  version: '103.0.0',
  title: 'KOSAME Dev Orchestra Product Feedback Capture Pack',
  slug: 'dev-agent-product-feedback-capture-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'PDF data read', 'insurance data read',
  'secret read', '.env read', 'deploy', 'git add/commit/push/tag',
  'real send', 'real billing', 'destructive delete'
];

const FEEDBACK_CATEGORIES = [
  'usability',
  'performance',
  'reliability',
  'feature_gap',
  'security_concern',
  'data_boundary_issue',
  'pmf_signal',
  'revenue_signal',
  'operational_friction',
  'guardian_issue'
];

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

function buildProductFeedbackCapture(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `product-feedback-capture-${now}`;

  const feedbackItems = opts.feedbackItems || [
    {
      product: 'anesty_board',
      category: 'usability',
      severity: 'medium',
      description: 'Task board display needs clearer status labels',
      productImpact: 'reduces pilot adoption friction',
      revisionSuggestion: 'Add status badge component with color coding',
      pmfSignal: 'positive — users want cleaner UI',
      revenueSignal: 'neutral',
      dataFromRealCustomers: false
    }
  ];

  // Enforce no real customer data in feedback
  const sanitizedItems = feedbackItems.map(item => ({
    ...item,
    dataFromRealCustomers: false,
    sanitized: true
  }));

  const summary = {
    totalItems: sanitizedItems.length,
    bySeverity: SEVERITY_LEVELS.reduce((acc, s) => {
      acc[s] = sanitizedItems.filter(i => i.severity === s).length;
      return acc;
    }, {}),
    byCategory: FEEDBACK_CATEGORIES.reduce((acc, c) => {
      acc[c] = sanitizedItems.filter(i => i.category === c).length;
      return acc;
    }, {}),
    pmfSignals: sanitizedItems.filter(i => i.pmfSignal && i.pmfSignal !== 'neutral').map(i => ({
      product: i.product, signal: i.pmfSignal
    })),
    revenueSignals: sanitizedItems.filter(i => i.revenueSignal && i.revenueSignal !== 'neutral').map(i => ({
      product: i.product, signal: i.revenueSignal
    }))
  };

  return {
    productFeedbackCaptureId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    feedbackCategories: FEEDBACK_CATEGORIES,
    severityLevels: SEVERITY_LEVELS,
    feedbackItems: sanitizedItems,
    summary,

    dataPolicy: {
      realCustomerDataAllowed: false,
      realGmailDataAllowed: false,
      realInsuranceDataAllowed: false,
      feedbackSourceAllowed: ['dry-run outputs', 'mock testing', 'internal review', 'approved pilot notes']
    },

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['feedback-driven scope expansion', 'real pilot data access'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Feedback capture must not include real customer data. All items sanitized.'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  FEEDBACK_CATEGORIES, SEVERITY_LEVELS,
  buildProductFeedbackCapture
};

if (require.main === module) {
  const r = buildProductFeedbackCapture({});
  console.log(JSON.stringify({ totalItems: r.summary.totalItems, pmfSignals: r.summary.pmfSignals }, null, 2));
}
