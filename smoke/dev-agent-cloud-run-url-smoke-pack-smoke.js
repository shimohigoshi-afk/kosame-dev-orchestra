"use strict";

// Smoke test for Cloud Run URL Smoke Pack (v0.4.1).
// Verifies the smoke pack generates command strings correctly and safely.
// Does NOT call any external API. Does NOT read secrets. Does NOT execute HTTP requests.

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
  console.log("===== dev-agent-cloud-run-url-smoke-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("pm-agent-cloud-run-url-smoke-pack.js", "tools/pm-agent-cloud-run-url-smoke-pack.js");
  checkFile("cloud-run-url-smoke-record-v0.4.1.md", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md");

  // --- module checks ---
  console.log("--- module export checks ---");
  let mod;
  try {
    mod = require(path.join(ROOT, "tools/pm-agent-cloud-run-url-smoke-pack.js"));
    ok("require pm-agent-cloud-run-url-smoke-pack.js");
  } catch (e) { fail("require pm-agent-cloud-run-url-smoke-pack.js", e.message); }

  if (mod) {
    for (const fn of [
      "generateCloudRunUrlSmokePack",
      "generateHealthSmokeCommand",
      "generateInfoSmokeCommand",
      "generateDryRunTaskSmokeCommand",
      "generateSmokeResultRecordTemplate",
    ]) {
      if (typeof mod[fn] === "function") ok(`mod.${fn}: exported`);
      else fail(`mod.${fn}: exported`);
    }

    try {
      const pack = mod.generateCloudRunUrlSmokePack();
      if (pack && typeof pack === "object") ok("generateCloudRunUrlSmokePack: returns object");
      else fail("generateCloudRunUrlSmokePack: returns object");
      if (pack.dryRun === true) ok("generateCloudRunUrlSmokePack dryRun: true");
      else fail("generateCloudRunUrlSmokePack dryRun: true");
      if (pack.humanApprovalRequired === true) ok("generateCloudRunUrlSmokePack humanApprovalRequired: true");
      else fail("generateCloudRunUrlSmokePack humanApprovalRequired: true");
    } catch (e) { fail("generateCloudRunUrlSmokePack: executes without throw", e.message); }

    try {
      const healthCmd = mod.generateHealthSmokeCommand();
      if (typeof healthCmd.curlCommand === "string") ok("generateHealthSmokeCommand: curlCommand is string");
      else fail("generateHealthSmokeCommand: curlCommand is string");
      if (healthCmd.curlCommand.includes("/health")) ok("generateHealthSmokeCommand: curlCommand includes /health");
      else fail("generateHealthSmokeCommand: curlCommand includes /health");
      if (healthCmd.serviceUrl === "SERVICE_URL_PLACEHOLDER") ok("generateHealthSmokeCommand: default serviceUrl is placeholder");
      else fail("generateHealthSmokeCommand: default serviceUrl is placeholder");
    } catch (e) { fail("generateHealthSmokeCommand: executes without throw", e.message); }

    try {
      const infoCmd = mod.generateInfoSmokeCommand();
      if (typeof infoCmd.curlCommand === "string" && infoCmd.curlCommand.includes("/info"))
        ok("generateInfoSmokeCommand: curlCommand includes /info");
      else fail("generateInfoSmokeCommand: curlCommand includes /info");
    } catch (e) { fail("generateInfoSmokeCommand: executes without throw", e.message); }

    try {
      const dryRunCmd = mod.generateDryRunTaskSmokeCommand();
      if (dryRunCmd.implementationTask && typeof dryRunCmd.implementationTask.curlCommand === "string")
        ok("generateDryRunTaskSmokeCommand: implementationTask.curlCommand is string");
      else fail("generateDryRunTaskSmokeCommand: implementationTask.curlCommand is string");
      if (dryRunCmd.criticalTask && typeof dryRunCmd.criticalTask.curlCommand === "string")
        ok("generateDryRunTaskSmokeCommand: criticalTask.curlCommand is string");
      else fail("generateDryRunTaskSmokeCommand: criticalTask.curlCommand is string");
    } catch (e) { fail("generateDryRunTaskSmokeCommand: executes without throw", e.message); }

    try {
      const tmpl = mod.generateSmokeResultRecordTemplate();
      if (Array.isArray(tmpl.checks) && tmpl.checks.length > 0) ok("generateSmokeResultRecordTemplate: checks is non-empty array");
      else fail("generateSmokeResultRecordTemplate: checks is non-empty array");
    } catch (e) { fail("generateSmokeResultRecordTemplate: executes without throw", e.message); }
  }

  // --- source safety ---
  console.log("--- source safety: no HTTP execution or process-spawn ---");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "child_process");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "execSync");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "exec(");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "spawn(");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "require('dotenv')");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", 'require("dotenv")');
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "fetch(");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "http.get(");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "https.get(");
  checkNotContains("cloud-run-url-smoke-pack", "tools/pm-agent-cloud-run-url-smoke-pack.js", "axios");

  // --- doc keyword checks ---
  console.log("--- doc keyword checks ---");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "Cloud Run");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "smoke");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "URL");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "Human Approval");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "health");
  checkContains("cloud-run-url-smoke-record", "docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md", "rollback");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["smoke:cloud-run-url-smoke-pack", "pm-agent:cloud-run-url-smoke-pack"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:cloud-run-url-smoke-pack"))
      ok("verify includes smoke:cloud-run-url-smoke-pack");
    else fail("verify includes smoke:cloud-run-url-smoke-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
