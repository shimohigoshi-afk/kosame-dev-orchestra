"use strict";

const fs = require("fs");
const path = require("path");
const { generateTriagePacket } = require("../tools/verify-failure-triage-packet");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

const root = path.resolve(__dirname, "..");
const DOCS = [
  "docs/ai-dev-team/claude-fix-handoff-v0.4.6.md",
  "docs/ai-dev-team/verify-failure-triage-v0.4.6.md",
  "docs/ai-dev-team/bug-repair-routing-guide-v0.4.6.md"
];

console.log("===== dev-agent-verify-failure-triage smoke =====");

console.log("--- documentation existence checks ---");
DOCS.forEach(doc => {
  const fullPath = path.join(root, doc);
  check(`File exists: ${doc}`, fs.existsSync(fullPath));
});

console.log("--- triage logic checks ---");
const t1 = generateTriagePacket("SyntaxError: Unexpected token } in file.js");
check("SyntaxError classified correctly", t1.category === "Syntax Error");
check("SyntaxError severity is L1", t1.severity === "L1");

const t2 = generateTriagePacket("Error: EACCES: permission denied, open '/root/secret'");
check("Permission error classified correctly", t1.category !== "Permission Error" && t2.category === "Permission Error");
check("Permission error severity is L3", t2.severity === "L3");
check("Permission error suggests escalation", t2.suggestedAction === "Escalate to Human");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
