"use strict";

// Smoke test for Production Cutover Pack (v0.4.2).
// Verifies the pack generates checklists and plans correctly and safely.
// Does NOT execute deploys. Does NOT read secrets. Does NOT access Cloud Run.

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
  console.log("===== dev-agent-production-cutover-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("pm-agent-production-cutover-pack.js", "tools/pm-agent-production-cutover-pack.js");
  checkFile("cloud-run-production-cutover-notes-v0.4.2.md", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md");

  // --- module checks ---
  console.log("--- module export checks ---");
  let mod;
  try {
    mod = require(path.join(ROOT, "tools/pm-agent-production-cutover-pack.js"));
    ok("require pm-agent-production-cutover-pack.js");
  } catch (e) { fail("require pm-agent-production-cutover-pack.js", e.message); }

  if (mod) {
    for (const fn of [
      "generateProductionCutoverPack",
      "generateGoNoGoChecklist",
      "generateRollbackWindowPlan",
      "generatePostCutoverMonitoringPlan",
    ]) {
      if (typeof mod[fn] === "function") ok(`mod.${fn}: exported`);
      else fail(`mod.${fn}: exported`);
    }

    try {
      const pack = mod.generateProductionCutoverPack();
      if (pack && typeof pack === "object") ok("generateProductionCutoverPack: returns object");
      else fail("generateProductionCutoverPack: returns object");
      if (pack.dryRun === true) ok("generateProductionCutoverPack dryRun: true");
      else fail("generateProductionCutoverPack dryRun: true");
      if (pack.humanApprovalRequired === true) ok("generateProductionCutoverPack humanApprovalRequired: true");
      else fail("generateProductionCutoverPack humanApprovalRequired: true");
    } catch (e) { fail("generateProductionCutoverPack: executes without throw", e.message); }

    try {
      const gng = mod.generateGoNoGoChecklist();
      if (Array.isArray(gng.goConditions) && gng.goConditions.length > 0)
        ok("generateGoNoGoChecklist: goConditions is non-empty array");
      else fail("generateGoNoGoChecklist: goConditions is non-empty array");
      if (Array.isArray(gng.noGoConditions) && gng.noGoConditions.length > 0)
        ok("generateGoNoGoChecklist: noGoConditions is non-empty array");
      else fail("generateGoNoGoChecklist: noGoConditions is non-empty array");
    } catch (e) { fail("generateGoNoGoChecklist: executes without throw", e.message); }

    try {
      const rollback = mod.generateRollbackWindowPlan();
      if (Array.isArray(rollback.rollbackTriggers) && rollback.rollbackTriggers.length > 0)
        ok("generateRollbackWindowPlan: rollbackTriggers is non-empty array");
      else fail("generateRollbackWindowPlan: rollbackTriggers is non-empty array");
      if (Array.isArray(rollback.rollbackCommands) && rollback.rollbackCommands.every(c => typeof c === "string"))
        ok("generateRollbackWindowPlan: rollbackCommands are all strings");
      else fail("generateRollbackWindowPlan: rollbackCommands are all strings");
    } catch (e) { fail("generateRollbackWindowPlan: executes without throw", e.message); }

    try {
      const monitoring = mod.generatePostCutoverMonitoringPlan();
      if (Array.isArray(monitoring.monitoringItems) && monitoring.monitoringItems.length > 0)
        ok("generatePostCutoverMonitoringPlan: monitoringItems is non-empty array");
      else fail("generatePostCutoverMonitoringPlan: monitoringItems is non-empty array");
      if (monitoring.alertThresholds && typeof monitoring.alertThresholds === "object")
        ok("generatePostCutoverMonitoringPlan: alertThresholds is object");
      else fail("generatePostCutoverMonitoringPlan: alertThresholds is object");
      if (typeof monitoring.production === "string" && monitoring.production.length > 0)
        ok("generatePostCutoverMonitoringPlan: production field is non-empty string");
      else fail("generatePostCutoverMonitoringPlan: production field is non-empty string");
    } catch (e) { fail("generatePostCutoverMonitoringPlan: executes without throw", e.message); }
  }

  // --- source safety ---
  console.log("--- source safety: no deploy execution or process-spawn ---");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "child_process");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "execSync");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "exec(");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "spawn(");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "require('dotenv')");
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", 'require("dotenv")');
  checkNotContains("production-cutover-pack", "tools/pm-agent-production-cutover-pack.js", "SecretManagerServiceClient");

  // --- doc keyword checks ---
  console.log("--- doc keyword checks ---");
  checkContains("cloud-run-production-cutover-notes", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md", "Cloud Run");
  checkContains("cloud-run-production-cutover-notes", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md", "Human Approval");
  checkContains("cloud-run-production-cutover-notes", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md", "rollback");
  checkContains("cloud-run-production-cutover-notes", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md", "billing");
  checkContains("cloud-run-production-cutover-notes", "docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md", "production");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["smoke:production-cutover-pack", "pm-agent:production-cutover-pack"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:production-cutover-pack"))
      ok("verify includes smoke:production-cutover-pack");
    else fail("verify includes smoke:production-cutover-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
