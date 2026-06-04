'use strict';

const TOOL_META = {
  version: '59.0.0',
  title:   'KOSAME Dev Orchestra Release Train Planner Pack',
  slug:    'dev-agent-release-train-planner-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const LANES = {
  NOW:              'now',
  NEXT:             'next',
  HOLD:             'hold',
  EXTERNAL_REVIEW:  'external_review',
  PRODUCTION_GATE:  'production_gate'
};

const DEFAULT_CANDIDATES = [
  {
    productId:             'kosame_dev_orchestra',
    targetVersion:         'v60.0.0',
    releaseType:           'minor',
    priority:              'high',
    readiness:             'ready',
    dependencies:          [],
    blockers:              [],
    riskLevel:             'low',
    recommendedWindow:     'now',
    goNoGoRequired:        false,
    externalReviewRequired: false,
    productionImpact:      false,
    taskTypeOnly:          'docs_smoke_tools'
  },
  {
    productId:             'anesty_board',
    targetVersion:         'next-controlled-task',
    releaseType:           'controlled_task',
    priority:              'high',
    readiness:             'ready',
    dependencies:          ['kosame_dev_orchestra v56+'],
    blockers:              [],
    riskLevel:             'low',
    recommendedWindow:     'next',
    goNoGoRequired:        false,
    externalReviewRequired: false,
    productionImpact:      false,
    taskTypeOnly:          'docs_smoke'
  },
  {
    productId:             'cloud_run_pm_agent',
    targetVersion:         'runtime-monitoring',
    releaseType:           'ops_update',
    priority:              'medium',
    readiness:             'pending_review',
    dependencies:          ['IAM review'],
    blockers:              ['External SE IAM review pending'],
    riskLevel:             'high',
    recommendedWindow:     'external_review',
    goNoGoRequired:        true,
    externalReviewRequired: true,
    productionImpact:      true,
    taskTypeOnly:          null
  },
  {
    productId:             'sales_dx',
    targetVersion:         'v1.0-design',
    releaseType:           'design',
    priority:              'high',
    readiness:             'planning',
    dependencies:          ['Customer data boundary definition', 'External SE review'],
    blockers:              ['Customer/insurance data boundary not yet defined'],
    riskLevel:             'critical',
    recommendedWindow:     'hold',
    goNoGoRequired:        true,
    externalReviewRequired: true,
    productionImpact:      true,
    taskTypeOnly:          null
  },
  {
    productId:             'backoffice_agent',
    targetVersion:         'v1.0-design',
    releaseType:           'design',
    priority:              'medium',
    readiness:             'planning',
    dependencies:          ['Legal/accounting boundary definition'],
    blockers:              ['Legal / accounting boundary not yet defined'],
    riskLevel:             'high',
    recommendedWindow:     'hold',
    goNoGoRequired:        true,
    externalReviewRequired: true,
    productionImpact:      false,
    taskTypeOnly:          null
  },
  {
    productId:             'email_reply_bot',
    targetVersion:         'v1.0-design',
    releaseType:           'design',
    priority:              'medium',
    readiness:             'planning',
    dependencies:          ['Gmail API send gate definition'],
    blockers:              [],
    riskLevel:             'medium',
    recommendedWindow:     'next',
    goNoGoRequired:        false,
    externalReviewRequired: false,
    productionImpact:      false,
    taskTypeOnly:          'docs_smoke_template'
  }
];

function assignLane(candidate) {
  if (candidate.blockers && candidate.blockers.length > 0)  return LANES.HOLD;
  if (candidate.externalReviewRequired)                     return LANES.EXTERNAL_REVIEW;
  if (candidate.productionImpact || candidate.goNoGoRequired) return LANES.PRODUCTION_GATE;
  if (candidate.readiness === 'ready' && candidate.riskLevel === 'low')  return LANES.NOW;
  if (candidate.readiness === 'ready' || candidate.readiness === 'planning') return LANES.NEXT;
  return LANES.HOLD;
}

function buildReleaseTrain(opts) {
  opts = opts || {};
  const now           = opts.timestamp || Date.now();
  const releaseTrainId = `release-train-${now}`;
  const candidates    = opts.candidates || JSON.parse(JSON.stringify(DEFAULT_CANDIDATES));

  // Override lane with recommendedWindow if set, otherwise compute
  const lanesMap = { now: [], next: [], hold: [], external_review: [], production_gate: [] };
  for (const c of candidates) {
    const lane = assignLane(c);
    c.assignedLane = lane;
    lanesMap[lane].push(c.productId);
  }

  const recommendedSequence = [
    ...lanesMap.now,
    ...lanesMap.next,
    ...lanesMap.external_review,
    ...lanesMap.production_gate,
    ...lanesMap.hold
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    releaseTrainId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    planningPeriod:        opts.planningPeriod || 'current sprint',
    candidateReleases:     candidates,
    releaseLanes:          lanesMap,
    recommendedSequence,
    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalNeededFor:     candidates.filter(c => c.goNoGoRequired || c.externalReviewRequired || c.productionImpact).map(c => c.productId),
      note:                  'じゅんやさんのYES前にgit push / deploy / production gateは実行しない'
    },
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  LANES,
  DEFAULT_CANDIDATES,
  assignLane,
  buildReleaseTrain
};

if (require.main === module) {
  const plan = buildReleaseTrain({});
  console.log(JSON.stringify(plan, null, 2));
}
