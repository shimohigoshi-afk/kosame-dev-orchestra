"use strict";

// One-shot live call tool for KOSAME Dev Orchestra.
// Supports:
//   --provider=<gpt|gemini>
//   --live
//   --input-file=/path/to/task.txt
//   --input="inline text"
// APIキー値は絶対に出力しない。

const fs = require("fs");
const gptProvider = require("../providers/gpt-provider");
const geminiProvider = require("../providers/gemini-provider");
const deepseekProvider = require("../providers/deepseek-provider");
const { getConfig } = require("../providers/provider-config");

const SUPPORTED_PROVIDERS = ["gpt", "gemini", "deepseek"];

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function getProviderName() {
  return getArgValue("provider");
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

const providerName = getProviderName();
const liveFlag = getLiveFlag();

if (!providerName || !SUPPORTED_PROVIDERS.includes(providerName)) {
  console.error(
    `agent-live-call-one-shot: --provider=<gpt|gemini|deepseek> required. Got: ${providerName ?? "(none)"}`
  );
  process.exit(1);
}

const providerMap = { gpt: gptProvider, gemini: geminiProvider, deepseek: deepseekProvider };
const provider = providerMap[providerName];

const taskPacket = {
  id: getArgValue("task-id") || "task-one-shot-001",
  type: getArgValue("type") || "generate",
  input: readInputText(),
  options: {
    language: getArgValue("language") || "ja",
  },
};

async function main() {
  const config = getConfig();

  console.log(`===== agent-live-call-one-shot [provider=${providerName}] =====`);
  console.log("live gate summary:", {
    liveFlag,
    liveCallsActuallyEnabled: config.liveCallsActuallyEnabled,
    openaiLiveEnabled: config.openaiLiveEnabled,
    geminiLiveEnabled: config.geminiLiveEnabled,
    deepseekLiveEnabled: config.deepseekLiveEnabled,
  });

  console.log("task packet:", JSON.stringify({
    ...taskPacket,
    input: taskPacket.input.length > 1000
      ? taskPacket.input.slice(0, 1000) + `\n... [truncated ${taskPacket.input.length} chars]`
      : taskPacket.input
  }, null, 2));

  if (!liveFlag) {
    console.log("INFO: --live not specified — dry-run only. No external API will be called.");
  }

  const providerLiveEnabledMap = {
    gpt: config.openaiLiveEnabled,
    gemini: config.geminiLiveEnabled,
    deepseek: config.deepseekLiveEnabled,
  };
  const providerLiveEnabled = providerLiveEnabledMap[providerName];

  if (liveFlag && !providerLiveEnabled) {
    console.log(
      `INFO: --live specified but gate conditions not met for provider="${providerName}". ` +
        "No external API will be called."
    );
  }

  const options = { live: liveFlag };
  const result = await provider.run(taskPacket, options);

  console.log("result:", JSON.stringify(result, null, 2));
  console.log(`===== end [dryRun=${result.dryRun}] =====`);
}

main().catch((e) => {
  console.error("agent-live-call-one-shot error:", e.message);
  process.exit(1);
});
