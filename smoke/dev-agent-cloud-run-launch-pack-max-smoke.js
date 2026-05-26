"use strict";

// Smoke test for v0.2.3 Cloud Run Launch Pack MAX.
// Verifies all Launch Pack components exist, are safe, and work correctly.
// Does NOT call any external API. Does NOT read secrets. Does NOT deploy.

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`);
  failed++;
}

function checkFile(label, relPath) {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) { ok(`${label}: exists`); return true; }
  fail(`${label}: exists`, `not found at ${relPath}`);
  return false;
}

function checkContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    if (content.includes(keyword)) ok(label);
    else fail(label);
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

function checkNotContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} does NOT contain "${keyword}"`;
  try {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    if (!content.includes(keyword)) ok(label);
    else fail(label, "found forbidden pattern");
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

const ROOT = path.resolve(__dirname, "..");

async function main() {
  console.log("===== dev-agent-cloud-run-launch-pack-max smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("Dockerfile", "Dockerfile");
  checkFile(".dockerignore", ".dockerignore");
  checkFile("cloud-run/pm-agent-service.template.yaml", "cloud-run/pm-agent-service.template.yaml");
  checkFile("cloud-run/README.md", "cloud-run/README.md");
  checkFile("tools/pm-agent-cloud-run-preflight.js", "tools/pm-agent-cloud-run-preflight.js");
  checkFile("tools/pm-agent-deploy-command-generator.js", "tools/pm-agent-deploy-command-generator.js");
  checkFile("tools/pm-agent-post-deploy-smoke.js", "tools/pm-agent-post-deploy-smoke.js");
  checkFile("docs/cloud-run-launch-pack-max-v0.2.3.md", "docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md");
  checkFile("docs/cloud-run-deploy-runbook-v0.2.3.md", "docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md");
  checkFile("docs/cloud-run-rollback-runbook-v0.2.3.md", "docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md");
  checkFile("docs/cloud-run-human-approval-packet-v0.2.3.md", "docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md");
  checkFile(".github/workflows/pm-agent-launch-readiness.yml", ".github/workflows/pm-agent-launch-readiness.yml");

  // --- Dockerfile safety ---
  console.log("--- Dockerfile safety checks ---");
  checkContains("Dockerfile", "Dockerfile", "EXPOSE 8080");
  checkContains("Dockerfile", "Dockerfile", "pm-agent:http-dry-run");
  checkNotContains("Dockerfile", "Dockerfile", "gcloud deploy");
  checkNotContains("Dockerfile", "Dockerfile", ".env");
  checkNotContains("Dockerfile", "Dockerfile", "OPENAI_API_KEY");
  checkNotContains("Dockerfile", "Dockerfile", "GEMINI_API_KEY");

  // --- .dockerignore safety ---
  console.log("--- .dockerignore safety checks ---");
  checkContains(".dockerignore", ".dockerignore", ".env");
  checkContains(".dockerignore", ".dockerignore", "node_modules");
  checkContains(".dockerignore", ".dockerignore", ".git");

  // --- service template safety ---
  console.log("--- service template safety checks ---");
  checkContains("service-template", "cloud-run/pm-agent-service.template.yaml", "PLACEHOLDER");
  checkContains("service-template", "cloud-run/pm-agent-service.template.yaml", "SERVICE_NAME_PLACEHOLDER");
  checkContains("service-template", "cloud-run/pm-agent-service.template.yaml", "IMAGE_PLACEHOLDER");
  checkNotContains("service-template", "cloud-run/pm-agent-service.template.yaml", "sk-");
  checkNotContains("service-template", "cloud-run/pm-agent-service.template.yaml", "AIza");
  checkNotContains("service-template", "cloud-run/pm-agent-service.template.yaml", "ya29.");

  // --- GitHub Actions workflow safety ---
  console.log("--- workflow safety checks ---");
  checkNotContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "gcloud run deploy");
  checkNotContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "docker build");
  checkNotContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "gcloud deploy");
  checkNotContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "secrets.");
  checkContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "npm run verify");
  checkContains("workflow", ".github/workflows/pm-agent-launch-readiness.yml", "pm-agent:cloud-run-preflight");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of [
      "smoke:cloud-run-launch-pack-max",
      "pm-agent:cloud-run-preflight",
      "pm-agent:deploy-commands",
      "pm-agent:post-deploy-smoke",
    ]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:cloud-run-launch-pack-max"))
      ok("package.json verify includes smoke:cloud-run-launch-pack-max");
    else
      fail("package.json verify includes smoke:cloud-run-launch-pack-max");
  }

  // --- preflight module ---
  console.log("--- preflight module checks ---");
  let preflightMod;
  try {
    preflightMod = require(path.join(ROOT, "tools/pm-agent-cloud-run-preflight.js"));
    ok("require pm-agent-cloud-run-preflight.js");
  } catch (e) { fail("require pm-agent-cloud-run-preflight.js", e.message); }

  if (preflightMod) {
    for (const fn of [
      "runCloudRunLaunchPreflight", "checkRequiredFiles", "checkPackageScripts",
      "checkDockerfileSafety", "checkDockerignoreSafety", "checkServiceTemplateSafety",
      "checkWorkflowSafety", "checkDocsReadiness",
    ]) {
      if (typeof preflightMod[fn] === "function") ok(`preflight.${fn}: exported`);
      else fail(`preflight.${fn}: exported`);
    }

    try {
      const result = preflightMod.runCloudRunLaunchPreflight();
      if (result.dryRun === true) ok("runCloudRunLaunchPreflight dryRun: true");
      else fail("runCloudRunLaunchPreflight dryRun: true", `got: ${result.dryRun}`);
      if (result.launchReady === true) ok("runCloudRunLaunchPreflight launchReady: true");
      else fail("runCloudRunLaunchPreflight launchReady: true", `failed checks: ${JSON.stringify(result.summary && result.summary.failedNames)}`);
      if (result.deployReadyAfterHumanApproval === true) ok("runCloudRunLaunchPreflight deployReadyAfterHumanApproval: true");
      else fail("runCloudRunLaunchPreflight deployReadyAfterHumanApproval: true");
      if (Array.isArray(result.blockedActions) && result.blockedActions.length > 0)
        ok("runCloudRunLaunchPreflight blockedActions: non-empty array");
      else fail("runCloudRunLaunchPreflight blockedActions: non-empty array");
      const blockedStr = (result.blockedActions || []).join(" ").toLowerCase();
      for (const kw of ["deploy", "secret", "billing"]) {
        if (blockedStr.includes(kw)) ok(`blockedActions includes "${kw}"`);
        else fail(`blockedActions includes "${kw}"`, blockedStr);
      }
      if (Array.isArray(result.nextHumanApprovalRequiredFor) && result.nextHumanApprovalRequiredFor.length > 0)
        ok("runCloudRunLaunchPreflight nextHumanApprovalRequiredFor: non-empty array");
      else fail("runCloudRunLaunchPreflight nextHumanApprovalRequiredFor: non-empty array");
      const approvalStr = (result.nextHumanApprovalRequiredFor || []).join(" ").toLowerCase();
      for (const kw of ["cloud run", "secret manager", "billing", "git push"]) {
        if (approvalStr.includes(kw)) ok(`nextHumanApprovalRequiredFor includes "${kw}"`);
        else fail(`nextHumanApprovalRequiredFor includes "${kw}"`, approvalStr);
      }
    } catch (e) { fail("runCloudRunLaunchPreflight: executes without throw", e.message); }
  }

  // --- deploy command generator ---
  console.log("--- deploy command generator checks ---");
  let deployGenMod;
  try {
    deployGenMod = require(path.join(ROOT, "tools/pm-agent-deploy-command-generator.js"));
    ok("require pm-agent-deploy-command-generator.js");
  } catch (e) { fail("require pm-agent-deploy-command-generator.js", e.message); }

  if (deployGenMod) {
    for (const fn of [
      "generateCloudRunDeployCommands", "generateCloudBuildCommand",
      "generatePostDeploySmokeCommands", "generateLaunchChecklist", "generateRollbackChecklist",
    ]) {
      if (typeof deployGenMod[fn] === "function") ok(`deployGen.${fn}: exported`);
      else fail(`deployGen.${fn}: exported`);
    }

    try {
      const result = deployGenMod.generateCloudRunDeployCommands();
      if (result && (Array.isArray(result.commands) || typeof result === "object"))
        ok("generateCloudRunDeployCommands: returns object with commands");
      else fail("generateCloudRunDeployCommands: returns object with commands", JSON.stringify(result));
    } catch (e) { fail("generateCloudRunDeployCommands: executes", e.message); }

    // Must NOT use exec/execSync/spawn/child_process
    const genSrc = path.join(ROOT, "tools/pm-agent-deploy-command-generator.js");
    checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "child_process");
    checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "execSync");
    checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "exec(");
    checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "spawn(");
  }

  // --- post-deploy smoke module ---
  console.log("--- post-deploy smoke module checks ---");
  let postSmokeMod;
  try {
    postSmokeMod = require(path.join(ROOT, "tools/pm-agent-post-deploy-smoke.js"));
    ok("require pm-agent-post-deploy-smoke.js");
  } catch (e) { fail("require pm-agent-post-deploy-smoke.js", e.message); }

  if (postSmokeMod) {
    if (typeof postSmokeMod.runPostDeploySmoke === "function")
      ok("runPostDeploySmoke: exported");
    else fail("runPostDeploySmoke: exported");
    if (typeof postSmokeMod.validateServiceUrl === "function")
      ok("validateServiceUrl: exported");
    else fail("validateServiceUrl: exported");
  }

  // --- post-deploy smoke: run against local server ---
  console.log("--- post-deploy smoke: local server integration ---");
  const { createServer } = require(path.join(ROOT, "apps/pm-agent/pm-agent-http-server.js"));
  if (postSmokeMod && typeof postSmokeMod.runPostDeploySmoke === "function") {
    let server;
    try {
      server = createServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = server.address().port;
      const localUrl = `http://127.0.0.1:${port}`;
      ok(`local server started on port ${port}`);

      const result = await postSmokeMod.runPostDeploySmoke(localUrl);
      if (result.dryRun === true) ok("runPostDeploySmoke result.dryRun: true");
      else fail("runPostDeploySmoke result.dryRun: true", `got: ${result.dryRun}`);
      if (result.success === true) ok("runPostDeploySmoke result.success: true");
      else fail("runPostDeploySmoke result.success: true", `failed: ${JSON.stringify(result.checks && result.checks.filter(c => !c.passed))}`);
    } catch (e) {
      fail("runPostDeploySmoke local server integration", e.message);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      ok("local server closed");
    }
  }

  // --- source safety: pm-agent-http-server.js ---
  console.log("--- source safety: pm-agent-http-server.js ---");
  checkNotContains("pm-agent-http-server", "apps/pm-agent/pm-agent-http-server.js", "fetch(");
  checkNotContains("pm-agent-http-server", "apps/pm-agent/pm-agent-http-server.js", "require('dotenv')");
  checkNotContains("pm-agent-http-server", "apps/pm-agent/pm-agent-http-server.js", 'require("dotenv")');
  checkNotContains("pm-agent-http-server", "apps/pm-agent/pm-agent-http-server.js", "SecretManagerServiceClient");
  checkNotContains("pm-agent-http-server", "apps/pm-agent/pm-agent-http-server.js", "readFileSync('.env')");

  // --- source safety: pm-agent-http-client.js ---
  console.log("--- source safety: pm-agent-http-client.js ---");
  checkNotContains("pm-agent-http-client", "tools/pm-agent-http-client.js", "fetch(");
  checkNotContains("pm-agent-http-client", "tools/pm-agent-http-client.js", "SecretManagerServiceClient");
  checkNotContains("pm-agent-http-client", "tools/pm-agent-http-client.js", "require('dotenv')");
  checkNotContains("pm-agent-http-client", "tools/pm-agent-http-client.js", 'require("dotenv")');

  // --- source safety: deploy-command-generator.js ---
  console.log("--- source safety: deploy-command-generator.js ---");
  checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "exec(");
  checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "execSync");
  checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "spawn(");
  checkNotContains("deploy-command-generator", "tools/pm-agent-deploy-command-generator.js", "child_process");

  // --- docs content checks ---
  console.log("--- docs content checks ---");
  const docsChecks = [
    ["docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md", [
      "Cloud Run", "Human Approval", "Secret Manager", "GitHub Actions",
      "じゅんやさんをコピペ作業員にしない", "危険箇所だけガード",
      "deployしない", "APIを実行しない",
    ]],
    ["docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md", [
      "Cloud Run", "Human Approval", "じゅんやさん", "Secret Manager", "billing",
    ]],
    ["docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md", [
      "Cloud Run", "Human Approval", "billing", "Secret Manager", "smoke",
    ]],
    ["docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md", [
      "Cloud Run", "rollback", "Human Approval", "smoke",
    ]],
  ];
  for (const [relPath, keywords] of docsChecks) {
    const name = path.basename(relPath);
    for (const kw of keywords) {
      checkContains(name, relPath, kw);
    }
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke fatal error:", e);
  process.exit(1);
});
