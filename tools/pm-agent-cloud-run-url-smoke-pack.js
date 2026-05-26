"use strict";

// KOSAME Cloud Run PM Agent — Cloud Run URL Smoke Pack (v0.4.1)
// Generates smoke check command strings for verifying Cloud Run URL after deploy.
// Does NOT execute HTTP requests. No dotenv files. No credential access.
// Does not use process-spawn calls or synchronous shell execution.

function generateHealthSmokeCommand(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Health check smoke command for Cloud Run PM Agent",
    dryRun: true,
    serviceUrl,
    curlCommand: `curl -s ${serviceUrl}/health | jq .`,
    nodeCommand: `node tools/pm-agent-post-deploy-smoke.js ${serviceUrl}`,
    expectedStatus: 200,
    expectedBody: { status: "ok" },
    note: "Run after deploy. Verify manually or via smoke script. Does not execute automatically.",
  };
}

function generateInfoSmokeCommand(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Info endpoint smoke command for Cloud Run PM Agent",
    dryRun: true,
    serviceUrl,
    curlCommand: `curl -s ${serviceUrl}/info | jq .`,
    expectedStatus: 200,
    expectedBody: { dryRunOnly: true },
    note: "Verify that dryRunOnly: true is returned. Does not execute automatically.",
  };
}

function generateDryRunTaskSmokeCommand(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  const implPayload = JSON.stringify({
    id: "SMOKE-URL-001",
    title: "URL smoke implementation task",
    kind: "implementation",
    riskLevel: "low",
    targetRepo: "kosame-dev-orchestra",
    context: "Post-deploy URL smoke",
  });

  const criticalPayload = JSON.stringify({
    id: "SMOKE-URL-002",
    title: "URL smoke critical task",
    kind: "deploy",
    riskLevel: "critical",
    targetRepo: "kosame-dev-orchestra",
    context: "Post-deploy URL smoke — must be blocked",
  });

  return {
    description: "dry-run-task smoke commands for Cloud Run PM Agent",
    dryRun: true,
    serviceUrl,
    implementationTask: {
      curlCommand: `curl -s -X POST ${serviceUrl}/dry-run-task -H "Content-Type: application/json" -d '${implPayload}' | jq .`,
      expectedResult: { success: true, dryRun: true, "decision.recommendedOwner": "claude_code" },
    },
    criticalTask: {
      curlCommand: `curl -s -X POST ${serviceUrl}/dry-run-task -H "Content-Type: application/json" -d '${criticalPayload}' | jq .`,
      expectedResult: { "decision.blocked": true },
    },
    nodeSmoke: `node tools/pm-agent-post-deploy-smoke.js ${serviceUrl}`,
    note: "Run after deploy. Does not execute automatically.",
  };
}

function generateSmokeResultRecordTemplate(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "Cloud Run URL smoke result record template",
    dryRun: true,
    serviceUrl,
    runAt: "YYYY-MM-DD HH:MM:SS",
    smokeScript: `node tools/pm-agent-post-deploy-smoke.js ${serviceUrl}`,
    checks: [
      { name: "GET /health → 200", result: "PENDING", detail: null },
      { name: "GET /health body.status === ok", result: "PENDING", detail: null },
      { name: "GET /info → 200", result: "PENDING", detail: null },
      { name: "GET /info body.dryRunOnly === true", result: "PENDING", detail: null },
      { name: "POST /dry-run-task (implementation) → recommendedOwner: claude_code", result: "PENDING", detail: null },
      { name: "POST /dry-run-task (critical) → blocked: true", result: "PENDING", detail: null },
    ],
    summary: { total: 6, passed: "PENDING", failed: "PENDING" },
    overallResult: "PENDING (pass / fail)",
    nextAction: "PENDING (all pass → v0.4.2 n8n接続 / fail → rollback検討)",
    rollbackNote: "smoke 失敗時: docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md 参照",
  };
}

function generateCloudRunUrlSmokePack(options) {
  const opts = options || {};

  return {
    description: "Cloud Run URL Smoke Pack — v0.4.1",
    dryRun: true,
    humanApprovalRequired: true,
    generationPolicy: "Generates command strings only. Does not execute any HTTP requests. No process spawning.",
    note: "deploy 後に Cloud Run URL を取得してから各コマンドを実行する。AIは実行しない。",
    healthSmoke: generateHealthSmokeCommand(opts),
    infoSmoke: generateInfoSmokeCommand(opts),
    dryRunTaskSmoke: generateDryRunTaskSmokeCommand(opts),
    smokeResultTemplate: generateSmokeResultRecordTemplate(opts),
    smokeOrderRecommendation: [
      "1. node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>",
      "2. 全 checks PASS → v0.4.2 n8n 接続準備へ",
      "3. 失敗 → rollback 検討",
    ],
    nextVersion: "v0.4.2",
  };
}

if (require.main === module) {
  const result = generateCloudRunUrlSmokePack();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateCloudRunUrlSmokePack,
  generateHealthSmokeCommand,
  generateInfoSmokeCommand,
  generateDryRunTaskSmokeCommand,
  generateSmokeResultRecordTemplate,
};
