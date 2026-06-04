'use strict';

const TOOL_META = {
  version: '66.0.0',
  title:   'KOSAME Dev Orchestra Guardian Attack Surface Review Pack',
  slug:    'dev-agent-guardian-attack-surface-review-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real exploit execution',
  'real penetration test without authorization'
];

const RISK_LEVELS = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

const DEFAULT_ATTACK_SURFACES = [
  {
    surfaceId:   'as-001',
    name:        'HTTP API endpoints (Cloud Run)',
    entryPoint:  'HTTPS requests to Cloud Run service URL',
    authBoundary: 'Cloud Run authentication (unauthenticated vs authenticated)',
    dataFlows:   ['Client → Cloud Run → Firestore', 'Client → Cloud Run → Secret Manager'],
    riskLevel:   RISK_LEVELS.HIGH,
    mitigations: ['Verify --allow-unauthenticated setting', 'Check IAM bindings', 'Review request validation']
  },
  {
    surfaceId:   'as-002',
    name:        'GitHub Actions CI/CD pipeline',
    entryPoint:  'Push events, PR events, workflow_dispatch',
    authBoundary: 'GitHub Actions secrets, OIDC tokens',
    dataFlows:   ['Source code → Runner → GCP (via OIDC)', 'Runner → Secret Manager'],
    riskLevel:   RISK_LEVELS.HIGH,
    mitigations: ['Audit workflow permissions', 'Check for secret print/echo in logs', 'Review third-party actions']
  },
  {
    surfaceId:   'as-003',
    name:        'Discord Bot webhook / token',
    entryPoint:  'Discord interaction events, direct messages',
    authBoundary: 'Bot token, interaction signature verification',
    dataFlows:   ['Discord API → Bot handler → Firestore/GCS'],
    riskLevel:   RISK_LEVELS.HIGH,
    mitigations: ['Token stored in Secret Manager only', 'Verify interaction signatures', 'Rate limit checks']
  },
  {
    surfaceId:   'as-004',
    name:        'Firestore / Cloud Storage data access',
    entryPoint:  'Firestore SDK, GCS SDK from Cloud Run',
    authBoundary: 'Service account IAM roles, Firestore security rules',
    dataFlows:   ['Cloud Run → Firestore', 'Cloud Run → GCS'],
    riskLevel:   RISK_LEVELS.HIGH,
    mitigations: ['Audit Firestore rules', 'Check GCS bucket IAM', 'Verify service account least-privilege']
  },
  {
    surfaceId:   'as-005',
    name:        'External AI API calls (Gemini, Claude, OpenAI)',
    entryPoint:  'Outbound HTTPS from Cloud Run to AI APIs',
    authBoundary: 'API keys stored in Secret Manager',
    dataFlows:   ['Cloud Run → AI API (with prompt data)', 'AI API response → Cloud Run → user'],
    riskLevel:   RISK_LEVELS.MEDIUM,
    mitigations: ['Verify no PII in prompts unless explicitly required', 'Check API key rotation policy', 'Monitor token usage for anomalies']
  },
  {
    surfaceId:   'as-006',
    name:        'Email / Gmail API integration',
    entryPoint:  'Gmail API calls from application code',
    authBoundary: 'OAuth2 credentials, service account',
    dataFlows:   ['Application → Gmail API → External recipients'],
    riskLevel:   RISK_LEVELS.CRITICAL,
    mitigations: ['Real send requires human approval gate', 'Check recipient validation', 'No PII in email body without encryption']
  },
  {
    surfaceId:   'as-007',
    name:        'Admin / operator CLI commands',
    entryPoint:  'Cloud Shell, local developer machine',
    authBoundary: 'GCP project IAM, gcloud auth',
    dataFlows:   ['Developer → gcloud CLI → GCP resources'],
    riskLevel:   RISK_LEVELS.MEDIUM,
    mitigations: ['Audit who has gcloud access', 'Destructive commands require explicit human YES', 'Log all admin operations']
  }
];

function evaluateOverallRisk(surfaces) {
  if (surfaces.some(s => s.riskLevel === RISK_LEVELS.CRITICAL)) return RISK_LEVELS.CRITICAL;
  if (surfaces.some(s => s.riskLevel === RISK_LEVELS.HIGH))     return RISK_LEVELS.HIGH;
  if (surfaces.some(s => s.riskLevel === RISK_LEVELS.MEDIUM))   return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

function buildAttackSurfaceReview(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const reviewId = `attack-surface-review-${now}`;
  const surfaces = opts.attackSurfaces || JSON.parse(JSON.stringify(DEFAULT_ATTACK_SURFACES));
  const overallRiskLevel = evaluateOverallRisk(surfaces);

  return {
    reviewId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    product:               opts.product || 'KOSAME Dev Orchestra / ANESTY Board',
    attackSurfaces:        surfaces,
    overallRiskLevel,
    riskSummary: {
      critical: surfaces.filter(s => s.riskLevel === RISK_LEVELS.CRITICAL).length,
      high:     surfaces.filter(s => s.riskLevel === RISK_LEVELS.HIGH).length,
      medium:   surfaces.filter(s => s.riskLevel === RISK_LEVELS.MEDIUM).length,
      low:      surfaces.filter(s => s.riskLevel === RISK_LEVELS.LOW).length
    },
    mitigationPriority: surfaces
      .filter(s => [RISK_LEVELS.CRITICAL, RISK_LEVELS.HIGH].includes(s.riskLevel))
      .map(s => ({ surfaceId: s.surfaceId, name: s.name, riskLevel: s.riskLevel })),
    externalReviewRecommended: overallRiskLevel === RISK_LEVELS.CRITICAL,
    guardianStatus: overallRiskLevel === RISK_LEVELS.CRITICAL ? 'NEEDS_REVIEW' : 'REVIEWED',
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  RISK_LEVELS,
  DEFAULT_ATTACK_SURFACES,
  evaluateOverallRisk,
  buildAttackSurfaceReview
};

if (require.main === module) {
  const result = buildAttackSurfaceReview({});
  console.log(JSON.stringify(result, null, 2));
}
