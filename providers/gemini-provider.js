"use strict";

// Gemini provider — live API call is disabled until Human Approval.
// See docs/ai-dev-team/agent-live-call-gate-v0.1.4.md for the activation procedure.

const { getConfig } = require("./provider-config");

async function run(taskPacket) {
  const config = getConfig();

  if (!config.liveCallsActuallyEnabled) {
    const gate = [
      `liveCallsRequested=${config.liveCallsRequested}`,
      `geminiKeyPresent=${config.geminiKeyPresent}`,
      `liveCallsActuallyEnabled=false`,
    ].join(" ");
    return {
      success: false,
      provider: "gemini",
      response: null,
      error: `gemini provider: live call disabled — ${config.reason} [${gate}]`,
      dryRun: true,
    };
  }

  // TODO(v0.1.5): implement Gemini API call here after Human Approval.
  // const { GoogleGenerativeAI } = require("@google/generative-ai");
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  throw new Error("gemini provider: live path not yet implemented");
}

module.exports = { name: "gemini", run };
