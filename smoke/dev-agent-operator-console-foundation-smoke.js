"use strict";

// Smoke test for v0.5.0 Operator Console Foundation.
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

async function main() {
  console.log("===== dev-agent-operator-console-foundation smoke =====");

  checkFile("dev-orchestra-operator-console-foundation-v0.5.0.md", "docs/ai-dev-team/dev-orchestra-operator-console-foundation-v0.5.0.md");
  checkFile("operator-command-map-v0.5.0.md", "docs/ai-dev-team/operator-command-map-v0.5.0.md");
  checkFile("operator-dashboard-data-contract-v0.5.0.md", "docs/ai-dev-team/operator-dashboard-data-contract-v0.5.0.md");
  checkFile("dev-orchestra-operator-console-pack.js", "tools/dev-orchestra-operator-console-pack.js");

  let consoleMod;
  try {
    consoleMod = require(path.join(ROOT, "tools/dev-orchestra-operator-console-pack.js"));
    ok("require dev-orchestra-operator-console-pack.js");
  } catch (e) { fail("require dev-orchestra-operator-console-pack.js", e.message); }

  if (consoleMod && typeof consoleMod.generateOperatorConsolePacket === "function") {
    const pkt = consoleMod.generateOperatorConsolePacket();
    if (pkt.version === "0.5.0") ok("generateOperatorConsolePacket version: 0.5.0");
    else fail("generateOperatorConsolePacket version: 0.5.0");
    if (pkt.dashboardContract) ok("generateOperatorConsolePacket dashboardContract: exists");
    else fail("generateOperatorConsolePacket dashboardContract: exists");
  } else {
    fail("generateOperatorConsolePacket function: exported");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
