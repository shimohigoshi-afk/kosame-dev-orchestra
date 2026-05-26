"use strict";

// Smoke test for v0.3.0 Webhook / n8n Connection Readiness.
// Verifies all webhook connection components exist and are safe.
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
  console.log("===== dev-agent-webhook-connection-readiness smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("n8n-cloud-run-connection-readiness-v0.3.0.md", "docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md");
  checkFile("webhook-intake-security-checklist-v0.3.0.md", "docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md");
  checkFile("external-caller-contract-v0.3.0.md", "docs/ai-dev-team/external-caller-contract-v0.3.0.md");
  checkFile("pm-agent-webhook-contract-generator.js", "tools/pm-agent-webhook-contract-generator.js");

  // --- docs content ---
  console.log("--- docs content checks ---");
  const docChecks = [
    ["docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md", ["n8n", "Cloud Run", "Human Approval", "webhook"]],
    ["docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md", ["webhook", "Cloud Run", "Human Approval", "Secret Manager"]],
    ["docs/ai-dev-team/external-caller-contract-v0.3.0.md", ["Cloud Run", "n8n", "Human Approval", "contract"]],
  ];
  for (const [relPath, keywords] of docChecks) {
    const name = path.basename(relPath);
    for (const kw of keywords) checkContains(name, relPath, kw);
  }

  // --- webhook contract module ---
  console.log("--- webhook contract module checks ---");
  let webhookMod;
  try {
    webhookMod = require(path.join(ROOT, "tools/pm-agent-webhook-contract-generator.js"));
    ok("require pm-agent-webhook-contract-generator.js");
  } catch (e) { fail("require pm-agent-webhook-contract-generator.js", e.message); }

  if (webhookMod) {
    for (const fn of ["generateWebhookContract", "generateWebhookSecurityChecklist"]) {
      if (typeof webhookMod[fn] === "function") ok(`webhookMod.${fn}: exported`);
      else fail(`webhookMod.${fn}: exported`);
    }

    try {
      const contract = webhookMod.generateWebhookContract();
      if (contract.dryRun === true) ok("generateWebhookContract dryRun: true");
      else fail("generateWebhookContract dryRun: true");
      if (typeof contract.endpoints === "object" && contract.endpoints !== null)
        ok("generateWebhookContract endpoints: object");
      else fail("generateWebhookContract endpoints: object");
      if (contract.endpoints.health && contract.endpoints.dryRunTask)
        ok("generateWebhookContract has health and dryRunTask endpoints");
      else fail("generateWebhookContract has health and dryRunTask endpoints");
      if (typeof contract.securityPolicy === "object")
        ok("generateWebhookContract securityPolicy: object");
      else fail("generateWebhookContract securityPolicy: object");
    } catch (e) { fail("generateWebhookContract: executes without throw", e.message); }

    try {
      const checklist = webhookMod.generateWebhookSecurityChecklist();
      if (checklist.dryRun === true) ok("generateWebhookSecurityChecklist dryRun: true");
      else fail("generateWebhookSecurityChecklist dryRun: true");
      if (Array.isArray(checklist.checklist) && checklist.checklist.length > 0)
        ok("generateWebhookSecurityChecklist checklist: non-empty array");
      else fail("generateWebhookSecurityChecklist checklist: non-empty array");
    } catch (e) { fail("generateWebhookSecurityChecklist: executes without throw", e.message); }
  }

  // --- source safety ---
  console.log("--- source safety checks ---");
  checkNotContains("pm-agent-webhook-contract-generator", "tools/pm-agent-webhook-contract-generator.js", "require('dotenv')");
  checkNotContains("pm-agent-webhook-contract-generator", "tools/pm-agent-webhook-contract-generator.js", 'require("dotenv")');
  checkNotContains("pm-agent-webhook-contract-generator", "tools/pm-agent-webhook-contract-generator.js", "SecretManagerServiceClient");
  checkNotContains("pm-agent-webhook-contract-generator", "tools/pm-agent-webhook-contract-generator.js", "fetch(");
  checkNotContains("pm-agent-webhook-contract-generator", "tools/pm-agent-webhook-contract-generator.js", "http.request");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["pm-agent:webhook-contract", "smoke:webhook-connection-readiness"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:webhook-connection-readiness"))
      ok("verify includes smoke:webhook-connection-readiness");
    else fail("verify includes smoke:webhook-connection-readiness");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
