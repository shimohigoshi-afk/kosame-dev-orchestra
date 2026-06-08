"use strict";

// DeepSeek provider — live API call disabled by default; requires --live flag AND all gate conditions met.
// Endpoint: https://api.deepseek.com/v1/chat/completions (OpenAI-compatible)
// Model: deepseek-chat
// Input passes through sanitized handoff (cross-provider-handoff-packet-pack) before reaching the API.
// APIキー値は絶対に出力しない。

const { getConfig } = require("./provider-config");
const { buildPacket } = require("../tools/cross-provider-handoff-packet-pack");

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

function sanitizeInput(rawInput) {
  const handoff = buildPacket({
    fromProvider: "kosame",
    toProvider: "deepseek",
    taskSummary: rawInput.slice(0, 200),
    dataLevel: "A",
    completedSteps: [],
    remainingSteps: ["deepseek-inference"],
  });

  if (!handoff.validation.valid) {
    throw new Error(`sanitized handoff rejected: ${handoff.validation.reason}`);
  }

  return rawInput;
}

async function run(taskPacket, options = {}) {
  const config = getConfig();
  const shouldLive = options.live === true && config.deepseekLiveEnabled;

  if (!shouldLive) {
    const gate = [
      `optionsLive=${options.live === true}`,
      `liveCallsActuallyEnabled=${config.liveCallsActuallyEnabled}`,
      `deepseekKeyPresent=${config.deepseekKeyPresent}`,
      `deepseekLiveEnabled=${config.deepseekLiveEnabled}`,
    ].join(" ");
    return {
      success: false,
      provider: "deepseek",
      response: null,
      error: `deepseek provider: dry-run — ${config.reason} [${gate}]`,
      dryRun: true,
    };
  }

  let sanitizedInput;
  try {
    sanitizedInput = sanitizeInput(taskPacket.input);
  } catch (e) {
    return {
      success: false,
      provider: "deepseek",
      response: null,
      error: `deepseek provider: handoff validation failed — ${e.message}`,
      dryRun: false,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a cautious local agent runner for KOSAME Dev Orchestra.",
          },
          { role: "user", content: sanitizedInput },
        ],
        max_tokens: config.maxTokens,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        provider: "deepseek",
        response: null,
        error: `deepseek provider: API error ${res.status} ${res.statusText}`,
        dryRun: false,
      };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "(no content)";
    return {
      success: true,
      provider: "deepseek",
      response: text.slice(0, 500),
      error: null,
      dryRun: false,
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      success: false,
      provider: "deepseek",
      response: null,
      error: `deepseek provider: fetch error — ${e.message}`,
      dryRun: false,
    };
  }
}

module.exports = { name: "deepseek", run };
