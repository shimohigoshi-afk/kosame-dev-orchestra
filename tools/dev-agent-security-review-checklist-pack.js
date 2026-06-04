'use strict';

const TOOL_META = {
  version: '52.0.0',
  title:   'KOSAME Dev Orchestra Security Review Checklist Pack',
  slug:    'dev-agent-security-review-checklist-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const CHECK_CATEGORIES = [
  'Secret / .env / API key',
  'IAM / permissions',
  'Cloud Run / service account',
  'GitHub Actions / secrets',
  'customer data / insurance data',
  'logs / transcripts / uploads',
  'database / storage',
  'authentication / authorization',
  'deploy / rollback',
  'monitoring / alerting',
  'backup / restore',
  'legal / compliance handoff'
];

const DEFAULT_CHECKLIST = [
  // Secret / .env / API key
  { checkId: 'sec-001', category: 'Secret / .env / API key',        title: '.env / credentials は git に commit されていない',          severity: 'critical', status: 'pending', evidenceRequired: 'git log scan / .gitignore 確認', reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'sec-002', category: 'Secret / .env / API key',        title: 'Secret Manager から値がログに出力されない',                   severity: 'critical', status: 'pending', evidenceRequired: 'Cloud Logging 確認 / コードレビュー', reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'sec-003', category: 'Secret / .env / API key',        title: 'API key が hardcode されていない',                           severity: 'critical', status: 'pending', evidenceRequired: 'grep scan on codebase',             reviewer: 'internal',    humanApprovalRequired: true,  externalReviewRecommended: false, blockerIfFailed: true,  notes: '' },
  // IAM / permissions
  { checkId: 'iam-001', category: 'IAM / permissions',              title: 'Service account は最小権限 (least-privilege) か',            severity: 'high',     status: 'pending', evidenceRequired: 'IAM policy JSON 確認',              reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'iam-002', category: 'IAM / permissions',              title: 'Owner / Editor ロールの不要な binding がない',               severity: 'high',     status: 'pending', evidenceRequired: 'GCP IAM 監査ログ確認',              reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  // Cloud Run / service account
  { checkId: 'cr-001',  category: 'Cloud Run / service account',    title: 'Cloud Run サービスの認証設定 (--allow-unauthenticated の是非)', severity: 'high',     status: 'pending', evidenceRequired: 'Cloud Run console 確認',           reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'cr-002',  category: 'Cloud Run / service account',    title: 'Cloud Run の CPU/memory/timeout 設定が本番要件を満たす',      severity: 'medium',   status: 'pending', evidenceRequired: 'Cloud Run 設定確認',               reviewer: 'internal',    humanApprovalRequired: false, externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  // GitHub Actions / secrets
  { checkId: 'ga-001',  category: 'GitHub Actions / secrets',       title: 'CI/CD で secret が workflow log に出力されない',             severity: 'critical', status: 'pending', evidenceRequired: 'Actions log 確認',                 reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'ga-002',  category: 'GitHub Actions / secrets',       title: 'workflow の permissions は最小スコープ',                     severity: 'high',     status: 'pending', evidenceRequired: '.github/workflows/*.yml 確認',     reviewer: 'internal',    humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: false, notes: '' },
  // customer data / insurance data
  { checkId: 'cust-001', category: 'customer data / insurance data', title: 'PII / 保険証券番号 / 健診データがログに出力されない',          severity: 'critical', status: 'pending', evidenceRequired: 'データフロー確認 / ログ確認',        reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'cust-002', category: 'customer data / insurance data', title: '顧客データの保存先・暗号化が要件を満たす',                    severity: 'critical', status: 'pending', evidenceRequired: 'DB / Firestore 設計確認',          reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  // logs / transcripts / uploads
  { checkId: 'log-001', category: 'logs / transcripts / uploads',   title: 'Cloud Logging に個人情報が含まれない',                       severity: 'critical', status: 'pending', evidenceRequired: 'Logging filter 確認',              reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'log-002', category: 'logs / transcripts / uploads',   title: 'アップロードファイルのウイルス/マルウェアチェック設計',        severity: 'high',     status: 'pending', evidenceRequired: '設計ドキュメント確認',              reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: false, notes: '' },
  // database / storage
  { checkId: 'db-001',  category: 'database / storage',             title: 'DB バックアップが定期実行・リストア検証済み',                 severity: 'high',     status: 'pending', evidenceRequired: 'Backup設定・リストアテスト記録',   reviewer: 'internal',    humanApprovalRequired: true,  externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  { checkId: 'db-002',  category: 'database / storage',             title: 'Firestore / DB のアクセスルールが最小権限',                  severity: 'high',     status: 'pending', evidenceRequired: 'Firestore rules 確認',             reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  // authentication / authorization
  { checkId: 'auth-001', category: 'authentication / authorization', title: '認証バイパスの可能性がない',                                  severity: 'critical', status: 'pending', evidenceRequired: 'コードレビュー / penetration test', reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'auth-002', category: 'authentication / authorization', title: '認可ルールの設計が要件を満たす',                              severity: 'high',     status: 'pending', evidenceRequired: '認可設計書 / テスト結果',          reviewer: 'external-se', humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  // deploy / rollback
  { checkId: 'dep-001', category: 'deploy / rollback',              title: 'Rollback 手順が文書化・検証済み',                            severity: 'high',     status: 'pending', evidenceRequired: 'Rollback runbook 確認',            reviewer: 'internal',    humanApprovalRequired: true,  externalReviewRecommended: false, blockerIfFailed: true,  notes: '' },
  { checkId: 'dep-002', category: 'deploy / rollback',              title: 'Zero-downtime deploy の設計・検証',                         severity: 'medium',   status: 'pending', evidenceRequired: 'Deploy 設計書',                   reviewer: 'internal',    humanApprovalRequired: false, externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  // monitoring / alerting
  { checkId: 'mon-001', category: 'monitoring / alerting',          title: 'エラー率・レイテンシのアラートが設定済み',                   severity: 'high',     status: 'pending', evidenceRequired: 'Cloud Monitoring 設定確認',        reviewer: 'internal',    humanApprovalRequired: false, externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  { checkId: 'mon-002', category: 'monitoring / alerting',          title: 'オンコール runbook が整備済み',                              severity: 'medium',   status: 'pending', evidenceRequired: 'Runbook ドキュメント確認',         reviewer: 'internal',    humanApprovalRequired: false, externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  // backup / restore
  { checkId: 'bak-001', category: 'backup / restore',               title: 'データバックアップが自動・定期実行される',                   severity: 'high',     status: 'pending', evidenceRequired: 'バックアップ設定・スケジュール確認', reviewer: 'internal',   humanApprovalRequired: false, externalReviewRecommended: false, blockerIfFailed: false, notes: '' },
  // legal / compliance handoff
  { checkId: 'leg-001', category: 'legal / compliance handoff',     title: '個人情報保護法 / 保険業法 対応設計の確認',                   severity: 'critical', status: 'pending', evidenceRequired: '法務確認記録',                    reviewer: 'legal',       humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' },
  { checkId: 'leg-002', category: 'legal / compliance handoff',     title: 'データ処理委託契約 / DPA の締結確認',                        severity: 'critical', status: 'pending', evidenceRequired: '契約書確認',                      reviewer: 'legal',       humanApprovalRequired: true,  externalReviewRecommended: true,  blockerIfFailed: true,  notes: '' }
];

function evaluateOverallStatus(checklist) {
  const blockersFailed = checklist.filter(c => c.status === 'failed' && c.blockerIfFailed);
  if (blockersFailed.length > 0) return 'NOT_READY';
  const pending = checklist.filter(c => c.status === 'pending' && c.blockerIfFailed);
  if (pending.length > 0) return 'PENDING_REVIEW';
  return 'READY';
}

function buildSecurityChecklist(opts) {
  opts = opts || {};
  const now      = opts.timestamp || Date.now();
  const checklist = opts.checklist || JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));

  if (opts.overrideStatuses) {
    for (const [id, status] of Object.entries(opts.overrideStatuses)) {
      const item = checklist.find(c => c.checkId === id);
      if (item) item.status = status;
    }
  }

  const overallStatus = evaluateOverallStatus(checklist);

  return {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    product:               opts.product || 'KOSAME Dev Orchestra / ANESTY Board',
    checkCategories:       CHECK_CATEGORIES,
    checkCount:            checklist.length,
    checklist,
    overallStatus,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  CHECK_CATEGORIES,
  DEFAULT_CHECKLIST,
  evaluateOverallStatus,
  buildSecurityChecklist
};

if (require.main === module) {
  const result = buildSecurityChecklist({});
  console.log(JSON.stringify(result, null, 2));
}
