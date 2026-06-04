'use strict';

const TOOL_META = {
  version: '78.0.0',
  title:   'KOSAME Dev Orchestra Human YES Queue Board Pack',
  slug:    'dev-agent-human-yes-queue-board-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'deploy (any form)', 'git push (automated)',
  'customer data read', 'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real email send', 'real payment processing', 'real contract execution',
  'real Gmail send', 'real customer onboarding without human approval'
];

const DECISION_OPTIONS = ['YES', 'NO', 'HOLD'];

const DEFAULT_PENDING_APPROVALS = [
  {
    approvalId:            'ya-001',
    title:                 'git commit / push / tag',
    product:               'KOSAME Dev Orchestra',
    riskLevel:             'medium',
    reasonHumanNeeded:     'コードを公式バージョンとして記録する操作。AIは実行しない。',
    recommendedDecision:   'YES (verify PASS / smoke PASS 確認後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        'deploy / タグ付け',
    dangerGate:            'git push (automated)'
  },
  {
    approvalId:            'ya-002',
    title:                 'deploy (Cloud Run / gcloud deploy / docker build)',
    product:               '全プロダクト',
    riskLevel:             'critical',
    reasonHumanNeeded:     '本番環境への影響。AIは実行しない。',
    recommendedDecision:   'YES (Guardian Class 通過 + 外部SEレビュー後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        '本番公開',
    dangerGate:            'deploy (any form)'
  },
  {
    approvalId:            'ya-003',
    title:                 'Secret / .env / API key 閲覧・操作',
    product:               '全プロダクト',
    riskLevel:             'critical',
    reasonHumanNeeded:     '認証情報の漏洩リスク。AIは読まない。',
    recommendedDecision:   'YES (必要最小限の操作のみ)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        'deploy / 本番運用',
    dangerGate:            'secret read'
  },
  {
    approvalId:            'ya-004',
    title:                 'Cloud Run / IAM / Secret Manager 設定変更',
    product:               'Cloud Run PM Agent',
    riskLevel:             'critical',
    reasonHumanNeeded:     'インフラ設定変更は外部SEレビュー後に人間が実行する。',
    recommendedDecision:   'YES (外部SEレビュー完了後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        'Cloud Run deploy',
    dangerGate:            'deploy (any form)'
  },
  {
    approvalId:            'ya-005',
    title:                 'Gmail / メール実送信',
    product:               'Email Reply BOT / 営業DX',
    riskLevel:             'critical',
    reasonHumanNeeded:     '実際の顧客・関係者へのメール送信。誤送信リスクあり。AIは送信しない。',
    recommendedDecision:   'YES (送信内容・宛先を人間が最終確認後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        '実顧客コンタクト',
    dangerGate:            'real email send'
  },
  {
    approvalId:            'ya-006',
    title:                 '実顧客データ読取',
    product:               '営業DX / BackOffice',
    riskLevel:             'critical',
    reasonHumanNeeded:     '個人情報・保険情報・顧客情報へのアクセス。データ保護法対応必須。',
    recommendedDecision:   'YES (Guardian v67/v68 通過 + 外部SEレビュー後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        'データ処理業務開始',
    dangerGate:            'customer data read'
  },
  {
    approvalId:            'ya-007',
    title:                 '実契約・実請求・実導入',
    product:               '全プロダクト (有料化)',
    riskLevel:             'critical',
    reasonHumanNeeded:     '法的・財務的な効果を持つ操作。AIは実行しない。',
    recommendedDecision:   'YES (Revenue Launch Line + Guardian Class 完了後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        '初回有料化',
    dangerGate:            'real payment processing'
  },
  {
    approvalId:            'ya-008',
    title:                 '外部SEレビュー依頼送付',
    product:               '全プロダクト (本番前)',
    riskLevel:             'high',
    reasonHumanNeeded:     '外部への情報開示を伴う。内容・相手・範囲を人間が最終確認。',
    recommendedDecision:   'YES (Guardian Class v70 + Review Packet v51 準備後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        '外部SEレビュー実施',
    dangerGate:            null
  },
  {
    approvalId:            'ya-009',
    title:                 '顧客に見える文章の最終送信 (SNS / ブログ / LP / メール)',
    product:               '全プロダクト',
    riskLevel:             'high',
    reasonHumanNeeded:     '外部公開コンテンツ。誤表現・誇大広告・法令違反リスクあり。',
    recommendedDecision:   'YES (内容・表現を人間が最終確認後)',
    allowedDecisionOptions: DECISION_OPTIONS,
    requiredBefore:        '外部公開',
    dangerGate:            null
  }
];

function buildHumanYesQueueBoard(opts) {
  opts = opts || {};
  const now     = opts.timestamp || Date.now();
  const queueId = `human-yes-queue-${now}`;
  const pending = opts.pendingApprovals || DEFAULT_PENDING_APPROVALS;

  const approvalSummary = {
    total:    pending.length,
    critical: pending.filter(a => a.riskLevel === 'critical').length,
    high:     pending.filter(a => a.riskLevel === 'high').length,
    medium:   pending.filter(a => a.riskLevel === 'medium').length
  };

  return {
    yesQueueId:            queueId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    pendingApprovals:      pending,
    approvalSummary,
    blockedUntilHumanYes:  pending.map(a => a.title),
    autoProceedAllowed:    false,
    decisionOptions:       DECISION_OPTIONS,
    nextAction: opts.nextAction || 'じゅんやさんが各承認項目を順にYES/NO/HOLDで判断する。AIは代行しない。',
    operatingPolicy: [
      'autoProceedAllowed: false — AIが勝手にYESしない',
      'じゅんやさんには最終判断だけを残す',
      '作業コマンドや細かい確認を増やしすぎない',
      '危険操作は承認ゲートに置く'
    ],
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DECISION_OPTIONS,
  DEFAULT_PENDING_APPROVALS,
  buildHumanYesQueueBoard
};

if (require.main === module) {
  const result = buildHumanYesQueueBoard({});
  console.log(JSON.stringify(result, null, 2));
}
