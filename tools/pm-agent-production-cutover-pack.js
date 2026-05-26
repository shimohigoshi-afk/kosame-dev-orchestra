"use strict";

// KOSAME Cloud Run PM Agent — Production Cutover Pack (v0.4.2)
// Generates production cutover checklist, rollback window plan, and monitoring plan.
// Does NOT execute deploys. No dotenv files. No credential access.
// Does not use process-spawn calls or synchronous shell execution.
// All cutover operations require Human Approval.

function generateGoNoGoChecklist(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Go/No-Go checklist for production cutover",
    dryRun: true,
    humanApprovalRequired: true,
    serviceName,
    region,
    projectId,
    goConditions: [
      "[ ] npm run verify → 全 smoke PASS",
      "[ ] npm run pm-agent:deploy-readiness-final-check → readyForHumanDeploy: true",
      "[ ] v0.4.0 deploy 完了 & Cloud Run URL 確定",
      "[ ] v0.4.1 smoke 全 PASS（health / info / dry-run-task）",
      "[ ] billing: 課金が想定範囲内",
      "[ ] Cloud Run console: revision healthy",
      "[ ] n8n 接続テスト PASS（v0.4.2）",
      "[ ] Secret Manager: 必要な Secret が登録済み",
      "[ ] rollback 手順を把握済み",
      "[ ] じゅんやさんの承認（Human Approval）",
    ],
    noGoConditions: [
      "smoke 失敗が 1 件でもある",
      "billing スパイク（予算超過）",
      "Cloud Run revision が unhealthy",
      "n8n 接続テスト失敗",
      "Secret Manager 接続エラー",
      "Human Approval 未取得",
    ],
    decision: "PENDING (Go / No-Go)",
    note: "全条件が満たされてからじゅんやさんが承認する。",
  };
}

function generateRollbackWindowPlan(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Rollback window plan for production cutover",
    dryRun: true,
    humanApprovalRequired: true,
    rollbackWindow: "deploy 後 24h は rollback 準備を維持する",
    rollbackTriggers: [
      "smoke fail → 即時 rollback 検討",
      "billing スパイク → サービス停止・原因調査",
      "n8n 接続失敗 → Cloud Run 設定確認・rollback 検討",
      "予期しないエラーレート上昇 → ログ確認・判断",
    ],
    rollbackCommands: [
      `# revision 一覧確認（Human Approval 後に実行）`,
      `gcloud run revisions list --service ${serviceName} --region ${region} --project ${projectId}`,
      ``,
      `# 旧 revision へ traffic 切り替え（Human Approval 後に実行）`,
      `gcloud run services update-traffic ${serviceName} --to-revisions PREVIOUS_REVISION=100 --region ${region} --project ${projectId}`,
    ],
    rollbackDecisionAuthority: "じゅんやさんのみ判断・実行",
    note: "Rollback commands are strings only. Execute only with Human Approval.",
  };
}

function generatePostCutoverMonitoringPlan(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Post-cutover monitoring plan",
    dryRun: true,
    humanApprovalRequired: true,
    monitoringPeriod: "deploy 後 72h は集中監視",
    monitoringItems: [
      { item: "Health check", frequency: "1時間おき", method: `curl -s ${serviceUrl}/health | jq .` },
      { item: "Error rate", frequency: "Cloud Monitoring で自動", method: "Cloud Run コンソール → Error rate" },
      { item: "Latency p99", frequency: "Cloud Monitoring で自動", method: "Cloud Run コンソール → Latency" },
      { item: "Billing", frequency: "1日おき", method: "GCP billing コンソール" },
      { item: "n8n connection", frequency: "初回接続後 24h", method: "n8n workflow 実行ログ確認" },
    ],
    alertThresholds: {
      errorRate: "1% 超えたら調査",
      latencyP99: "5s 超えたら調査",
      billingDaily: "想定超過で即確認",
    },
    scalingDecision: "max-instances 1 → 需要に応じてじゅんやさんが判断して変更",
    production: "Cloud Run は production 相当。billing・security の監視を継続する。",
    note: "All monitoring actions require human review. AI does not access metrics automatically.",
  };
}

function generateProductionCutoverPack(options) {
  const opts = options || {};

  return {
    description: "Production Cutover Pack — v0.4.2",
    dryRun: true,
    humanApprovalRequired: true,
    generationPolicy: "Generates checklists and plans only. Does not execute deploy operations.",
    note: "Cutover はじゅんやさんが Human Approval 後に実施する。AIは実行しない。",
    goNoGoChecklist: generateGoNoGoChecklist(opts),
    rollbackWindowPlan: generateRollbackWindowPlan(opts),
    postCutoverMonitoringPlan: generatePostCutoverMonitoringPlan(opts),
    cutoverOrder: [
      "1. Go/No-Go チェックリスト全項目 ✓",
      "2. じゅんやさんの承認（Human Approval）",
      "3. rollback 手順を手元に用意",
      "4. 72h 集中監視開始",
      "5. billing アラート設定確認",
      "6. 問題なければ next version（v0.5.0）へ",
    ],
    billingCheck: "Production cutover 前後は billing を注視する。",
    rollback: "何か問題が起きたら即 rollback。じゅんやさんのみ判断。",
    nextVersion: "v0.5.0 候補: dryRunOnly: false 移行 / Secret Manager 本格接続",
  };
}

if (require.main === module) {
  const result = generateProductionCutoverPack();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateProductionCutoverPack,
  generateGoNoGoChecklist,
  generateRollbackWindowPlan,
  generatePostCutoverMonitoringPlan,
};
