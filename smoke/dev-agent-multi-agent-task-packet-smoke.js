"use strict";

const fs = require("fs");
const path = require("path");
const { generateGeminiPacket, generateClaudeFixPacket } = require("../tools/multi-agent-task-packet-generator");

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
  "docs/ai-dev-team/multi-agent-task-packet-v0.4.4.md",
  "docs/ai-dev-team/agent-role-routing-policy-v0.4.4.md",
  "docs/ai-dev-team/gemini-agent-task-packet-v0.4.4.md",
  "docs/ai-dev-team/claude-code-fix-packet-v0.4.4.md"
];

console.log("===== dev-agent-multi-agent-task-packet smoke =====");

console.log("--- documentation existence checks ---");
DOCS.forEach(doc => {
  const fullPath = path.join(root, doc);
  check(`File exists: ${doc}`, fs.existsSync(fullPath));
});

console.log("--- generator tool checks ---");
const gPacket = generateGeminiPacket("p-001", "review", "Review this file");
check("Gemini packet target is gemini-agent", gPacket.targetAgent === "gemini-agent");
check("Gemini packet includes instructions", gPacket.payload.instructions === "Review this file");

const cPacket = generateClaudeFixPacket("p-002", "Error: failed", ["test.js"]);
check("Claude packet target is claude-code", cPacket.targetAgent === "claude-code");
check("Claude packet includes error output", cPacket.payload.failureContext.errorOutput === "Error: failed");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
