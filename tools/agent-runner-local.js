"use strict";

const fs = require("fs");
const mockProvider = require("../providers/mock-provider");
const gptProvider = require("../providers/gpt-provider");
const geminiProvider = require("../providers/gemini-provider");
const { getConfig } = require("../providers/provider-config");

const providers = {
  mock: mockProvider,
  gpt: gptProvider,
  gemini: geminiProvider,
};

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function getProviderName() {
  return getArgValue("provider") || "mock";
}

function getLiveFlag() {
  return process.argv.includes("--live");
}

function readInputText() {
  const inputFile = getArgValue("input-file");
  const inlineInput = getArgValue("input");

  if (inputFile) {
    return fs.readFileSync(inputFile, "utf8");
  }

  if (inlineInput) {
    return inlineInput;
  }

  return "KOSAME Dev Orchestra の役割を1文で説明してください。";
}

function buildTaskPacket() {
  return {
    id: getArgValue("task-id") || "task-local-001",
    type: getArgValue("type") || "generate",
    input: readInputText(),
    options: {
      language: getArgValue("language") || "ja",
    },
  };
}

const providerName = getProviderName();
const provider = providers[providerName];
const liveFlag = getLiveFlag();
const taskPacket = buildTaskPacket();

if (!provider) {
  console.error(
    `Unknown provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
  );
  process.exit(1);
}

async function main() {
  console.log(`===== agent-runner-local [provider=${providerName}] =====`);
  console.log("task packet:", JSON.stringify({
    ...taskPacket,
    input: taskPacket.input.length > 1000
      ? taskPacket.input.slice(0, 1000) + `\n... [truncated ${taskPacket.input.length} chars]`
      : taskPacket.input
  }, null, 2));
  console.log("");

  if (providerName === "gpt" || providerName === "gemini") {
    const config = getConfig();
    console.log("live gate:", {
      liveFlag,
      liveCallsRequested: config.liveCallsRequested,
      oneShotAllowed: config.oneShotAllowed,
      openaiKeyPresent: config.openaiKeyPresent,
      geminiKeyPresent: config.geminiKeyPresent,
      liveCallsActuallyEnabled: config.liveCallsActuallyEnabled,
      openaiLiveEnabled: config.openaiLiveEnabled,
      geminiLiveEnabled: config.geminiLiveEnabled,
    });
    if (!liveFlag) {
      console.log("INFO: --live not specified — dry-run mode (no external API call)");
    }
    console.log("");
  }

  const options = { live: liveFlag };
  const result = await provider.run(taskPacket, options);
  console.log("result:", JSON.stringify(result, null, 2));
  console.log("===== end =====");

  if (!result.success) {
    console.log(
      `INFO: provider="${providerName}" dryRun=${result.dryRun} — no external API called.`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
