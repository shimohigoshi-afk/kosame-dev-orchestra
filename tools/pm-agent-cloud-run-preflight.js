"use strict";

// KOSAME Cloud Run PM Agent — Cloud Run Launch Preflight (v0.2.3)
// - Node standard modules only. No external API calls. No fetch.
// - Does NOT read .env / secrets. Does NOT run gcloud. Does NOT run docker build.
// - Returns a JSON result object describing launch readiness.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function fileContains(relPath, keyword) {
  try {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    return content.includes(keyword);
  } catch (_) {
    return false;
  }
}

function fileNotContains(relPath, keyword) {
  return !fileContains(relPath, keyword);
}

function makeCheck(name, passed, detail) {
  return { name, passed, detail: detail || null };
}

function checkRequiredFiles() {
  const checks = [];
  const required = [
    ["Dockerfile", "Dockerfile"],
    [".dockerignore", ".dockerignore"],
    ["cloud-run/pm-agent-service.template.yaml", "cloud-run/pm-agent-service.template.yaml"],
    ["cloud-run/README.md", "cloud-run/README.md"],
    ["apps/pm-agent/pm-agent-http-server.js", "apps/pm-agent/pm-agent-http-server.js"],
    ["tools/pm-agent-http-client.js", "tools/pm-agent-http-client.js"],
    ["tools/pm-agent-deploy-command-generator.js", "tools/pm-agent-deploy-command-generator.js"],
    ["tools/pm-agent-post-deploy-smoke.js", "tools/pm-agent-post-deploy-smoke.js"],
    ["fixtures/pm-agent/sample-implementation-task.json", "fixtures/pm-agent/sample-implementation-task.json"],
    ["fixtures/pm-agent/sample-docs-task.json", "fixtures/pm-agent/sample-docs-task.json"],
    ["fixtures/pm-agent/sample-critical-deploy-task.json", "fixtures/pm-agent/sample-critical-deploy-task.json"],
    ["docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md", "docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md"],
    ["docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md", "docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md"],
    ["docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md", "docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md"],
    ["docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md", "docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md"],
    [".github/workflows/pm-agent-launch-readiness.yml", ".github/workflows/pm-agent-launch-readiness.yml"],
  ];
  for (const [label, relPath] of required) {
    checks.push(makeCheck(`file:${label}`, fileExists(relPath), relPath));
  }
  return checks;
}

function checkPackageScripts() {
  const checks = [];
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  } catch (e) {
    return [makeCheck("package.json:readable", false, e.message)];
  }
  const scripts = pkg.scripts || {};
  const required = [
    "dashboard",
    "pm-agent:http-client",
    "smoke:http-request-fixtures-client",
    "smoke:cloud-run-launch-pack-max",
    "pm-agent:cloud-run-preflight",
    "pm-agent:deploy-commands",
    "pm-agent:post-deploy-smoke",
  ];
  for (const s of required) {
    checks.push(makeCheck(`package.json:scripts:${s}`, !!scripts[s]));
  }
  const verify = scripts["verify"] || "";
  checks.push(makeCheck(
    "package.json:verify includes smoke:cloud-run-launch-pack-max",
    verify.includes("smoke:cloud-run-launch-pack-max")
  ));
  return checks;
}

function checkDockerfileSafety() {
  const checks = [];
  const rel = "Dockerfile";
  if (!fileExists(rel)) {
    return [makeCheck("Dockerfile:exists", false)];
  }
  checks.push(makeCheck("Dockerfile:EXPOSE 8080", fileContains(rel, "EXPOSE 8080")));
  checks.push(makeCheck("Dockerfile:CMD npm run dashboard", fileContains(rel, "dashboard")));
  const forbidden = [
    ".env",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "gcloud deploy",
    "printenv",
    "SECRET",
  ];
  for (const kw of forbidden) {
    checks.push(makeCheck(`Dockerfile:no "${kw}"`, fileNotContains(rel, kw)));
  }
  return checks;
}

function checkDockerignoreSafety() {
  const checks = [];
  const rel = ".dockerignore";
  if (!fileExists(rel)) {
    return [makeCheck(".dockerignore:exists", false)];
  }
  for (const required of [".env", "node_modules", ".git"]) {
    checks.push(makeCheck(`.dockerignore includes "${required}"`, fileContains(rel, required)));
  }
  return checks;
}

function checkServiceTemplateSafety() {
  const checks = [];
  const rel = "cloud-run/pm-agent-service.template.yaml";
  if (!fileExists(rel)) {
    return [makeCheck("service-template:exists", false)];
  }
  checks.push(makeCheck("service-template:uses PLACEHOLDER", fileContains(rel, "PLACEHOLDER")));
  checks.push(makeCheck("service-template:SERVICE_NAME_PLACEHOLDER", fileContains(rel, "SERVICE_NAME_PLACEHOLDER")));
  checks.push(makeCheck("service-template:IMAGE_PLACEHOLDER", fileContains(rel, "IMAGE_PLACEHOLDER")));
  // Ensure no real API key patterns (common formats)
  const apiKeyPatterns = ["sk-", "AIza", "ya29.", "Bearer "];
  for (const pat of apiKeyPatterns) {
    checks.push(makeCheck(`service-template:no real key pattern "${pat}"`, fileNotContains(rel, pat)));
  }
  return checks;
}

function checkWorkflowSafety() {
  const checks = [];
  const rel = ".github/workflows/pm-agent-launch-readiness.yml";
  if (!fileExists(rel)) {
    return [makeCheck("workflow:exists", false)];
  }
  const forbidden = ["gcloud run deploy", "docker build", "gcloud deploy", "secrets."];
  for (const kw of forbidden) {
    checks.push(makeCheck(`workflow:no "${kw}"`, fileNotContains(rel, kw)));
  }
  checks.push(makeCheck("workflow:npm run verify", fileContains(rel, "npm run verify")));
  checks.push(makeCheck("workflow:pm-agent:cloud-run-preflight", fileContains(rel, "pm-agent:cloud-run-preflight")));
  return checks;
}

function checkDocsReadiness() {
  const checks = [];
  const docs = [
    "docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md",
    "docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md",
    "docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md",
    "docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md",
  ];
  for (const rel of docs) {
    const name = path.basename(rel);
    checks.push(makeCheck(`docs:${name}:exists`, fileExists(rel)));
    if (fileExists(rel)) {
      checks.push(makeCheck(`docs:${name}:contains Cloud Run`, fileContains(rel, "Cloud Run")));
      checks.push(makeCheck(`docs:${name}:contains Human Approval`, fileContains(rel, "Human Approval")));
    }
  }
  return checks;
}

function runCloudRunLaunchPreflight() {
  const allChecks = [
    ...checkRequiredFiles(),
    ...checkPackageScripts(),
    ...checkDockerfileSafety(),
    ...checkDockerignoreSafety(),
    ...checkServiceTemplateSafety(),
    ...checkWorkflowSafety(),
    ...checkDocsReadiness(),
  ];

  const passed = allChecks.filter((c) => c.passed);
  const failed = allChecks.filter((c) => !c.passed);
  const launchReady = failed.length === 0;

  return {
    success: true,
    dryRun: true,
    launchReady,
    deployReadyAfterHumanApproval: launchReady,
    checks: allChecks,
    summary: {
      total: allChecks.length,
      passed: passed.length,
      failed: failed.length,
      failedNames: failed.map((c) => c.name),
    },
    blockedActions: [
      "gcloud run deploy",
      "docker build",
      "Secret Manager value read",
      "production deploy",
      "billing API call",
      "git push / git tag",
      "npm install (in CI with secrets)",
    ],
    nextHumanApprovalRequiredFor: [
      "Cloud Run deploy (gcloud run deploy)",
      "Secret Manager API key registration",
      "docker build and push to Artifact Registry",
      "production traffic cutover",
      "billing confirmation",
      "git push / git tag for v0.3.0",
    ],
    recommendedNextVersion: "v0.3.0",
  };
}

if (require.main === module) {
  const result = runCloudRunLaunchPreflight();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.launchReady ? 0 : 1);
}

module.exports = {
  runCloudRunLaunchPreflight,
  checkRequiredFiles,
  checkPackageScripts,
  checkDockerfileSafety,
  checkDockerignoreSafety,
  checkServiceTemplateSafety,
  checkWorkflowSafety,
  checkDocsReadiness,
};
