"use strict";

// KOSAME Cloud Run PM Agent — Deploy Command Generator (v0.2.3)
// - Generates gcloud / docker command STRINGS only. Does NOT execute anything.
// - Does not execute shell commands. No process-spawn calls. No synchronous shell execution.
// - No .env read. No Secret Manager. No external API calls.
// - Output is for human review and approval before v0.3.0 deploy.

function generateCloudBuildCommand(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const imageTag = opts.imageTag || "TAG_PLACEHOLDER";
  const region = opts.region || "REGION_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";

  const imageUrl = `${registryHost}/${projectId}/kosame-pm-agent:${imageTag}`;

  return {
    description: "Build and push container image to Container Registry",
    commands: [
      `# Option A: Cloud Build (no local Docker needed)`,
      `gcloud builds submit --tag ${imageUrl} --project ${projectId}`,
      ``,
      `# Option B: Local Docker build + push`,
      `docker build -t ${imageUrl} .`,
      `docker push ${imageUrl}`,
    ],
    imageUrl,
    note: "EXECUTE ONLY AFTER Human Approval. Do NOT run in v0.2.3.",
  };
}

function generateCloudRunDeployCommands(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const serviceName = opts.serviceName || "SERVICE_NAME_PLACEHOLDER";
  const region = opts.region || "REGION_PLACEHOLDER";
  const imageTag = opts.imageTag || "TAG_PLACEHOLDER";
  const registryHost = opts.registryHost || "gcr.io";

  const imageUrl = `${registryHost}/${projectId}/kosame-pm-agent:${imageTag}`;

  return {
    description: "Deploy PM Agent to Cloud Run",
    commands: [
      `gcloud run deploy ${serviceName} \\`,
      `  --image ${imageUrl} \\`,
      `  --platform managed \\`,
      `  --region ${region} \\`,
      `  --project ${projectId} \\`,
      `  --port 8080 \\`,
      `  --set-env-vars NODE_ENV=production,PORT=8080 \\`,
      `  --max-instances 1 \\`,
      `  --allow-unauthenticated`,
    ],
    imageUrl,
    serviceName,
    region,
    note: "EXECUTE ONLY AFTER Human Approval. Do NOT run in v0.2.3.",
  };
}

function generatePostDeploySmokeCommands(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "https://SERVICE_URL_PLACEHOLDER";

  return {
    description: "Post-deploy smoke test against Cloud Run URL",
    commands: [
      `node tools/pm-agent-post-deploy-smoke.js ${serviceUrl}`,
      `node tools/pm-agent-http-client.js ${serviceUrl}`,
    ],
    serviceUrl,
    note: "Run immediately after deploy to verify service health.",
  };
}

function generateLaunchChecklist(options) {
  const opts = options || {};
  return {
    description: "Cloud Run Launch Checklist — v0.3.0",
    preDeployChecks: [
      "[ ] npm run verify → all smoke pass",
      "[ ] npm run pm-agent:cloud-run-preflight → launchReady: true",
      "[ ] Billing confirmed: GCP project billing enabled",
      "[ ] Secret Manager: API keys registered (if needed for v0.3.0)",
      "[ ] GitHub Actions: pm-agent-launch-readiness.yml success",
      "[ ] Human Approval: じゅんやさん承認済み",
      "[ ] Artifact Registry / Container Registry: enabled",
      "[ ] cloud-run/pm-agent-service.template.yaml: PLACEHOLDER 全箇所に実値を準備済み",
    ],
    deploySteps: [
      "1. docker build (or Cloud Build)",
      "2. push image to registry",
      "3. gcloud run deploy",
      "4. node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>",
    ],
    postDeployChecks: [
      "[ ] GET /health → { status: 'ok' }",
      "[ ] GET /info → { dryRunOnly: true }",
      "[ ] POST /dry-run-task (implementation) → recommendedOwner: claude_code",
      "[ ] POST /dry-run-task (critical deploy) → blocked: true",
      "[ ] Cloud Run console: revision healthy",
      "[ ] Billing: no unexpected charges",
    ],
    rollbackTrigger: [
      "smoke fail → traffic を旧 revision に戻す",
      "unexpected billing → サービスを即停止して確認",
    ],
    note: "This checklist is for reference only. Execute ONLY after Human Approval in v0.3.0.",
  };
}

function generateRollbackChecklist(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "SERVICE_NAME_PLACEHOLDER";
  const region = opts.region || "REGION_PLACEHOLDER";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";
  const prevRevision = opts.prevRevision || "PREVIOUS_REVISION_PLACEHOLDER";

  return {
    description: "Rollback Checklist — Cloud Run PM Agent",
    triggerConditions: [
      "POST /dry-run-task returns unexpected errors",
      "GET /health returns non-200",
      "Cloud Run revision marked unhealthy",
      "Unexpected billing spike",
    ],
    rollbackCommands: [
      `# List revisions`,
      `gcloud run revisions list --service ${serviceName} --region ${region} --project ${projectId}`,
      ``,
      `# Route 100% traffic to previous revision`,
      `gcloud run services update-traffic ${serviceName} \\`,
      `  --to-revisions ${prevRevision}=100 \\`,
      `  --region ${region} \\`,
      `  --project ${projectId}`,
    ],
    postRollbackChecks: [
      "[ ] node tools/pm-agent-post-deploy-smoke.js <PREVIOUS_URL>",
      "[ ] Cloud Run console: traffic back to prev revision",
      "[ ] Billing: stabilized",
    ],
    note: "EXECUTE ONLY with Human Approval. Rollback requires じゅんやさん判断.",
  };
}

if (require.main === module) {
  const result = {
    cloudBuild: generateCloudBuildCommand(),
    cloudRunDeploy: generateCloudRunDeployCommands(),
    postDeploySmoke: generatePostDeploySmokeCommands(),
    launchChecklist: generateLaunchChecklist(),
    rollbackChecklist: generateRollbackChecklist(),
  };
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateCloudRunDeployCommands,
  generateCloudBuildCommand,
  generatePostDeploySmokeCommands,
  generateLaunchChecklist,
  generateRollbackChecklist,
};
