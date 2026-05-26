"use strict";

// Smoke test for Secret Manager Readiness Pack (v0.4.2).
// Verifies the pack generates checklists safely without accessing secret values.
// Does NOT read secrets. Does NOT call Secret Manager API. Does NOT read dotenv files.

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
  console.log("===== dev-agent-secret-manager-readiness-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("pm-agent-secret-manager-readiness-pack.js", "tools/pm-agent-secret-manager-readiness-pack.js");
  checkFile("cloud-run-secret-manager-readiness-v0.4.2.md", "docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md");

  // --- module checks ---
  console.log("--- module export checks ---");
  let mod;
  try {
    mod = require(path.join(ROOT, "tools/pm-agent-secret-manager-readiness-pack.js"));
    ok("require pm-agent-secret-manager-readiness-pack.js");
  } catch (e) { fail("require pm-agent-secret-manager-readiness-pack.js", e.message); }

  if (mod) {
    for (const fn of [
      "generateSecretManagerReadinessPack",
      "generateSecretPresenceChecklist",
      "generateRuntimeEnvVarChecklist",
      "generateHumanSecretSetupInstructions",
    ]) {
      if (typeof mod[fn] === "function") ok(`mod.${fn}: exported`);
      else fail(`mod.${fn}: exported`);
    }

    try {
      const pack = mod.generateSecretManagerReadinessPack();
      if (pack && typeof pack === "object") ok("generateSecretManagerReadinessPack: returns object");
      else fail("generateSecretManagerReadinessPack: returns object");
      if (pack.dryRun === true) ok("generateSecretManagerReadinessPack dryRun: true");
      else fail("generateSecretManagerReadinessPack dryRun: true");
      if (pack.humanApprovalRequired === true) ok("generateSecretManagerReadinessPack humanApprovalRequired: true");
      else fail("generateSecretManagerReadinessPack humanApprovalRequired: true");
      if (Array.isArray(pack.safetyPrinciples) && pack.safetyPrinciples.length > 0)
        ok("generateSecretManagerReadinessPack: safetyPrinciples is non-empty array");
      else fail("generateSecretManagerReadinessPack: safetyPrinciples is non-empty array");
    } catch (e) { fail("generateSecretManagerReadinessPack: executes without throw", e.message); }

    try {
      const checklist = mod.generateSecretPresenceChecklist();
      if (Array.isArray(checklist.secretNamesToConfirm) && checklist.secretNamesToConfirm.length > 0)
        ok("generateSecretPresenceChecklist: secretNamesToConfirm is non-empty array");
      else fail("generateSecretPresenceChecklist: secretNamesToConfirm is non-empty array");
      if (Array.isArray(checklist.forbidden) && checklist.forbidden.length > 0)
        ok("generateSecretPresenceChecklist: forbidden is non-empty array");
      else fail("generateSecretPresenceChecklist: forbidden is non-empty array");
    } catch (e) { fail("generateSecretPresenceChecklist: executes without throw", e.message); }

    try {
      const envChecklist = mod.generateRuntimeEnvVarChecklist();
      if (Array.isArray(envChecklist.envVarNames) && envChecklist.envVarNames.length > 0)
        ok("generateRuntimeEnvVarChecklist: envVarNames is non-empty array");
      else fail("generateRuntimeEnvVarChecklist: envVarNames is non-empty array");
    } catch (e) { fail("generateRuntimeEnvVarChecklist: executes without throw", e.message); }

    try {
      const instructions = mod.generateHumanSecretSetupInstructions();
      if (Array.isArray(instructions.instructions) && instructions.instructions.length > 0)
        ok("generateHumanSecretSetupInstructions: instructions is non-empty array");
      else fail("generateHumanSecretSetupInstructions: instructions is non-empty array");
    } catch (e) { fail("generateHumanSecretSetupInstructions: executes without throw", e.message); }
  }

  // --- source safety: CRITICAL — must NOT access secret values ---
  console.log("--- source safety: must NOT access secret values ---");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "SecretManagerServiceClient");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "gcloud secrets versions access");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "child_process");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "execSync");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "exec(");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "spawn(");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "require('dotenv')");
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", 'require("dotenv")');
  checkNotContains("secret-manager-readiness-pack", "tools/pm-agent-secret-manager-readiness-pack.js", "readFileSync('.env')");

  // --- doc keyword checks ---
  console.log("--- doc keyword checks ---");
  checkContains("cloud-run-secret-manager-readiness", "docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md", "Secret Manager");
  checkContains("cloud-run-secret-manager-readiness", "docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md", "Cloud Run");
  checkContains("cloud-run-secret-manager-readiness", "docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md", "Human Approval");
  checkContains("cloud-run-secret-manager-readiness", "docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md", "readiness");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["smoke:secret-manager-readiness-pack", "pm-agent:secret-manager-readiness-pack"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:secret-manager-readiness-pack"))
      ok("verify includes smoke:secret-manager-readiness-pack");
    else fail("verify includes smoke:secret-manager-readiness-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
