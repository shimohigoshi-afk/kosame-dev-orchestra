"use strict";

const fs = require("fs");
const path = require("path");
const { suggestRole } = require("../tools/agent-role-routing-policy-generator");

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
  "docs/ai-dev-team/gemini-agent-dev-policy-v0.4.5.md",
  "docs/ai-dev-team/claude-code-dev-policy-v0.4.5.md",
  "docs/ai-dev-team/kosame-pm-review-policy-v0.4.5.md"
];

console.log("===== dev-agent-role-routing-policy smoke =====");

console.log("--- documentation existence checks ---");
DOCS.forEach(doc => {
  const fullPath = path.join(root, doc);
  check(`File exists: ${doc}`, fs.existsSync(fullPath));
});

console.log("--- routing suggestion checks ---");
const r1 = suggestRole("implementation");
check("Implementation goes to Claude Code", r1.suggestedRole === "Claude Code");

const r2 = suggestRole("gcp-check");
check("GCP check goes to Gemini Agent", r2.suggestedRole === "Gemini Agent");

const r3 = suggestRole("design");
check("Design goes to PM Agent", r3.suggestedRole === "PM Agent");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
