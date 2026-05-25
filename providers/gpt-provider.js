"use strict";

// GPT provider — live API call disabled by default; requires --live flag AND all gate conditions met.
// See docs/ai-dev-team/agent-live-call-implementation-v0.1.5.md for details.
// APIキー値は絶対に出力しない。

const { getConfig } = require("./provider-config");

async function run(taskPacket, options = {}) {
  const config = getConfig();
  const shouldLive = options.live === true && config.openaiLiveEnabled;

  if (!shouldLive) {
    const gate = [
      `optionsLive=${options.live === true}`,
      `liveCallsActuallyEnabled=${config.liveCallsActuallyEnabled}`,
      `openaiKeyPresent=${config.openaiKeyPresent}`,
      `openaiLiveEnabled=${config.openaiLiveEnabled}`,
    ].join(" ");
    return {
      success: false,
      provider: "gpt",
      response: null,
      error: `gpt provider: dry-run — ${config.reason} [${gate}]`,
      dryRun: true,
    };
  }

  // Live path — only reached when --live flag and gate conditions are all met.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        messages: [
          {
            role: "system",
            content:
              "You are a cautious local agent runner for KOSAME Dev Orchestra.",
          },
          { role: "user", content: taskPacket.input },
        ],
        max_tokens: config.maxTokens,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        provider: "gpt",
        response: null,
        error: `gpt provider: API error ${res.status} ${res.statusText}`,
        dryRun: false,
      };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "(no content)";
    return {
      success: true,
      provider: "gpt",
      response: text.slice(0, 500),
      error: null,
      dryRun: false,
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      success: false,
      provider: "gpt",
      response: null,
      error: `gpt provider: fetch error — ${e.message}`,
      dryRun: false,
    };
  }
}

module.exports = { name: "gpt", run };
