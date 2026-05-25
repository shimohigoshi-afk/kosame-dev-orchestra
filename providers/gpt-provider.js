"use strict";

// GPT provider — live API call is disabled until API key wiring is complete.
// See docs/ai-dev-team/agent-api-wiring-v0.1.3.md for the activation procedure.
// Human Approval is required before setting LIVE_CALL_ENABLED = true.

const LIVE_CALL_ENABLED = false;

async function run(taskPacket) {
  if (!LIVE_CALL_ENABLED) {
    return {
      success: false,
      provider: "gpt",
      response: null,
      error: "gpt provider: live call disabled — API key not configured",
      dryRun: true,
    };
  }

  // TODO(v0.1.4): implement OpenAI API call here after Human Approval.
  // const { OpenAI } = require("openai");
  // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  throw new Error("gpt provider: live path not yet implemented");
}

module.exports = { name: "gpt", run };
