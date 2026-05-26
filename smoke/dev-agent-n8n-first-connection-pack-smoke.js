"use strict";

// Smoke test for n8n First Connection Pack (v0.4.2).
// Verifies the pack generates configuration objects and templates correctly and safely.
// Does NOT send HTTP requests. Does NOT read secrets. Does NOT connect to n8n.

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
  console.log("===== dev-agent-n8n-first-connection-pack smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("pm-agent-n8n-first-connection-pack.js", "tools/pm-agent-n8n-first-connection-pack.js");
  checkFile("cloud-run-n8n-first-connection-v0.4.2.md", "docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md");
  checkFile("webhook-first-connection-result-record-v0.4.2.md", "docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md");

  // --- module checks ---
  console.log("--- module export checks ---");
  let mod;
  try {
    mod = require(path.join(ROOT, "tools/pm-agent-n8n-first-connection-pack.js"));
    ok("require pm-agent-n8n-first-connection-pack.js");
  } catch (e) { fail("require pm-agent-n8n-first-connection-pack.js", e.message); }

  if (mod) {
    for (const fn of [
      "generateN8nFirstConnectionPack",
      "generateN8nHttpRequestNodeConfig",
      "generateN8nDryRunTaskPayload",
      "generateN8nConnectionResultRecordTemplate",
    ]) {
      if (typeof mod[fn] === "function") ok(`mod.${fn}: exported`);
      else fail(`mod.${fn}: exported`);
    }

    try {
      const pack = mod.generateN8nFirstConnectionPack();
      if (pack && typeof pack === "object") ok("generateN8nFirstConnectionPack: returns object");
      else fail("generateN8nFirstConnectionPack: returns object");
      if (pack.dryRun === true) ok("generateN8nFirstConnectionPack dryRun: true");
      else fail("generateN8nFirstConnectionPack dryRun: true");
      if (pack.humanApprovalRequired === true) ok("generateN8nFirstConnectionPack humanApprovalRequired: true");
      else fail("generateN8nFirstConnectionPack humanApprovalRequired: true");
    } catch (e) { fail("generateN8nFirstConnectionPack: executes without throw", e.message); }

    try {
      const config = mod.generateN8nHttpRequestNodeConfig();
      if (config.method === "POST") ok("generateN8nHttpRequestNodeConfig: method is POST");
      else fail("generateN8nHttpRequestNodeConfig: method is POST");
      if (typeof config.url === "string" && config.url.includes("/dry-run-task"))
        ok("generateN8nHttpRequestNodeConfig: url includes /dry-run-task");
      else fail("generateN8nHttpRequestNodeConfig: url includes /dry-run-task");
      if (typeof config.timeoutMs === "number") ok("generateN8nHttpRequestNodeConfig: timeoutMs is number");
      else fail("generateN8nHttpRequestNodeConfig: timeoutMs is number");
    } catch (e) { fail("generateN8nHttpRequestNodeConfig: executes without throw", e.message); }

    try {
      const payload = mod.generateN8nDryRunTaskPayload();
      if (payload.samplePayload && typeof payload.samplePayload === "object")
        ok("generateN8nDryRunTaskPayload: samplePayload is object");
      else fail("generateN8nDryRunTaskPayload: samplePayload is object");
      if (payload.responseHandling && typeof payload.responseHandling === "object")
        ok("generateN8nDryRunTaskPayload: responseHandling is object");
      else fail("generateN8nDryRunTaskPayload: responseHandling is object");
    } catch (e) { fail("generateN8nDryRunTaskPayload: executes without throw", e.message); }

    try {
      const tmpl = mod.generateN8nConnectionResultRecordTemplate();
      if (tmpl && typeof tmpl.connectionTest === "object")
        ok("generateN8nConnectionResultRecordTemplate: connectionTest is object");
      else fail("generateN8nConnectionResultRecordTemplate: connectionTest is object");
    } catch (e) { fail("generateN8nConnectionResultRecordTemplate: executes without throw", e.message); }
  }

  // --- source safety ---
  console.log("--- source safety: no HTTP sending or process-spawn ---");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "child_process");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "execSync");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "exec(");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "spawn(");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "require('dotenv')");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", 'require("dotenv")');
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "fetch(");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "http.request");
  checkNotContains("n8n-first-connection-pack", "tools/pm-agent-n8n-first-connection-pack.js", "axios");

  // --- doc keyword checks ---
  console.log("--- doc keyword checks ---");
  checkContains("cloud-run-n8n-first-connection", "docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md", "n8n");
  checkContains("cloud-run-n8n-first-connection", "docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md", "Cloud Run");
  checkContains("cloud-run-n8n-first-connection", "docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md", "Human Approval");
  checkContains("cloud-run-n8n-first-connection", "docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md", "connection");
  checkContains("webhook-first-connection-result", "docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md", "webhook");
  checkContains("webhook-first-connection-result", "docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md", "n8n");
  checkContains("webhook-first-connection-result", "docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md", "Cloud Run");
  checkContains("webhook-first-connection-result", "docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md", "Human Approval");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["smoke:n8n-first-connection-pack", "pm-agent:n8n-first-connection-pack"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:n8n-first-connection-pack"))
      ok("verify includes smoke:n8n-first-connection-pack");
    else fail("verify includes smoke:n8n-first-connection-pack");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
