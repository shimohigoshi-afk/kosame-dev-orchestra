"use strict";

// KOSAME Cloud Run PM Agent — Deploy Approval Packet (v0.3.0)
// Generates a JSON packet for human review before v0.4.0 Cloud Run deploy.
// Does NOT execute gcloud/docker. Does NOT read .env/secrets. No external API calls.

function generateDeployApprovalPacket(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const region = opts.region || "asia-northeast1";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const imageTag = opts.imageTag || "VERSION_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";
  const imageUrl = `${registryHost}/${projectId}/${serviceName}:${imageTag}`;

  return {
    humanApprovalRequired: true,
    readyForHumanDeploy: true,
    version: "v0.3.0",
    nextVersion: "v0.4.0",
    description: "Deploy Approval Packet — v0.3.0. じゅんやさんが確認後 v0.4.0 Cloud Run deploy を実行する。",
    approver: "じゅんやさん",
    approvalStatus: "PENDING",
    deployTarget: {
      serviceName,
      region,
      projectId,
      imageUrl,
      port: 8080,
      maxInstances: 1,
    },
    preDeployChecklist: [
      "[ ] npm run verify → 全 smoke PASS",
      "[ ] npm run pm-agent:deploy-readiness-final-check → readyForHumanDeploy: true",
      "[ ] GitHub Actions pm-agent-launch-readiness.yml → success",
      "[ ] Billing confirmed: GCP billing enabled",
      "[ ] Secret Manager: API keys registered (if needed for v0.4.0)",
      "[ ] Artifact Registry / Container Registry: enabled",
      "[ ] cloud-run/pm-agent-service.template.yaml: PLACEHOLDER 全箇所に実値を準備済み",
      `[ ] GCP project ID confirmed: ${projectId}`,
      `[ ] Region confirmed: ${region}`,
      `[ ] Service name confirmed: ${serviceName}`,
    ],
    deployCommandSource: "node tools/pm-agent-first-deploy-command-pack.js",
    postDeployVerification: "node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>",
    rollbackReadiness: "node tools/pm-agent-deploy-command-generator.js で rollback コマンド生成済み",
    resultRecord: "v0.4.1 で docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md に記録",
    approvalInstruction: "このパケットを確認後、じゅんやさんが Cloud Shell で deploy コマンドを実行してください。",
    blockedUntilApproval: [
      "gcloud builds submit",
      "gcloud run deploy",
      "docker build / docker push",
      "git push / git tag",
      "Secret Manager value read",
      "billing API call",
    ],
    dryRun: true,
  };
}

if (require.main === module) {
  const result = generateDeployApprovalPacket();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { generateDeployApprovalPacket };
