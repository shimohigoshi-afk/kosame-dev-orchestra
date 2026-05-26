"use strict";

const { generateGeminiPacket } = require("../tools/multi-agent-task-packet-generator");
const { generateGeminiPrompt } = require("../tools/gemini-agent-prompt-generator");

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

console.log("===== dev-agent-gemini-agent-prompt-generator smoke =====");

try {
  const packet = generateGeminiPacket("p-001", "review", "Check the Cloud Run config");
  const prompt = generateGeminiPrompt(packet);
  
  check("Prompt includes Role", prompt.includes("Role: Gemini Agent"));
  check("Prompt includes Task Type", prompt.includes("Task Type: review"));
  check("Prompt includes Instructions", prompt.includes("Check the Cloud Run config"));
  check("Prompt is in English (for Role/Instructions header)", prompt.includes("# Instructions:"));
} catch (e) {
  console.error(`  FAIL  Unexpected error: ${e.message}`);
  failed++;
}

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
