'use strict';

const TOOL_META = {
  version: '107.0.0',
  title: 'KOSAME Dev Orchestra External Review Final Packet Pack',
  slug: 'dev-agent-external-review-final-packet-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'include secrets in packet', 'include .env contents', 'include customer data',
  'include full production logs', 'deploy', 'real billing', 'real send',
  'destructive delete', 'git push/tag without approval'
];

const REVIEW_AREAS = [
  'authentication_authorization',
  'data_boundary_enforcement',
  'secret_management',
  'ai_action_safety',
  'human_approval_gate_integrity',
  'external_api_risk',
  'cost_control',
  'rollback_capability'
];

function buildExternalReviewFinalPacket(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `external-review-final-packet-${now}`;

  const reviewAreas = (opts.reviewAreas || REVIEW_AREAS).map(area => ({
    area,
    riskLevel: opts.riskLevels && opts.riskLevels[area] ? opts.riskLevels[area] : 'medium',
    reviewQuestion: `Is ${area.replace(/_/g, ' ')} implemented safely and consistently?`,
    includedInPacket: true,
    secretsIncluded: false,
    customerDataIncluded: false
  }));

  const redactedItems = [
    'API keys and secrets (use placeholder [REDACTED_SECRET])',
    '.env file contents',
    'real customer PII',
    'Gmail/PDF data',
    'insurance/health data',
    'full production logs with sensitive data'
  ];

  const packet = {
    packetId: id,
    orchestraVersion: opts.orchestraVersion || '106.0.0',
    reviewPurpose: opts.reviewPurpose || 'SE/security/specialist review before v1.0 declaration',
    reviewAreas,
    focusQuestion: 'Are all irreversible danger zones properly guarded? Are all human approval gates intact?',
    redactedItems,
    includedArtifacts: [
      'architecture overview (no secrets)',
      'dangerous actions denied list',
      'human approval gate matrix',
      'smoke test results summary',
      'known risk areas',
      'open review questions'
    ],
    openReviewQuestions: opts.openReviewQuestions || [
      'Is the humanApprovalRequired gate consistently enforced across all v96-v106 tools?',
      'Are all dangerousActionsDenied lists complete and consistent?',
      'Is the data boundary enforcement sufficient for pilot scope?',
      'Are there any unguarded paths to irreversible actions?'
    ]
  };

  return {
    externalReviewFinalPacketId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    packet,
    reviewAreas: REVIEW_AREAS,

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['send packet to external reviewer', 'act on reviewer findings'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'External reviewer must not receive secrets, .env, or customer data. Packet is pre-sanitized.'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  REVIEW_AREAS, buildExternalReviewFinalPacket
};

if (require.main === module) {
  const r = buildExternalReviewFinalPacket({});
  console.log(JSON.stringify({ packetId: r.packet.packetId, reviewAreas: r.reviewAreas.length }, null, 2));
}
