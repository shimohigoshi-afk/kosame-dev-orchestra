"use strict";

// Smoke test for v0.4.7 Runtime Monitoring Pack.
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

async function main() {
  console.log("===== dev-agent-runtime-monitoring-pack smoke =====");

  checkFile("pm-agent-runtime-monitoring-v0.4.7.md", "docs/ai-dev-team/pm-agent-runtime-monitoring-v0.4.7.md");
  checkFile("runtime-health-signal-guide-v0.4.7.md", "docs/ai-dev-team/runtime-health-signal-guide-v0.4.7.md");
  checkFile("runtime-log-review-packet-v0.4.7.md", "docs/ai-dev-team/runtime-log-review-packet-v0.4.7.md");
  checkFile("pm-agent-runtime-monitoring-pack.js", "tools/pm-agent-runtime-monitoring-pack.js");

  checkContains("pm-agent-runtime-monitoring-v0.4.7.md", "docs/ai-dev-team/pm-agent-runtime-monitoring-v0.4.7.md", "Monitoring");
  checkContains("runtime-health-signal-guide-v0.4.7.md", "docs/ai-dev-team/runtime-health-signal-guide-v0.4.7.md", "Signal");
  checkContains("runtime-log-review-packet-v0.4.7.md", "docs/ai-dev-team/runtime-log-review-packet-v0.4.7.md", "Query");

  let monitoringMod;
  try {
    monitoringMod = require(path.join(ROOT, "tools/pm-agent-runtime-monitoring-pack.js"));
    ok("require pm-agent-runtime-monitoring-pack.js");
  } catch (e) { fail("require pm-agent-runtime-monitoring-pack.js", e.message); }

  if (monitoringMod && typeof monitoringMod.generateMonitoringChecklist === "function") {
    const pkt = monitoringMod.generateMonitoringChecklist();
    if (pkt.version === "0.4.7") ok("generateMonitoringChecklist version: 0.4.7");
    else fail("generateMonitoringChecklist version: 0.4.7");
  } else {
    fail("generateMonitoringChecklist function: exported");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
