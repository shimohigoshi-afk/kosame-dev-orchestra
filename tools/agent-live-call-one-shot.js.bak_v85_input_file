"use strict";

// One-shot live call tool for KOSAME Dev Orchestra.
// Purpose: Human-approved single call to verify live API connectivity.
// Default: live=false (dry-run). Requires --live to attempt live call.
// --live alone is not enough: gate env vars and API key must also be present.
// APIキー値は絶対に出力しない。
// 1回だけ実行して終了する。外部APIは gate 条件未達なら呼ばない。

const gptProvider = require("../providers/gpt-provider");
const geminiProvider = require("../providers/gemini-provider");
const { getConfig } = require("../providers/provider-config");

const SUPPORTED_PROVIDERS = ["gpt", "gemini"];

function getProviderName() {
  const arg = process.argv.find((a) => a.startsWith("--provider="));
  return arg ? arg.replace("--provider=", "") : null;
}

function getLiveFlag() {
  return process.argv.includes("--live");
}

const providerName = getProviderName();
const liveFlag = getLiveFlag();

if (!providerName || !SUPPORTED_PROVIDERS.includes(providerName)) {
  console.error(
    `agent-live-call-one-shot: --provider=<gpt|gemini> required. Got: ${providerName ?? "(none)"}`
  );
  process.exit(1);
}

const provider = providerName === "gpt" ? gptProvider : geminiProvider;

const taskPacket = {
  id: "task-one-shot-001",
  type: "generate",
  input: "KOSAME Dev Orchestra の役割を1文で説明してください。",
  options: { language: "ja" },
};

async function main() {
  const config = getConfig();

  console.log(`===== agent-live-call-one-shot [provider=${providerName}] =====`);
  console.log("live gate summary:", {
    liveFlag,
    liveCallsActuallyEnabled: config.liveCallsActuallyEnabled,
    openaiLiveEnabled: config.openaiLiveEnabled,
    geminiLiveEnabled: config.geminiLiveEnabled,
  });

  if (!liveFlag) {
    console.log("INFO: --live not specified — dry-run only. No external API will be called.");
  }

  const providerLiveEnabled =
    providerName === "gpt" ? config.openaiLiveEnabled : config.geminiLiveEnabled;

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
