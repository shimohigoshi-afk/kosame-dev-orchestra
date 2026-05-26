"use strict";

// KOSAME Cloud Run PM Agent — First Deploy Result Template (v0.4.1)
// Generates templates for recording v0.4.0 first deploy results.
// Does NOT connect to Cloud Run URL. Does NOT read .env/secrets.

function generateFirstDeployResultTemplate(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "First Cloud Run Deploy Result Record — v0.4.1",
    dryRun: true,
    record: {
      deployVersion: "v0.4.0",
      recordVersion: "v0.4.1",
      deployedAt: "YYYY-MM-DD HH:MM:SS (実行時刻を記録)",
      deployedBy: "じゅんやさん (Cloud Shell)",
      commit: "COMMIT_HASH_PLACEHOLDER",
      serviceName,
      region,
      projectId,
      serviceUrl: "https://SERVICE_URL_PLACEHOLDER",
      imageUrl: `gcr.io/${projectId}/${serviceName}:VERSION_PLACEHOLDER`,
      deployCommandExecuted: "gcloud run deploy ... (実行したコマンドをここに記録)",
      deployStatus: "PENDING (success / failed を記録)",
      smokeResult: {
        runAt: "YYYY-MM-DD HH:MM:SS",
        health: "PENDING (pass / fail)",
        info: "PENDING (pass / fail)",
        dryRunTask_implementation: "PENDING (pass / fail)",
        dryRunTask_critical: "PENDING (pass / fail)",
        overallPass: "PENDING",
      },
      githubActionsResult: {
        workflowName: "pm-agent-launch-readiness",
        result: "PENDING (success / failure)",
        runUrl: "https://github.com/OWNER/REPO/actions/runs/RUN_ID_PLACEHOLDER",
      },
      billingCheck: {
        checkedAt: "YYYY-MM-DD",
        unexpectedCharges: "PENDING (none / amount)",
      },
      rollbackNeeded: "PENDING (no / yes — 理由を記録)",
      issues: "PENDING (none / 問題があれば記録)",
      nextAction: "PENDING (v0.4.1 result record 完了後: n8n接続 / dryRunOnly: false 移行準備 / 等)",
    },
    note: "v0.4.0 deploy 後にこのテンプレートを上書きして記録を残す。",
  };
}

function generatePostDeploySmokeRecordTemplate(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Post-Deploy Smoke Record Template",
    dryRun: true,
    serviceUrl,
    checks: [
      { name: "GET /health → 200", result: "PENDING", detail: null },
      { name: "GET /health body.status === ok", result: "PENDING", detail: null },
      { name: "GET /info → 200", result: "PENDING", detail: null },
      { name: "GET /info body.dryRunOnly === true", result: "PENDING", detail: null },
      { name: "POST /dry-run-task (implementation) → 200", result: "PENDING", detail: null },
      { name: "POST /dry-run-task (implementation) recommendedOwner: claude_code", result: "PENDING", detail: null },
      { name: "POST /dry-run-task (critical) → blocked: true", result: "PENDING", detail: null },
    ],
    summary: {
      total: 7,
      passed: "PENDING",
      failed: "PENDING",
    },
    note: "node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL> を実行して結果を記録する。",
  };
}

function generateDeployTroubleshootingRecordTemplate(options) {
  return {
    description: "Deploy Troubleshooting Record Template",
    dryRun: true,
    troubleshootingSteps: [
      { step: 1, action: "エラーメッセージを確認", result: "PENDING", note: "gcloud logging read で確認" },
      { step: 2, action: "revision の状態確認", result: "PENDING", note: "gcloud run revisions list で確認" },
      { step: 3, action: "rollback 判断", result: "PENDING", actionTaken: "PENDING" },
      { step: 4, action: "smoke 再確認", result: "PENDING", smokeResult: "PENDING" },
      { step: 5, action: "billing 確認", result: "PENDING", billingStatus: "PENDING" },
    ],
    resolution: "PENDING (resolved / ongoing — 詳細を記録)",
    note: "問題が発生した場合のみ使用する。",
  };
}

if (require.main === module) {
  const result = {
    firstDeployResultTemplate: generateFirstDeployResultTemplate(),
    postDeploySmokeRecordTemplate: generatePostDeploySmokeRecordTemplate(),
    deployTroubleshootingRecordTemplate: generateDeployTroubleshootingRecordTemplate(),
  };
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateFirstDeployResultTemplate,
  generatePostDeploySmokeRecordTemplate,
  generateDeployTroubleshootingRecordTemplate,
};
