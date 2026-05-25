"use strict";

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function checkFile(label, filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`  PASS  ${label}: exists`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}: not found at ${filePath}`);
    failed++;
  }
}

function checkKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes(keyword)) {
      console.log(`  PASS  ${label}`);
      passed++;
    } else {
      console.error(`  FAIL  ${label}`);
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL  ${label}: cannot read file: ${e.message}`);
    failed++;
  }
}

const root = path.resolve(__dirname, "..");

const FILES = {
  agentInterface:    path.join(root, "docs/ai-dev-team/agent-interface-v0.1.2.md"),
  agentApiWiring:    path.join(root, "docs/ai-dev-team/agent-api-wiring-v0.1.3.md"),
  gptPacket:         path.join(root, "docs/ai-dev-team/gpt-agent-task-packet-v0.1.2.md"),
  geminiPacket012:   path.join(root, "docs/ai-dev-team/gemini-agent-task-packet-v0.1.2.md"),
  mockProvider:      path.join(root, "providers/mock-provider.js"),
  gptProvider:       path.join(root, "providers/gpt-provider.js"),
  geminiProvider:    path.join(root, "providers/gemini-provider.js"),
  sampleTool:        path.join(root, "tools/agent-task-packet-sample.js"),
  dryRunTool:        path.join(root, "tools/agent-router-dry-run.js"),
  runnerTool:        path.join(root, "tools/agent-runner-local.js"),
};

console.log("===== dev-agent-interface smoke =====");

console.log("--- file existence checks ---");
for (const [key, filePath] of Object.entries(FILES)) {
  checkFile(key, filePath);
}

console.log("--- agent-interface-v0.1.2.md keyword checks ---");
checkKeyword("agent-interface", FILES.agentInterface, "KOSAME Dev Orchestra");
checkKeyword("agent-interface", FILES.agentInterface, "provider");
checkKeyword("agent-interface", FILES.agentInterface, "taskPacket");
checkKeyword("agent-interface", FILES.agentInterface, "dry-run");
checkKeyword("agent-interface", FILES.agentInterface, "Human Approval");

console.log("--- agent-api-wiring-v0.1.3.md keyword checks ---");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "KOSAME Dev Orchestra");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "GPT");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "Gemini");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "disabled");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "Human Approval");
checkKeyword("agent-api-wiring", FILES.agentApiWiring, "Secret Manager");

console.log("--- gpt-agent-task-packet-v0.1.2.md keyword checks ---");
checkKeyword("gpt-packet", FILES.gptPacket, "GPT");
checkKeyword("gpt-packet", FILES.gptPacket, "taskPacket");
checkKeyword("gpt-packet", FILES.gptPacket, "Human Approval");
checkKeyword("gpt-packet", FILES.gptPacket, "disabled");

console.log("--- gemini-agent-task-packet-v0.1.2.md keyword checks ---");
checkKeyword("gemini-packet-012", FILES.geminiPacket012, "Gemini");
checkKeyword("gemini-packet-012", FILES.geminiPacket012, "taskPacket");
checkKeyword("gemini-packet-012", FILES.geminiPacket012, "Human Approval");
checkKeyword("gemini-packet-012", FILES.geminiPacket012, "disabled");
checkKeyword("gemini-packet-012", FILES.geminiPacket012, "Secret Manager");

console.log("--- provider keyword checks ---");
checkKeyword("mock-provider", FILES.mockProvider, "mock");
checkKeyword("mock-provider", FILES.mockProvider, "run");
checkKeyword("gpt-provider",  FILES.gptProvider,  "LIVE_CALL_ENABLED");
checkKeyword("gpt-provider",  FILES.gptProvider,  "disabled");
checkKeyword("gemini-provider", FILES.geminiProvider, "LIVE_CALL_ENABLED");
checkKeyword("gemini-provider", FILES.geminiProvider, "disabled");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
