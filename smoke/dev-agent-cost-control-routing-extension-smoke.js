"use strict";

// Smoke test for v0.4.8 Cost Control & Routing Extension.
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
  console.log("===== dev-agent-cost-control-routing-extension smoke =====");

  checkFile("cost-control-routing-extension-v0.4.8.md", "docs/ai-dev-team/cost-control-routing-extension-v0.4.8.md");
  checkFile("lightweight-model-cost-policy-v0.4.8.md", "docs/ai-dev-team/lightweight-model-cost-policy-v0.4.8.md");
  checkFile("expensive-model-escalation-policy-v0.4.8.md", "docs/ai-dev-team/expensive-model-escalation-policy-v0.4.8.md");
  checkFile("cost-control-routing-extension-pack.js", "tools/cost-control-routing-extension-pack.js");

  let costMod;
  try {
    costMod = require(path.join(ROOT, "tools/cost-control-routing-extension-pack.js"));
    ok("require cost-control-routing-extension-pack.js");
  } catch (e) { fail("require cost-control-routing-extension-pack.js", e.message); }

  if (costMod && typeof costMod.generateCostControlRoutingPacket === "function") {
    const pkt = costMod.generateCostControlRoutingPacket();
    if (pkt.version === "0.4.8") ok("generateCostControlRoutingPacket version: 0.4.8");
    else fail("generateCostControlRoutingPacket version: 0.4.8");
    if (Array.isArray(pkt.routingRules)) ok("generateCostControlRoutingPacket routingRules: array");
    else fail("generateCostControlRoutingPacket routingRules: array");
  } else {
    fail("generateCostControlRoutingPacket function: exported");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
