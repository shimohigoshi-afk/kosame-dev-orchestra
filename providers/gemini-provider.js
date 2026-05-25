"use strict";

// Gemini provider — live API call is disabled until API key wiring is complete.
// See docs/ai-dev-team/agent-api-wiring-v0.1.3.md for the activation procedure.
// Human Approval is required before setting LIVE_CALL_ENABLED = true.

const LIVE_CALL_ENABLED = false;

async function run(taskPacket) {
  if (!LIVE_CALL_ENABLED) {
    return {
      success: false,
      provider: "gemini",
      response: null,
      error: "gemini provider: live call disabled — API key not configured",
      dryRun: true,
    };
  }

  // TODO(v0.1.4): implement Gemini API call here after Human Approval.
  // const { GoogleGenerativeAI } = require("@google/generative-ai");
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  throw new Error("gemini provider: live path not yet implemented");
}

module.exports = { name: "gemini", run };
