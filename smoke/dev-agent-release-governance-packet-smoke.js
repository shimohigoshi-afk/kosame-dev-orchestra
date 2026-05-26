"use strict";

// Smoke test for v0.4.9 Release Governance Pack.
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
  console.log("===== dev-agent-release-governance-packet smoke =====");

  checkFile("release-governance-v0.4.9.md", "docs/ai-dev-team/release-governance-v0.4.9.md");
  checkFile("versioning-and-changelog-policy-v0.4.9.md", "docs/ai-dev-team/versioning-and-changelog-policy-v0.4.9.md");
  checkFile("human-approval-release-packet-v0.4.9.md", "docs/ai-dev-team/human-approval-release-packet-v0.4.9.md");
  checkFile("release-governance-packet.js", "tools/release-governance-packet.js");

  let releaseMod;
  try {
    releaseMod = require(path.join(ROOT, "tools/release-governance-packet.js"));
    ok("require release-governance-packet.js");
  } catch (e) { fail("require release-governance-packet.js", e.message); }

  if (releaseMod && typeof releaseMod.generateReleasePacket === "function") {
    const pkt = releaseMod.generateReleasePacket();
    if (pkt.version === "0.5.0") ok("generateReleasePacket version: 0.5.0");
    else fail("generateReleasePacket version: 0.5.0");
    if (pkt.status === "PENDING_APPROVAL") ok("generateReleasePacket status: PENDING_APPROVAL");
    else fail("generateReleasePacket status: PENDING_APPROVAL");
  } else {
    fail("generateReleasePacket function: exported");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
