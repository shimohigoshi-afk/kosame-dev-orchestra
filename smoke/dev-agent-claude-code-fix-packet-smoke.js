"use strict";

const { generateClaudeFixPacket } = require("../tools/multi-agent-task-packet-generator");
const { generateClaudeFixInstructions } = require("../tools/claude-code-fix-packet-generator");

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

console.log("===== dev-agent-claude-code-fix-packet smoke =====");

try {
  const packet = generateClaudeFixPacket("p-002", "SyntaxError: unexpected token", ["smoke/test-1.js"]);
  const instructions = generateClaudeFixInstructions(packet);
  
  check("Instructions include Task", instructions.includes("# Task: Bug Fix"));
  check("Instructions include Error Output", instructions.includes("SyntaxError: unexpected token"));
  check("Instructions include Failing Tests", instructions.includes("smoke/test-1.js"));
  check("Instructions include verify command", instructions.includes("npm run verify"));
} catch (e) {
  console.error(`  FAIL  Unexpected error: ${e.message}`);
  failed++;
}

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
