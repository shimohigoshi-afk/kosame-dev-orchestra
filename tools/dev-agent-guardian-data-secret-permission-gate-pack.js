'use strict';

const TOOL_META = {
  version: '68.0.0',
  title:   'KOSAME Dev Orchestra Guardian Data / Secret / Permission Gate Pack',
  slug:    'dev-agent-guardian-data-secret-permission-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const GATE_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED', PENDING: 'PENDING' };

const DEFAULT_DATA_ACCESS_GATES = [
  { gateId: 'dag-001', resource: 'Firestore (customer documents)', accessLevel: 'read/write', currentPolicy: 'Service account with Firestore roles', riskLevel: 'critical', requiresExternalReview: true,  status: 'PENDING' },
  { gateId: 'dag-002', resource: 'Cloud Storage (user uploads)',   accessLevel: 'read/write', currentPolicy: 'Service account with Storage roles',   riskLevel: 'high',     requiresExternalReview: false, status: 'PENDING' },
  { gateId: 'dag-003', resource: 'Cloud Logging (application logs)', accessLevel: 'read',    currentPolicy: 'Log viewer for admin only',            riskLevel: 'medium',   requiresExternalReview: false, status: 'PENDING' },
  { gateId: 'dag-004', resource: 'AI prompt data (Gemini/Claude)', accessLevel: 'write (send)', currentPolicy: 'Only non-PII prompts unless approved', riskLevel: 'high',  requiresExternalReview: true,  status: 'PENDING' }
];

const DEFAULT_SECRET_GATES = [
  { gateId: 'sg-001', secretName: 'Discord Bot Token',    storageLocation: 'Secret Manager', rotationPolicy: 'manual / as-needed', accessors: ['Cloud Run service account'], status: 'PENDING' },
  { gateId: 'sg-002', secretName: 'AI API Keys',          storageLocation: 'Secret Manager', rotationPolicy: 'manual / as-needed', accessors: ['Cloud Run service account'], status: 'PENDING' },
  { gateId: 'sg-003', secretName: 'Gmail OAuth Credentials', storageLocation: 'Secret Manager', rotationPolicy: 'manual / as-needed', accessors: ['Cloud Run service account'], status: 'PENDING' },
  { gateId: 'sg-004', secretName: 'Database credentials', storageLocation: 'Secret Manager', rotationPolicy: 'manual / as-needed', accessors: ['Cloud Run service account'], status: 'PENDING' }
];

const DEFAULT_PERMISSION_BOUNDARIES = [
  { boundaryId: 'pb-001', role: 'Cloud Run service account', allowedActions: ['Firestore read/write', 'GCS read/write', 'Secret Manager accessor', 'Logging write'], deniedActions: ['Project IAM admin', 'Billing admin', 'Owner/Editor'], riskLevel: 'high',   status: 'PENDING' },
  { boundaryId: 'pb-002', role: 'GitHub Actions OIDC',       allowedActions: ['Cloud Run deploy (human-triggered)', 'GCR push'],                                     deniedActions: ['IAM admin', 'Secret Manager admin'],                                      riskLevel: 'high',   status: 'PENDING' },
  { boundaryId: 'pb-003', role: 'Developer (human)',          allowedActions: ['git push (local)', 'gcloud (with human YES)', 'Cloud Console read'],                   deniedActions: ['Automated deploy', 'Automated secret rotation'],                          riskLevel: 'medium', status: 'PENDING' }
];

function evaluateGateStatus(dataGates, secretGates, permBoundaries, overrides) {
  overrides = overrides || {};
  const allGates = [...dataGates, ...secretGates, ...permBoundaries];
  const critical = allGates.filter(g => g.riskLevel === 'critical' && (overrides[g.gateId] || g.status) === 'OPEN');
  if (critical.length > 0) return { status: 'GATE_OPEN_CRITICAL', blockers: critical.map(g => g.gateId) };
  const anyOpen = allGates.some(g => (overrides[g.gateId] || g.status) === 'OPEN');
  if (anyOpen) return { status: 'GATE_OPEN', blockers: [] };
  return { status: 'ALL_GATES_PENDING_REVIEW', blockers: [] };
}

function buildDataSecretPermissionGate(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const gateId = `data-secret-permission-gate-${now}`;

  const dataAccessGates       = opts.dataAccessGates       || JSON.parse(JSON.stringify(DEFAULT_DATA_ACCESS_GATES));
  const secretGates           = opts.secretGates           || JSON.parse(JSON.stringify(DEFAULT_SECRET_GATES));
  const permissionBoundaries  = opts.permissionBoundaries  || JSON.parse(JSON.stringify(DEFAULT_PERMISSION_BOUNDARIES));
  const gateStatus            = evaluateGateStatus(dataAccessGates, secretGates, permissionBoundaries, opts.overrideStatuses);

  return {
    gateId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    product:               opts.product || 'KOSAME Dev Orchestra',
    dataAccessGates,
    secretGates,
    permissionBoundaries,
    overallGateStatus:     gateStatus.status,
    blockers:              gateStatus.blockers,
    externalReviewRequired: dataAccessGates.some(g => g.requiresExternalReview),
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  GATE_STATUS,
  DEFAULT_DATA_ACCESS_GATES,
  DEFAULT_SECRET_GATES,
  DEFAULT_PERMISSION_BOUNDARIES,
  evaluateGateStatus,
  buildDataSecretPermissionGate
};

if (require.main === module) {
  const result = buildDataSecretPermissionGate({});
  console.log(JSON.stringify(result, null, 2));
}
