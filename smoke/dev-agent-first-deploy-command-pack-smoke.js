"use strict";

// Smoke test for v0.3.0/v0.4.0 First Deploy Command Pack.
// Verifies the first deploy command pack generates command strings correctly and safely.
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
  console.log("===== dev-agent-first-deploy-command-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("pm-agent-first-deploy-command-pack.js", "tools/pm-agent-first-deploy-command-pack.js");
  checkFile("pm-agent-first-deploy-result-template.js", "tools/pm-agent-first-deploy-result-template.js");
  checkFile("first-cloud-run-deploy-execution-v0.4.0.md", "docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md");
  checkFile("first-cloud-run-deploy-result-record-v0.4.1.md", "docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md");

  // --- command pack module ---
  console.log("--- first deploy command pack module checks ---");
  let deployPackMod;
  try {
    deployPackMod = require(path.join(ROOT, "tools/pm-agent-first-deploy-command-pack.js"));
    ok("require pm-agent-first-deploy-command-pack.js");
  } catch (e) { fail("require pm-agent-first-deploy-command-pack.js", e.message); }

  if (deployPackMod) {
    for (const fn of [
      "generateFirstDeployCommandPack",
      "generateCloudBuildSubmitCommand",
      "generateCloudRunDeployCommand",
      "generatePostDeploySmokeCommand",
      "generateRollbackCandidateCommands",
      "generateHumanExecutionOrder",
    ]) {
      if (typeof deployPackMod[fn] === "function") ok(`deployPack.${fn}: exported`);
      else fail(`deployPack.${fn}: exported`);
    }

    // generateFirstDeployCommandPack returns pack with command strings
    try {
      const pack = deployPackMod.generateFirstDeployCommandPack();
      if (pack && typeof pack === "object") ok("generateFirstDeployCommandPack: returns object");
      else fail("generateFirstDeployCommandPack: returns object");
      if (pack.dryRun === true) ok("generateFirstDeployCommandPack dryRun: true");
      else fail("generateFirstDeployCommandPack dryRun: true");
      if (typeof pack.imageTagConvention === "string" && pack.imageTagConvention.length > 0)
        ok("generateFirstDeployCommandPack imageTagConvention: non-empty string");
      else fail("generateFirstDeployCommandPack imageTagConvention: non-empty string");

      // commands are string arrays
      const deployCommands = pack.cloudRunDeploy && pack.cloudRunDeploy.commands;
      if (Array.isArray(deployCommands) && deployCommands.length > 0)
        ok("generateFirstDeployCommandPack: cloudRunDeploy.commands is non-empty array");
      else fail("generateFirstDeployCommandPack: cloudRunDeploy.commands is non-empty array");
      if (Array.isArray(deployCommands) && deployCommands.every(c => typeof c === "string"))
        ok("generateFirstDeployCommandPack: deploy commands are all strings");
      else fail("generateFirstDeployCommandPack: deploy commands are all strings");

      const buildCommands = pack.cloudBuildSubmit && pack.cloudBuildSubmit.commands;
      if (Array.isArray(buildCommands) && buildCommands.every(c => typeof c === "string"))
        ok("generateFirstDeployCommandPack: cloudBuildSubmit.commands are strings");
      else fail("generateFirstDeployCommandPack: cloudBuildSubmit.commands are strings");

      // commands contain expected patterns (string check only, no execution)
      const cmdStr = deployCommands.join(" ");
      if (cmdStr.includes("gcloud run deploy"))
        ok("cloudRunDeploy.commands contains gcloud run deploy string");
      else fail("cloudRunDeploy.commands contains gcloud run deploy string");
      if (cmdStr.includes("asia-northeast1"))
        ok("cloudRunDeploy.commands contains default region asia-northeast1");
      else fail("cloudRunDeploy.commands contains default region asia-northeast1");

      // humanExecutionOrder
      const execOrder = pack.humanExecutionOrder;
      if (execOrder && Array.isArray(execOrder.steps) && execOrder.steps.length > 0)
        ok("generateFirstDeployCommandPack: humanExecutionOrder.steps is non-empty array");
      else fail("generateFirstDeployCommandPack: humanExecutionOrder.steps is non-empty array");

      // rollback candidates
      const rollback = pack.rollbackCandidates;
      if (rollback && Array.isArray(rollback.commands) && rollback.commands.length > 0)
        ok("generateFirstDeployCommandPack: rollbackCandidates.commands is non-empty array");
      else fail("generateFirstDeployCommandPack: rollbackCandidates.commands is non-empty array");

    } catch (e) { fail("generateFirstDeployCommandPack: executes without throw", e.message); }

    // generateCloudRunDeployCommand direct check
    try {
      const deployCmd = deployPackMod.generateCloudRunDeployCommand({ serviceName: "test-svc", region: "us-central1" });
      if (Array.isArray(deployCmd.commands) && deployCmd.commands.join(" ").includes("test-svc"))
        ok("generateCloudRunDeployCommand: uses passed serviceName");
      else fail("generateCloudRunDeployCommand: uses passed serviceName");
    } catch (e) { fail("generateCloudRunDeployCommand: executes without throw", e.message); }

    // generateHumanExecutionOrder has step-by-step commands and preDeployFinalCheck
    try {
      const order = deployPackMod.generateHumanExecutionOrder();
      if (order && Array.isArray(order.steps))
        ok("generateHumanExecutionOrder: returns steps array");
      else fail("generateHumanExecutionOrder: returns steps array");
      const allCmds = order.steps.flatMap(s => s.commands || []);
      if (allCmds.every(c => typeof c === "string"))
        ok("generateHumanExecutionOrder: all step commands are strings");
      else fail("generateHumanExecutionOrder: all step commands are strings");
      if (order.preDeployFinalCheck && typeof order.preDeployFinalCheck === "object")
        ok("generateHumanExecutionOrder: preDeployFinalCheck is object");
      else fail("generateHumanExecutionOrder: preDeployFinalCheck is object");
      if (order.preDeployFinalCheck && Array.isArray(order.preDeployFinalCheck.commands))
        ok("generateHumanExecutionOrder: preDeployFinalCheck.commands is array");
      else fail("generateHumanExecutionOrder: preDeployFinalCheck.commands is array");
    } catch (e) { fail("generateHumanExecutionOrder: executes without throw", e.message); }
  }

  // --- result template module ---
  console.log("--- first deploy result template module checks ---");
  let resultTemplateMod;
  try {
    resultTemplateMod = require(path.join(ROOT, "tools/pm-agent-first-deploy-result-template.js"));
    ok("require pm-agent-first-deploy-result-template.js");
  } catch (e) { fail("require pm-agent-first-deploy-result-template.js", e.message); }

  if (resultTemplateMod) {
    for (const fn of [
      "generateFirstDeployResultTemplate",
      "generatePostDeploySmokeRecordTemplate",
      "generateDeployTroubleshootingRecordTemplate",
    ]) {
      if (typeof resultTemplateMod[fn] === "function") ok(`resultTemplate.${fn}: exported`);
      else fail(`resultTemplate.${fn}: exported`);
    }
    try {
      const tmpl = resultTemplateMod.generateFirstDeployResultTemplate();
      if (tmpl.dryRun === true) ok("generateFirstDeployResultTemplate dryRun: true");
      else fail("generateFirstDeployResultTemplate dryRun: true");
      if (tmpl.record && typeof tmpl.record === "object") ok("generateFirstDeployResultTemplate record: object");
      else fail("generateFirstDeployResultTemplate record: object");
      if (typeof tmpl.record.n8nConnectionResult === "string")
        ok("generateFirstDeployResultTemplate record.n8nConnectionResult: string");
      else fail("generateFirstDeployResultTemplate record.n8nConnectionResult: string");
      if (typeof tmpl.record.nextVersionCandidate === "string")
        ok("generateFirstDeployResultTemplate record.nextVersionCandidate: string");
      else fail("generateFirstDeployResultTemplate record.nextVersionCandidate: string");
      if (typeof tmpl.record.troubleshootingNotes === "string")
        ok("generateFirstDeployResultTemplate record.troubleshootingNotes: string");
      else fail("generateFirstDeployResultTemplate record.troubleshootingNotes: string");
    } catch (e) { fail("generateFirstDeployResultTemplate: executes without throw", e.message); }
  }

  // --- source safety: no process-spawn calls ---
  console.log("--- source safety: command pack does NOT execute shell commands ---");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "child_process");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "execSync");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "exec(");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "spawn(");

  // --- source safety: no secret reading ---
  console.log("--- source safety: no secret reading ---");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "require('dotenv')");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", 'require("dotenv")');
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "SecretManagerServiceClient");
  checkNotContains("first-deploy-command-pack", "tools/pm-agent-first-deploy-command-pack.js", "readFileSync('.env')");

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
      "smoke:first-deploy-command-pack",
      "pm-agent:first-deploy-command-pack",
      "pm-agent:first-deploy-result-template",
    ]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:first-deploy-command-pack"))
      ok("verify includes smoke:first-deploy-command-pack");
    else fail("verify includes smoke:first-deploy-command-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
