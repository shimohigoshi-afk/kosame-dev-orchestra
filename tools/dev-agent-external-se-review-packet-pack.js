'use strict';

const TOOL_META = {
  version: '51.0.0',
  title:   'KOSAME Dev Orchestra External SE Review Packet Pack',
  slug:    'dev-agent-external-se-review-packet-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const REVIEW_SCOPE_OPTIONS = [
  'security design',
  'personal data handling',
  'insurance/customer data boundary',
  'Cloud Run / Secret Manager / IAM',
  'database schema',
  'authentication / authorization',
  'production readiness',
  'incident recovery'
];

const OUT_OF_SCOPE_ALWAYS = [
  'docs-only wording changes',
  'minor smoke test additions',
  'README updates',
  'fixture additions',
  'dry-run packet additions',
  'git commit / push / tag execution (proxy work)',
  'deploy execution (proxy work)',
  'Secret value access / credential retrieval'
];

const DEFAULT_REVIEW_SCOPE = [
  'security design',
  'personal data handling',
  'insurance/customer data boundary',
  'Cloud Run / Secret Manager / IAM',
  'authentication / authorization',
  'production readiness',
  'incident recovery'
];

const DEFAULT_RISK_AREAS = [
  { area: 'Secret Manager / API key exposure',   severity: 'critical', description: 'Verify that no secrets are logged, printed, or embedded in code/docs.' },
  { area: 'IAM least-privilege enforcement',      severity: 'high',    description: 'Service accounts must have only the permissions required for operation.' },
  { area: 'Customer / insurance data boundary',   severity: 'critical', description: 'PII, policy numbers, health data must not appear in logs or docs.' },
  { area: 'Cloud Run authentication',             severity: 'high',    description: 'Verify --allow-unauthenticated vs authenticated service configuration.' },
  { area: 'GitHub Actions secret injection',      severity: 'high',    description: 'Confirm that CI/CD secrets are not printed or leaked in workflow logs.' },
  { area: 'Rollback plan completeness',           severity: 'medium',  description: 'Confirm a tested rollback procedure exists for each deploy target.' },
  { area: 'Incident / outage response',           severity: 'medium',  description: 'On-call runbook and escalation path must be documented and tested.' }
];

const DEFAULT_QUESTIONS_FOR_EXTERNAL_SE = [
  'Secret Manager の binding と rotation 設計は適切か？',
  'Cloud Run の service account に過剰な権限が付与されていないか？',
  'GitHub Actions workflow で secret が log に出力される可能性はないか？',
  'Customer / insurance data が Cloud Logging / Firestore に意図せず保存されるリスクはないか？',
  'Rollback手順は本番影響なく確実に実行できるか？',
  '認証 / 認可のバイパスリスクはないか？',
  '本番公開前に行うべき penetration test / security audit の範囲はどこか？'
];

function buildReviewPacket(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const reviewPacketId = `external-se-review-${now}`;

  return {
    reviewPacketId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:       opts.product       || 'KOSAME Dev Orchestra / ANESTY Board',
    repo:          opts.repo          || '/home/shimohigoshi/kosame-dev-orchestra',
    targetVersion: opts.targetVersion || TOOL_META.version,

    internalBuildSummary: opts.internalBuildSummary || [
      'KOSAME Dev Orchestra で通常開発の 80〜90% を内製済み',
      'docs / smoke / fixture / tool / package.json は Claude Code が担当',
      'git commit / push / tag / deploy はじゅんやさんが実行',
      '安全境界・危険ゲートは全 pack で BLOCKED 状態'
    ],

    reviewPurpose: opts.reviewPurpose || [
      '外部SEを「全部作る人」ではなく「最後の危険箇所を見る監査役」にする',
      '外部レビューの範囲を 10% 程度に絞る',
      'セキュリティ / 本番影響 / 個人情報 / 保険情報 / インフラ / DB / 認証の専門知識が必要な箇所のみを依頼する'
    ],

    reviewScope:   opts.reviewScope   || DEFAULT_REVIEW_SCOPE,
    outOfScope:    opts.outOfScope    || OUT_OF_SCOPE_ALWAYS,
    filesToReview: opts.filesToReview || [
      'cloud-run/pm-agent-service.template.yaml',
      'Dockerfile',
      '.github/workflows/ (if applicable)',
      'tools/pm-agent-cloud-run-preflight.js',
      'tools/pm-agent-deploy-approval-packet.js'
    ],
    riskAreas:              opts.riskAreas              || DEFAULT_RISK_AREAS,
    questionsForExternalSE: opts.questionsForExternalSE || DEFAULT_QUESTIONS_FOR_EXTERNAL_SE,

    expectedReviewOutput: opts.expectedReviewOutput || [
      'セキュリティ設計の問題点一覧 (severity 付き)',
      '個人情報 / 保険情報 boundary の評価コメント',
      'IAM 設計の問題点と推奨修正案',
      '本番公開前に必須の対応項目リスト',
      'GO / HOLD / NO-GO 判定コメント'
    ],

    handoffNote: opts.handoffNote || [
      'このパケットをそのまま外部SE / セキュリティ監査担当に渡せる形で設計されています',
      'Secret / deploy / データの実閲覧は外部SE自身が安全な手続きで行ってください',
      '最終 GO 判定はじゅんやさんが行います'
    ],

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  REVIEW_SCOPE_OPTIONS,
  OUT_OF_SCOPE_ALWAYS,
  DEFAULT_RISK_AREAS,
  DEFAULT_QUESTIONS_FOR_EXTERNAL_SE,
  buildReviewPacket
};

if (require.main === module) {
  const packet = buildReviewPacket({});
  console.log(JSON.stringify(packet, null, 2));
}
