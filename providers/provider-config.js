"use strict";

// Centralized live call gate for all providers.
// - Reads only boolean key presence from process.env — never outputs key values.
// - Does NOT read .env files, Secret Manager, or GitHub Secrets.
// - liveCallsActuallyEnabled is always false in v0.1.4.
//   Flipping it requires Human Approval.

const liveCallsRequested =
  process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED === "true";

const openaiKeyPresent =
  typeof process.env.OPENAI_API_KEY === "string" &&
  process.env.OPENAI_API_KEY.length > 0;

const geminiKeyPresent =
  typeof process.env.GEMINI_API_KEY === "string" &&
  process.env.GEMINI_API_KEY.length > 0;

// v0.1.4: blocked until Human Approval — do not set true without approval.
const liveCallsActuallyEnabled = false;

function getConfig() {
  return {
    liveCallsRequested,
    openaiKeyPresent,
    geminiKeyPresent,
    liveCallsActuallyEnabled,
    reason: liveCallsActuallyEnabled
      ? "live calls enabled"
      : "live calls are still disabled until human approval",
  };
}

module.exports = { getConfig };
