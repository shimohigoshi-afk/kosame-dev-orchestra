"use strict";

// Gemini provider — live API call disabled by default; requires --live flag AND all gate conditions met.
// See docs/ai-dev-team/agent-live-call-implementation-v0.1.5.md for details.
// APIキー値は絶対に出力しない。

const { getConfig } = require("./provider-config");

async function run(taskPacket, options = {}) {
  const config = getConfig();
  const shouldLive = options.live === true && config.geminiLiveEnabled;

  if (!shouldLive) {
    const gate = [
      `optionsLive=${options.live === true}`,
      `liveCallsActuallyEnabled=${config.liveCallsActuallyEnabled}`,
      `geminiKeyPresent=${config.geminiKeyPresent}`,
      `geminiLiveEnabled=${config.geminiLiveEnabled}`,
    ].join(" ");
    return {
      success: false,
      provider: "gemini",
      response: null,
      error: `gemini provider: dry-run — ${config.reason} [${gate}]`,
      dryRun: true,
    };
  }

  // Live path — only reached when --live flag and gate conditions are all met.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: taskPacket.input }] }],
        generationConfig: { maxOutputTokens: config.maxTokens },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        provider: "gemini",
        response: null,
        error: `gemini provider: API error ${res.status} ${res.statusText}`,
        dryRun: false,
      };
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no content)";
    return {
      success: true,
      provider: "gemini",
      response: text.slice(0, 500),
      error: null,
      dryRun: false,
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      success: false,
      provider: "gemini",
      response: null,
      error: `gemini provider: fetch error — ${e.message}`,
      dryRun: false,
    };
  }
}

module.exports = { name: "gemini", run };
