"use strict";

// Smoke test for v0.3.0 Runtime Ops Pack.
// Verifies all runtime ops components exist and are safe.
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
  console.log("===== dev-agent-runtime-ops-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("cloud-run-runtime-ops-pack-v0.3.0.md", "docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md");
  checkFile("cloud-run-incident-response-v0.3.0.md", "docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md");
  checkFile("cloud-run-redeploy-decision-guide-v0.3.0.md", "docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md");
  checkFile("pm-agent-runtime-ops-packet.js", "tools/pm-agent-runtime-ops-packet.js");

  // --- docs content ---
  console.log("--- docs content checks ---");
  const docChecks = [
    ["docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md", ["Cloud Run", "runtime", "billing", "Human Approval"]],
    ["docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md", ["Cloud Run", "rollback", "Human Approval", "smoke"]],
    ["docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md", ["Cloud Run", "redeploy", "Human Approval"]],
  ];
  for (const [relPath, keywords] of docChecks) {
    const name = path.basename(relPath);
    for (const kw of keywords) checkContains(name, relPath, kw);
  }

  // --- runtime ops module ---
  console.log("--- runtime ops module checks ---");
  let runtimeMod;
  try {
    runtimeMod = require(path.join(ROOT, "tools/pm-agent-runtime-ops-packet.js"));
    ok("require pm-agent-runtime-ops-packet.js");
  } catch (e) { fail("require pm-agent-runtime-ops-packet.js", e.message); }

  if (runtimeMod) {
    for (const fn of ["generateRuntimeOpsPacket", "generateIncidentResponsePacket"]) {
      if (typeof runtimeMod[fn] === "function") ok(`runtimeOps.${fn}: exported`);
      else fail(`runtimeOps.${fn}: exported`);
    }

    try {
      const pkt = runtimeMod.generateRuntimeOpsPacket();
      if (pkt.dryRun === true) ok("generateRuntimeOpsPacket dryRun: true");
      else fail("generateRuntimeOpsPacket dryRun: true");
      if (typeof pkt.ops === "object" && pkt.ops !== null) ok("generateRuntimeOpsPacket ops: object");
      else fail("generateRuntimeOpsPacket ops: object");
      if (typeof pkt.billingAlertRecommendation === "string") ok("generateRuntimeOpsPacket billingAlertRecommendation: string");
      else fail("generateRuntimeOpsPacket billingAlertRecommendation: string");
    } catch (e) { fail("generateRuntimeOpsPacket: executes without throw", e.message); }

    try {
      const inc = runtimeMod.generateIncidentResponsePacket();
      if (inc.dryRun === true) ok("generateIncidentResponsePacket dryRun: true");
      else fail("generateIncidentResponsePacket dryRun: true");
      if (typeof inc.incidentLevels === "object") ok("generateIncidentResponsePacket incidentLevels: object");
      else fail("generateIncidentResponsePacket incidentLevels: object");
      if (Array.isArray(inc.rollbackCommand)) ok("generateIncidentResponsePacket rollbackCommand: array");
      else fail("generateIncidentResponsePacket rollbackCommand: array");
    } catch (e) { fail("generateIncidentResponsePacket: executes without throw", e.message); }
  }

  // --- source safety ---
  console.log("--- source safety checks ---");
  checkNotContains("pm-agent-runtime-ops-packet", "tools/pm-agent-runtime-ops-packet.js", "require('dotenv')");
  checkNotContains("pm-agent-runtime-ops-packet", "tools/pm-agent-runtime-ops-packet.js", 'require("dotenv")');
  checkNotContains("pm-agent-runtime-ops-packet", "tools/pm-agent-runtime-ops-packet.js", "SecretManagerServiceClient");
  checkNotContains("pm-agent-runtime-ops-packet", "tools/pm-agent-runtime-ops-packet.js", "fetch(");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["pm-agent:runtime-ops-packet", "smoke:runtime-ops-pack"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:runtime-ops-pack"))
      ok("verify includes smoke:runtime-ops-pack");
    else fail("verify includes smoke:runtime-ops-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
