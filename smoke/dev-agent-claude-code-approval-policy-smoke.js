"use strict";

const fs = require("fs");
const path = require("path");
const { generateApprovalPolicyStatus } = require("../tools/claude-code-approval-policy-generator");

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
  "docs/ai-dev-team/claude-code-approval-policy-v0.4.3.md",
  "docs/ai-dev-team/yes-hell-reduction-guide-v0.4.3.md",
  "docs/ai-dev-team/approval-gate-risk-matrix-v0.4.3.md",
  "docs/ai-dev-team/safe-ask-deny-command-policy-v0.4.3.md"
];

console.log("===== dev-agent-claude-code-approval-policy smoke =====");

console.log("--- documentation existence checks ---");
DOCS.forEach(doc => {
  const fullPath = path.join(root, doc);
  check(`File exists: ${doc}`, fs.existsSync(fullPath));
});

console.log("--- tool output checks ---");
const status = generateApprovalPolicyStatus();
check("Status version is v0.4.3", status.version === "v0.4.3");
check("Status has categories", !!status.categories);
check("Allowed category includes git status", status.categories.allowed.some(c => c.includes("git status")));
check("Ask category includes git commit", status.categories.ask.some(c => c.includes("git commit")));
check("Deny category includes rm -rf", status.categories.deny.some(c => c.includes("rm -rf")));

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
