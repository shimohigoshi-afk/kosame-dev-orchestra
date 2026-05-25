"use strict";

// GPT provider — live API call is disabled until Human Approval.
// See docs/ai-dev-team/agent-live-call-gate-v0.1.4.md for the activation procedure.

const { getConfig } = require("./provider-config");

async function run(taskPacket) {
  const config = getConfig();

  if (!config.liveCallsActuallyEnabled) {
    const gate = [
      `liveCallsRequested=${config.liveCallsRequested}`,
      `openaiKeyPresent=${config.openaiKeyPresent}`,
      `liveCallsActuallyEnabled=false`,
    ].join(" ");
    return {
      success: false,
      provider: "gpt",
      response: null,
      error: `gpt provider: live call disabled — ${config.reason} [${gate}]`,
      dryRun: true,
    };
  }

  // TODO(v0.1.5): implement OpenAI API call here after Human Approval.
  // const { OpenAI } = require("openai");
  // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  throw new Error("gpt provider: live path not yet implemented");
}

module.exports = { name: "gpt", run };
