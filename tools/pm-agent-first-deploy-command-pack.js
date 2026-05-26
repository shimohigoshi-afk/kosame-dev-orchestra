"use strict";

// KOSAME Cloud Run PM Agent — First Deploy Command Pack (v0.3.0 / v0.4.0)
// Generates the complete set of commands for v0.4.0 first Cloud Run deploy.
// IMPORTANT: Generates command STRINGS only. Does NOT execute anything.
// All commands must be reviewed and executed by じゅんやさん in Cloud Shell.
// Does not use process-spawn calls or synchronous shell execution.
// Does not read dotenv files, Secret Manager, or any credentials.

function generateCloudBuildSubmitCommand(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const serviceName = opts.serviceName || "pm-agent";
  const imageTag = opts.imageTag || "VERSION_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";
  const imageUrl = `${registryHost}/${projectId}/${serviceName}:${imageTag}`;

  return {
    description: "Build and push container image via Cloud Build",
    note: "じゅんやさんが確認してから実行してください。このツールはコマンドを生成するだけで実行しません。",
    imageUrl,
    commands: [
      `# Cloud Build でビルド & push（Cloud Shell から実行）`,
      `gcloud builds submit --tag ${imageUrl} --project ${projectId}`,
    ],
    alternativeLocalDocker: [
      `# ローカル Docker の場合（Cloud Build 推奨）`,
      `docker build -t ${imageUrl} .`,
      `docker push ${imageUrl}`,
    ],
    prereqs: [
      "Artifact Registry / Container Registry が有効化済み",
      `GCP project: ${projectId}`,
      "gcloud auth が完了済み",
    ],
  };
}

function generateCloudRunDeployCommand(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const imageTag = opts.imageTag || "VERSION_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";
  const port = opts.port || 8080;
  const imageUrl = `${registryHost}/${projectId}/${serviceName}:${imageTag}`;

  return {
    description: "Deploy PM Agent to Cloud Run",
    note: "じゅんやさんが確認してから実行してください。このツールはコマンドを生成するだけで実行しません。",
    imageUrl,
    serviceName,
    region,
    projectId,
    commands: [
      `gcloud run deploy ${serviceName} \\`,
      `  --image ${imageUrl} \\`,
      `  --platform managed \\`,
      `  --region ${region} \\`,
      `  --project ${projectId} \\`,
      `  --port ${port} \\`,
      `  --set-env-vars NODE_ENV=production,PORT=${port} \\`,
      `  --max-instances 1 \\`,
      `  --allow-unauthenticated`,
    ],
    postDeployVerify: [
      `# deploy 後にサービス URL を取得`,
      `gcloud run services describe ${serviceName} --region ${region} --project ${projectId} --format "value(status.url)"`,
      `# smoke 確認`,
      `node tools/pm-agent-post-deploy-smoke.js SERVICE_URL_PLACEHOLDER`,
    ],
  };
}

function generatePostDeploySmokeCommand(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Post-deploy smoke test commands",
    note: "deploy 直後に実行してサービスの健全性を確認する。",
    serviceUrl,
    commands: [
      `# smoke スクリプト実行`,
      `node tools/pm-agent-post-deploy-smoke.js ${serviceUrl}`,
      ``,
      `# 手動確認`,
      `curl -s ${serviceUrl}/health | jq .`,
      `curl -s ${serviceUrl}/info | jq .`,
    ],
    expectedResults: [
      "GET /health → 200 { status: 'ok' }",
      "GET /info → 200 { dryRunOnly: true }",
      "POST /dry-run-task (implementation) → { success: true, decision.recommendedOwner: 'claude_code' }",
      "POST /dry-run-task (critical deploy) → { decision.blocked: true }",
    ],
  };
}

function generateRollbackCandidateCommands(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const prevRevision = opts.prevRevision || "PREVIOUS_REVISION_PLACEHOLDER";

  return {
    description: "Rollback candidate commands (in case of deploy failure)",
    note: "じゅんやさんが確認してから実行してください。このツールはコマンドを生成するだけで実行しません。",
    triggerConditions: [
      "smoke fail → /health が 200 を返さない",
      "revision が unhealthy 状態",
      "予期しない billing スパイク",
    ],
    commands: [
      `# revision 一覧確認`,
      `gcloud run revisions list --service ${serviceName} --region ${region} --project ${projectId}`,
      ``,
      `# 旧 revision へ traffic を戻す`,
      `gcloud run services update-traffic ${serviceName} \\`,
      `  --to-revisions ${prevRevision}=100 \\`,
      `  --region ${region} \\`,
      `  --project ${projectId}`,
      ``,
      `# 完全削除（課金停止用・最終手段）`,
      `gcloud run services delete ${serviceName} --region ${region} --project ${projectId}`,
    ],
    postRollbackSmoke: [
      "[ ] node tools/pm-agent-post-deploy-smoke.js <PREVIOUS_URL>",
      "[ ] Cloud Run console で traffic が旧 revision に戻ったことを確認",
      "[ ] billing が安定していることを確認",
    ],
  };
}

function generateHumanExecutionOrder(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const imageTag = opts.imageTag || "VERSION_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";
  const imageUrl = `${registryHost}/${projectId}/${serviceName}:${imageTag}`;

  return {
    description: "Human Execution Order — v0.4.0 First Cloud Run Deploy",
    note: "じゅんやさんが Cloud Shell で順番通りに実行してください。このツールはコマンドを生成するだけで実行しません。",
    approver: "じゅんやさん",
    steps: [
      {
        step: 1,
        action: "前提確認",
        commands: [
          "npm run verify",
          "npm run pm-agent:deploy-readiness-final-check",
        ],
        successCriteria: "全 smoke PASS / readyForHumanDeploy: true",
      },
      {
        step: 2,
        action: "Cloud Build でイメージ作成",
        commands: [
          `gcloud builds submit --tag ${imageUrl} --project ${projectId}`,
        ],
        successCriteria: "build SUCCESS",
      },
      {
        step: 3,
        action: "Cloud Run deploy",
        commands: [
          `gcloud run deploy ${serviceName} --image ${imageUrl} --platform managed --region ${region} --project ${projectId} --port 8080 --set-env-vars NODE_ENV=production,PORT=8080 --max-instances 1 --allow-unauthenticated`,
        ],
        successCriteria: "Service deployed to https://...",
      },
      {
        step: 4,
        action: "Service URL 取得",
        commands: [
          `gcloud run services describe ${serviceName} --region ${region} --project ${projectId} --format "value(status.url)"`,
        ],
        successCriteria: "URL が表示される",
      },
      {
        step: 5,
        action: "Post-deploy smoke",
        commands: [
          "node tools/pm-agent-post-deploy-smoke.js SERVICE_URL_PLACEHOLDER",
        ],
        successCriteria: "全 checks passed",
      },
      {
        step: 6,
        action: "結果記録",
        commands: [
          "node tools/pm-agent-first-deploy-result-template.js",
        ],
        successCriteria: "テンプレート出力 → docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md に記録",
      },
    ],
    rollbackIfFailed: "generateRollbackCandidateCommands() を参照",
    billingAlert: "deploy 後は必ず GCP billing console で課金状況を確認する",
  };
}

function generateFirstDeployCommandPack(options) {
  const opts = options || {};
  return {
    description: "First Deploy Command Pack — v0.4.0 Cloud Run PM Agent",
    dryRun: true,
    generatedAt: new Date().toISOString(),
    generationPolicy: "Generates command strings only. Does not execute shell commands. No process spawning.",
    note: "全コマンドは文字列生成のみ。実行はじゅんやさんが Cloud Shell で行う。AIは実行しない。",
    cloudBuildSubmit: generateCloudBuildSubmitCommand(opts),
    cloudRunDeploy: generateCloudRunDeployCommand(opts),
    postDeploySmoke: generatePostDeploySmokeCommand(opts),
    rollbackCandidates: generateRollbackCandidateCommands(opts),
    humanExecutionOrder: generateHumanExecutionOrder(opts),
    nextVersion: "v0.4.0",
  };
}

if (require.main === module) {
  const result = generateFirstDeployCommandPack();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateFirstDeployCommandPack,
  generateCloudBuildSubmitCommand,
  generateCloudRunDeployCommand,
  generatePostDeploySmokeCommand,
  generateRollbackCandidateCommands,
  generateHumanExecutionOrder,
};
