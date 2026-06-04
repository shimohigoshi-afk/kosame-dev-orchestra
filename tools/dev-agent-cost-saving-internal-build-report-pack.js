'use strict';

const TOOL_META = {
  version: '54.0.0',
  title:   'KOSAME Dev Orchestra Cost-Saving Internal Build Report Pack',
  slug:    'dev-agent-cost-saving-internal-build-report-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const DEFAULT_INTERNAL_BUILD_ITEMS = [
  { itemId: 'int-001', category: 'tools',    title: 'Operation Board Pack (v45-v48)',              handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-002', category: 'tools',    title: 'Task Template Bank (v49)',                   handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-003', category: 'tools',    title: 'Practical Build Line (v50)',                 handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-004', category: 'smoke',    title: 'Smoke tests for all packs (v1〜v50)',        handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-005', category: 'docs',     title: 'AI-dev-team documentation (全バージョン)',   handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-006', category: 'fixtures', title: 'Fixture / sample data for all packs',       handledBy: 'Claude / Kuro', status: 'done', externalSENeeded: false },
  { itemId: 'int-007', category: 'packet',   title: 'PM decision log / dispatch pack',           handledBy: 'KOSAME / GPT',  status: 'done', externalSENeeded: false },
  { itemId: 'int-008', category: 'packet',   title: 'Human approval gate / acceptance gate',     handledBy: 'KOSAME / GPT',  status: 'done', externalSENeeded: false },
  { itemId: 'int-009', category: 'ops',      title: 'git commit / push / tag',                   handledBy: 'Human / Junya', status: 'done', externalSENeeded: false },
  { itemId: 'int-010', category: 'ops',      title: 'Cloud Run deploy (initial)',                 handledBy: 'Human / Junya', status: 'done', externalSENeeded: false }
];

const DEFAULT_AVOIDED_EXTERNAL_SE_TASKS = [
  { taskId: 'avo-001', title: 'docs / smoke / fixture 追加作業の代行',           reason: 'Claude Code で内製完了' },
  { taskId: 'avo-002', title: 'Operation Board / Build Line の実装代行',         reason: 'Claude Code で内製完了' },
  { taskId: 'avo-003', title: 'pack / tool / packet の設計・実装',               reason: 'Claude Code で内製完了 (50+ tools)' },
  { taskId: 'avo-004', title: '毎回のcommit / tag 対応代行',                      reason: 'じゅんやさんが自前実行' },
  { taskId: 'avo-005', title: '通常バグ修正・feature追加 (低リスク)',              reason: 'Claude Code + こさめ/GPT でループ処理' },
  { taskId: 'avo-006', title: 'README / runbook 更新代行',                        reason: 'Claude Code で内製完了' },
  { taskId: 'avo-007', title: 'CI/CD smoke failure の初期トリアージ',              reason: 'verify + Actions ログで内製対応' }
];

const DEFAULT_REMAINING_EXTERNAL_REVIEW_TASKS = [
  { taskId: 'ext-001', title: 'Secret Manager / IAM 設計レビュー',          priority: 'critical', reason: '専門セキュリティ知識が必要' },
  { taskId: 'ext-002', title: '個人情報 / 保険情報 data boundary 監査',      priority: 'critical', reason: '法令・業界規制の専門知識が必要' },
  { taskId: 'ext-003', title: 'Cloud Run 認証設計レビュー',                   priority: 'high',     reason: 'GCP専門知識が必要' },
  { taskId: 'ext-004', title: 'GitHub Actions workflow セキュリティ監査',     priority: 'high',     reason: 'CI/CDセキュリティの専門知識が必要' },
  { taskId: 'ext-005', title: 'Penetration test / 脆弱性診断',               priority: 'high',     reason: '本番公開前の必須レビュー' },
  { taskId: 'ext-006', title: '法務 / コンプライアンス ハンドオフ確認',       priority: 'critical', reason: '個人情報保護法・保険業法の専門確認が必要' },
  { taskId: 'ext-007', title: 'DB / Firestore スキーマ・アクセス制御監査',   priority: 'high',     reason: 'データ設計の専門レビューが必要' }
];

const DEFAULT_NON_FINANCIAL_BENEFITS = [
  '開発速度の向上 — Claude Code による即座の実装で iteration が速い',
  '知識の内製化 — KOSAME Dev Orchestra に設計判断・実装ノウハウが蓄積される',
  'じゅんやさんの認知負荷軽減 — 指示出しと最終YES だけに集中できる',
  'こさめ/GPT によるPM視点の品質維持 — Acceptance Gate で人間レビューを確保',
  '安全境界の自動化 — 危険ゲートがコードに組み込まれ、うっかりミスを防止',
  'Handoff doc の蓄積 — 外部SE/監査担当への説明コストの削減'
];

function buildCostSavingReport(opts) {
  opts = opts || {};
  const now      = opts.timestamp || Date.now();
  const reportId = `cost-saving-report-${now}`;

  return {
    reportId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product: opts.product || 'KOSAME Dev Orchestra / ANESTY Board',
    period:  opts.period  || 'v1.0.0 〜 v55.0.0 (2025年〜2026年)',

    internalBuildItems:         opts.internalBuildItems         || DEFAULT_INTERNAL_BUILD_ITEMS,
    avoidedExternalSETasks:     opts.avoidedExternalSETasks     || DEFAULT_AVOIDED_EXTERNAL_SE_TASKS,
    remainingExternalReviewTasks: opts.remainingExternalReviewTasks || DEFAULT_REMAINING_EXTERNAL_REVIEW_TASKS,

    estimatedCostSavingNote: opts.estimatedCostSavingNote || [
      '注意: 金額は断定しません。以下は参考材料です。',
      '外部SE依頼の削減範囲: 通常開発の推定 80〜90% を内製化',
      '外部レビューに残す範囲: 推定 10% (セキュリティ / 個人情報 / インフラ / DB / 認証の専門箇所)',
      '具体的な金額見積もりは、実際の作業量・単価・契約形態に基づいてじゅんやさんが判断してください'
    ],
    costSavingNoteIsNonBinding:  true,
    costSavingNoteIsExampleOnly: true,

    nonFinancialBenefits: opts.nonFinancialBenefits || DEFAULT_NON_FINANCIAL_BENEFITS,

    risksNotOutsourced: opts.risksNotOutsourced || [
      '低リスク領域 (docs / smoke / fixtures / tools) は内製で対応',
      '高リスク領域 (Secret / deploy / 個人情報 / 本番影響) は外部SE / じゅんやさんが担当',
      '境界線は Safety Gate / Danger Gates で自動判定'
    ],

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_INTERNAL_BUILD_ITEMS,
  DEFAULT_AVOIDED_EXTERNAL_SE_TASKS,
  DEFAULT_REMAINING_EXTERNAL_REVIEW_TASKS,
  DEFAULT_NON_FINANCIAL_BENEFITS,
  buildCostSavingReport
};

if (require.main === module) {
  const report = buildCostSavingReport({});
  console.log(JSON.stringify(report, null, 2));
}
