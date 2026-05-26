"use strict";

// KOSAME Cloud Run PM Agent — Runtime Ops Packet (v0.3.0)
// Generates runtime operations reference packet and incident response packet.
// No external API calls. No .env/secrets. No gcloud execution.

function generateRuntimeOpsPacket(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Cloud Run PM Agent — Runtime Ops Packet (v0.3.0)",
    dryRun: true,
    serviceName,
    region,
    projectId,
    serviceUrl,
    healthCheckEndpoint: `${serviceUrl}/health`,
    infoEndpoint: `${serviceUrl}/info`,
    dryRunTaskEndpoint: `${serviceUrl}/dry-run-task`,
    ops: {
      checkHealth: `curl -s ${serviceUrl}/health | jq .`,
      checkInfo: `curl -s ${serviceUrl}/info | jq .`,
      viewLogs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${serviceName}" --project ${projectId} --limit 50 --format json`,
      scaleDown: `gcloud run services update ${serviceName} --region ${region} --project ${projectId} --max-instances 0`,
      scaleUp: `gcloud run services update ${serviceName} --region ${region} --project ${projectId} --max-instances 1`,
      deleteService: `gcloud run services delete ${serviceName} --region ${region} --project ${projectId}`,
      listRevisions: `gcloud run revisions list --service ${serviceName} --region ${region} --project ${projectId}`,
      trafficRollback: `gcloud run services update-traffic ${serviceName} --to-revisions PREVIOUS_REVISION=100 --region ${region} --project ${projectId}`,
    },
    billingAlertRecommendation: "Cloud Monitoring で月額予算アラートを設定（推奨: ¥500/月 上限）",
    costOptimization: [
      "min-instances: 0（コールドスタート許容）",
      "max-instances: 1（v0.4.0 初回段階）",
      "未使用時はサービス削除を検討",
    ],
    monitoringChecklist: [
      "[ ] Cloud Run console: revision healthy",
      "[ ] Billing: no unexpected charges",
      "[ ] Error rate < 1%",
      "[ ] Latency p99 < 5s",
    ],
    safetyGates: [
      "gcloud delete はじゅんやさん承認後のみ実行",
      "scale-down/up もじゅんやさん確認後のみ実行",
      "Secret Manager の値変更はじゅんやさん承認後のみ",
    ],
    note: "EXECUTE ONLY AFTER Human Approval. Do NOT run in v0.3.0.",
  };
}

function generateIncidentResponsePacket(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Incident Response Packet — Cloud Run PM Agent (v0.3.0)",
    dryRun: true,
    incidentLevels: {
      P1: "サービス停止 / 課金異常",
      P2: "smoke 失敗 / /health 200以外",
      P3: "レイテンシ増加 / エラーレート上昇",
    },
    responseSteps: {
      P1: [
        "1. gcloud run services describe で状態確認",
        "2. 旧 revision へ traffic rollback",
        "3. 必要なら gcloud run services delete でサービス停止",
        "4. 課金アラート確認・billing 停止",
        "5. じゅんやさんに即時報告",
      ],
      P2: [
        "1. node tools/pm-agent-post-deploy-smoke.js で smoke 確認",
        "2. ログ確認: gcloud logging read",
        "3. 旧 revision へ rollback 検討",
      ],
      P3: [
        "1. ログ確認",
        "2. 原因特定後、redeploy 判断",
        "3. docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md 参照",
      ],
    },
    rollbackCommand: [
      `gcloud run services update-traffic ${serviceName} \\`,
      `  --to-revisions PREVIOUS_REVISION=100 \\`,
      `  --region ${region} \\`,
      `  --project ${projectId}`,
    ],
    note: "EXECUTE ONLY WITH Human Approval.",
  };
}

if (require.main === module) {
  const result = {
    runtimeOps: generateRuntimeOpsPacket(),
    incidentResponse: generateIncidentResponsePacket(),
  };
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { generateRuntimeOpsPacket, generateIncidentResponsePacket };
