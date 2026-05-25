"use strict";

const mockProvider = require("../providers/mock-provider");
const gptProvider = require("../providers/gpt-provider");
const geminiProvider = require("../providers/gemini-provider");

const providers = {
  mock: mockProvider,
  gpt: gptProvider,
  gemini: geminiProvider,
};

function getProviderName() {
  const arg = process.argv.find((a) => a.startsWith("--provider="));
  return arg ? arg.replace("--provider=", "") : "mock";
}

const providerName = getProviderName();
const provider = providers[providerName];

if (!provider) {
  console.error(
    `Unknown provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
  );
  process.exit(1);
}

const taskPacket = {
  id: "task-local-001",
  type: "generate",
  input: "KOSAME Dev Orchestra の役割を1文で説明してください。",
  options: { language: "ja" },
};

async function main() {
  console.log(`===== agent-runner-local [provider=${providerName}] =====`);
  console.log("task packet:", JSON.stringify(taskPacket, null, 2));
  console.log("");

  const result = await provider.run(taskPacket);
  console.log("result:", JSON.stringify(result, null, 2));
  console.log("===== end =====");

  if (!result.success) {
    console.log(
      `INFO: provider="${providerName}" is not live — dry-run mode. This is expected.`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
