"use strict";

// KOSAME Cloud Run PM Agent — Final Deploy Readiness Check (v0.3.0)
// Checks all prerequisites for v0.4.0 first Cloud Run deploy.
// Does NOT execute gcloud/docker. Does NOT read .env/secrets. No external API calls.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function makeCheck(name, passed, detail) {
  return { name, passed, detail: detail || null };
}

function checkDeployExecutionDocs() {
  const docs = [
    "docs/ai-dev-team/cloud-run-deploy-execution-pack-v0.3.0.md",
    "docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md",
    "docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md",
    "docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md",
    "docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md",
    "docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md",
    "docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md",
    "docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md",
  ];
  return docs.map(rel => makeCheck(`docs:${path.basename(rel)}:exists`, fileExists(rel)));
}

function checkDeployTools() {
  const tools = [
    "tools/pm-agent-deploy-approval-packet.js",
    "tools/pm-agent-runtime-ops-packet.js",
    "tools/pm-agent-webhook-contract-generator.js",
    "tools/pm-agent-first-deploy-command-pack.js",
    "tools/pm-agent-first-deploy-result-template.js",
  ];
  return tools.map(rel => makeCheck(`tool:${path.basename(rel)}:exists`, fileExists(rel)));
}

function checkPackageScripts() {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch (e) {
    return [makeCheck("package.json:readable", false, e.message)];
  }
  const scripts = pkg.scripts || {};
  const required = [
    "pm-agent:deploy-approval-packet",
    "pm-agent:deploy-readiness-final-check",
    "pm-agent:runtime-ops-packet",
    "pm-agent:webhook-contract",
    "pm-agent:first-deploy-command-pack",
    "pm-agent:first-deploy-result-template",
    "smoke:cloud-run-deploy-execution-pack",
    "smoke:runtime-ops-pack",
    "smoke:webhook-connection-readiness",
    "smoke:first-deploy-command-pack",
  ];
  const checks = required.map(s => makeCheck(`package.json:scripts:${s}`, !!scripts[s]));
  const verify = scripts["verify"] || "";
  for (const s of ["smoke:cloud-run-deploy-execution-pack", "smoke:runtime-ops-pack", "smoke:webhook-connection-readiness", "smoke:first-deploy-command-pack"]) {
    checks.push(makeCheck(`package.json:verify includes ${s}`, verify.includes(s)));
  }
  return checks;
}

function checkLaunchPackIntegrity() {
  const v023files = [
    "Dockerfile",
    ".dockerignore",
    "cloud-run/pm-agent-service.template.yaml",
    "tools/pm-agent-cloud-run-preflight.js",
    "tools/pm-agent-deploy-command-generator.js",
    "tools/pm-agent-post-deploy-smoke.js",
  ];
  return v023files.map(rel => makeCheck(`v0.2.3:${rel}:exists`, fileExists(rel)));
}

function runFinalDeployReadinessCheck() {
  const allChecks = [
    ...checkDeployExecutionDocs(),
    ...checkDeployTools(),
    ...checkPackageScripts(),
    ...checkLaunchPackIntegrity(),
  ];

  const passed = allChecks.filter(c => c.passed);
  const failed = allChecks.filter(c => !c.passed);
  const ready = failed.length === 0;

  return {
    success: true,
    dryRun: true,
    humanApprovalRequired: true,
    readyForHumanDeploy: ready,
    firstDeployCommandPackReady: fileExists("tools/pm-agent-first-deploy-command-pack.js"),
    runtimeOpsReady: fileExists("docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md"),
    webhookReadinessReady: fileExists("docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md"),
    checks: allChecks,
    summary: {
      total: allChecks.length,
      passed: passed.length,
      failed: failed.length,
      failedNames: failed.map(c => c.name),
    },
    nextAction: "じゅんやさんが Cloud Shell で node tools/pm-agent-first-deploy-command-pack.js を確認後、deploy コマンドを実行",
    version: "v0.3.0",
    nextVersion: "v0.4.0",
    blockedActions: [
      "gcloud run deploy",
      "docker build",
      "Secret Manager value read",
      "git push / git tag",
      "npm install (in CI with secrets)",
    ],
    nextHumanApprovalRequiredFor: [
      "Cloud Run deploy (gcloud run deploy)",
      "docker build and push",
      "Secret Manager API key registration",
      "git push / git tag for v0.4.0",
      "billing confirmation",
    ],
  };
}

if (require.main === module) {
  const result = runFinalDeployReadinessCheck();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.readyForHumanDeploy ? 0 : 1);
}

module.exports = {
  runFinalDeployReadinessCheck,
  checkDeployExecutionDocs,
  checkDeployTools,
  checkPackageScripts,
  checkLaunchPackIntegrity,
};
