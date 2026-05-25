"use strict";

// One-shot preflight check for KOSAME Dev Orchestra.
// Verifies gate conditions WITHOUT calling any external API.
// APIキー値は表示しない。.envは読まない。Secret Managerは読まない。
// 存在判定(boolean)のみ行う。

const { getConfig } = require("../providers/provider-config");

const SUPPORTED_PROVIDERS = ["gpt", "gemini"];

function getProviderName() {
  const arg = process.argv.find((a) => a.startsWith("--provider="));
  return arg ? arg.replace("--provider=", "") : null;
}

function buildResult(providerName) {
  const config = getConfig();

  const providerKeyPresent =
    providerName === "gpt" ? config.openaiKeyPresent : config.geminiKeyPresent;

  const maxTokensOk = config.maxTokens > 0 && config.maxTokens <= 1000;
  const timeoutOk = config.timeoutMs > 0 && config.timeoutMs <= 30000;

  const checks = {
    liveCallsRequested: config.liveCallsRequested,
    oneShotAllowed: config.oneShotAllowed,
    providerKeyPresent,
    maxTokensOk,
    timeoutOk,
  };

  const readyForOneShot = Object.values(checks).every((v) => v === true);

  const missing = Object.entries(checks)
    .filter(([, v]) => v !== true)
    .map(([k]) => k);

  return {
    provider: providerName,
    checks,
    readyForOneShot,
    missing: missing.length > 0 ? missing : undefined,
    note: "This preflight did not call any external API.",
  };
}

async function preflight(providerName) {
  if (!providerName || !SUPPORTED_PROVIDERS.includes(providerName)) {
    throw new Error(
      `agent-one-shot-preflight: --provider=<gpt|gemini> required. Got: ${providerName ?? "(none)"}`
    );
  }
  return buildResult(providerName);
}

if (require.main === module) {
  const providerName = getProviderName();

  if (!providerName) {
    console.error(
      "agent-one-shot-preflight: --provider=<gpt|gemini> is required."
    );
    process.exit(1);
  }

  if (!SUPPORTED_PROVIDERS.includes(providerName)) {
    console.error(
      `agent-one-shot-preflight: unsupported provider "${providerName}". ` +
        `Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
    process.exit(1);
  }

  const result = buildResult(providerName);
  console.log(JSON.stringify(result, null, 2));

  if (!result.readyForOneShot) {
    console.log(
      `\nINFO: Not ready for one-shot live call. Missing: ${result.missing.join(", ")}`
    );
    process.exit(1);
  }

  console.log("\nINFO: Preflight passed. Ready for one-shot live call (Human Approval required).");
  process.exit(0);
}

module.exports = { preflight };
