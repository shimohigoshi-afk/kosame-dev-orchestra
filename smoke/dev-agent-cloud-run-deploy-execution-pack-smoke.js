"use strict";

// Smoke test for v0.3.0 Cloud Run Deploy Execution Pack.
// Verifies all deploy execution components exist, are safe, and work correctly.
// Does NOT call any external API. Does NOT read secrets. Does NOT deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`); failed++; }

function checkFile(label, relPath) {
  if (fs.existsSync(path.join(ROOT, relPath))) { ok(`${label}: exists`); return true; }
  fail(`${label}: exists`, `not found at ${relPath}`); return false;
}

function checkContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    if (fs.readFileSync(path.join(ROOT, relPath), "utf8").includes(keyword)) ok(label);
    else fail(label);
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

function checkNotContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} does NOT contain "${keyword}"`;
  try {
    if (!fs.readFileSync(path.join(ROOT, relPath), "utf8").includes(keyword)) ok(label);
    else fail(label, "found forbidden pattern");
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

async function main() {
  console.log("===== dev-agent-cloud-run-deploy-execution-pack smoke =====");

  // --- file existence: docs ---
  console.log("--- docs existence checks ---");
  checkFile("cloud-run-deploy-execution-pack-v0.3.0.md", "docs/ai-dev-team/cloud-run-deploy-execution-pack-v0.3.0.md");
  checkFile("cloud-run-first-deploy-approval-v0.3.0.md", "docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md");
  checkFile("cloud-run-post-deploy-verification-v0.3.0.md", "docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md");
  checkFile("first-cloud-run-deploy-execution-v0.4.0.md", "docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md");
  checkFile("first-cloud-run-deploy-result-record-v0.4.1.md", "docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md");

  // --- file existence: tools ---
  console.log("--- tools existence checks ---");
  checkFile("pm-agent-deploy-approval-packet.js", "tools/pm-agent-deploy-approval-packet.js");
  checkFile("pm-agent-deploy-readiness-final-check.js", "tools/pm-agent-deploy-readiness-final-check.js");
  checkFile("pm-agent-first-deploy-command-pack.js", "tools/pm-agent-first-deploy-command-pack.js");
  checkFile("pm-agent-first-deploy-result-template.js", "tools/pm-agent-first-deploy-result-template.js");

  // --- docs content checks ---
  console.log("--- docs content checks ---");
  const docChecks = [
    ["docs/ai-dev-team/cloud-run-deploy-execution-pack-v0.3.0.md", ["Cloud Run", "Human Approval", "v0.4.0", "smoke"]],
    ["docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md", ["Cloud Run", "Human Approval", "billing", "Secret Manager"]],
    ["docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md", ["Cloud Run", "Human Approval", "smoke", "health"]],
    ["docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md", ["Cloud Run", "Human Approval", "v0.4.0", "じゅんやさん", "smoke"]],
  ];
  for (const [relPath, keywords] of docChecks) {
    const name = path.basename(relPath);
    for (const kw of keywords) checkContains(name, relPath, kw);
  }

  // --- approval packet module ---
  console.log("--- approval packet module checks ---");
  let approvalMod;
  try {
    approvalMod = require(path.join(ROOT, "tools/pm-agent-deploy-approval-packet.js"));
    ok("require pm-agent-deploy-approval-packet.js");
  } catch (e) { fail("require pm-agent-deploy-approval-packet.js", e.message); }

  if (approvalMod) {
    if (typeof approvalMod.generateDeployApprovalPacket === "function")
      ok("generateDeployApprovalPacket: exported");
    else fail("generateDeployApprovalPacket: exported");

    try {
      const pkt = approvalMod.generateDeployApprovalPacket();
      if (pkt.humanApprovalRequired === true) ok("generateDeployApprovalPacket humanApprovalRequired: true");
      else fail("generateDeployApprovalPacket humanApprovalRequired: true", `got: ${pkt.humanApprovalRequired}`);
      if (pkt.readyForHumanDeploy === true) ok("generateDeployApprovalPacket readyForHumanDeploy: true");
      else fail("generateDeployApprovalPacket readyForHumanDeploy: true", `got: ${pkt.readyForHumanDeploy}`);
      if (pkt.dryRun === true) ok("generateDeployApprovalPacket dryRun: true");
      else fail("generateDeployApprovalPacket dryRun: true", `got: ${pkt.dryRun}`);
      const nextVer = pkt.nextVersion || "";
      if (nextVer.includes("v0.4.0")) ok("generateDeployApprovalPacket nextVersion includes v0.4.0");
      else fail("generateDeployApprovalPacket nextVersion includes v0.4.0", nextVer);
    } catch (e) { fail("generateDeployApprovalPacket: executes without throw", e.message); }
  }

  // --- final readiness check module ---
  console.log("--- final readiness check module checks ---");
  let readinessMod;
  try {
    readinessMod = require(path.join(ROOT, "tools/pm-agent-deploy-readiness-final-check.js"));
    ok("require pm-agent-deploy-readiness-final-check.js");
  } catch (e) { fail("require pm-agent-deploy-readiness-final-check.js", e.message); }

  if (readinessMod) {
    for (const fn of ["runFinalDeployReadinessCheck", "checkDeployExecutionDocs", "checkDeployTools", "checkPackageScripts", "checkLaunchPackIntegrity"]) {
      if (typeof readinessMod[fn] === "function") ok(`readiness.${fn}: exported`);
      else fail(`readiness.${fn}: exported`);
    }

    try {
      const result = readinessMod.runFinalDeployReadinessCheck();
      if (result.dryRun === true) ok("runFinalDeployReadinessCheck dryRun: true");
      else fail("runFinalDeployReadinessCheck dryRun: true");
      if (result.humanApprovalRequired === true) ok("runFinalDeployReadinessCheck humanApprovalRequired: true");
      else fail("runFinalDeployReadinessCheck humanApprovalRequired: true");
      if (result.readyForHumanDeploy === true) ok("runFinalDeployReadinessCheck readyForHumanDeploy: true");
      else fail("runFinalDeployReadinessCheck readyForHumanDeploy: true", `failed: ${JSON.stringify(result.summary && result.summary.failedNames)}`);
      if (result.firstDeployCommandPackReady === true) ok("runFinalDeployReadinessCheck firstDeployCommandPackReady: true");
      else fail("runFinalDeployReadinessCheck firstDeployCommandPackReady: true");
      if (result.runtimeOpsReady === true) ok("runFinalDeployReadinessCheck runtimeOpsReady: true");
      else fail("runFinalDeployReadinessCheck runtimeOpsReady: true");
      if (result.webhookReadinessReady === true) ok("runFinalDeployReadinessCheck webhookReadinessReady: true");
      else fail("runFinalDeployReadinessCheck webhookReadinessReady: true");
    } catch (e) { fail("runFinalDeployReadinessCheck: executes without throw", e.message); }
  }

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
      "pm-agent:deploy-approval-packet",
      "pm-agent:deploy-readiness-final-check",
      "pm-agent:first-deploy-command-pack",
      "pm-agent:first-deploy-result-template",
      "smoke:cloud-run-deploy-execution-pack",
    ]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:cloud-run-deploy-execution-pack"))
      ok("verify includes smoke:cloud-run-deploy-execution-pack");
    else fail("verify includes smoke:cloud-run-deploy-execution-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
