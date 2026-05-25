"use strict";

const mockProvider = require("../providers/mock-provider");
const gptProvider = require("../providers/gpt-provider");
const geminiProvider = require("../providers/gemini-provider");

const providers = {
  mock: mockProvider,
  gpt: gptProvider,
  gemini: geminiProvider,
};

const taskPacket = {
  id: "task-route-001",
  type: "summarize",
  input: "KOSAME Dev Orchestra v0.1.2 agent interface を要約してください。",
  options: { language: "ja" },
};

async function main() {
  console.log("===== agent-router-dry-run =====");
  console.log("task packet:", JSON.stringify(taskPacket, null, 2));
  console.log("");

  for (const [name, provider] of Object.entries(providers)) {
    const result = await provider.run(taskPacket);
    console.log(`[${name}]`, JSON.stringify(result, null, 2));
  }

  console.log("===== end =====");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
