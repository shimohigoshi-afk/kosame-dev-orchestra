"use strict";

// Centralized provider configuration and live call gate for all providers.
// - Reads only boolean key presence from process.env — never outputs key values.
// - Does NOT read .env files, Secret Manager, or GitHub Secrets.
// - liveCallsActuallyEnabled requires KOSAME_AGENT_LIVE_CALLS_ENABLED and
//   KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL both set to "true".
// - Provider-level live enablement also requires the relevant API key.
// - Executing a live call further requires --live flag in the caller.

const liveCallsRequested =
  process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED === "true";

const oneShotAllowed =
  process.env.KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL === "true";

const openaiKeyPresent =
  typeof process.env.OPENAI_API_KEY === "string" &&
  process.env.OPENAI_API_KEY.length > 0;

const geminiKeyPresent =
  typeof process.env.GEMINI_API_KEY === "string" &&
  process.env.GEMINI_API_KEY.length > 0;

const MAX_TOKENS_CAP = 1000;
const TIMEOUT_MS_CAP = 30000;

const rawMaxTokens = parseInt(process.env.KOSAME_AGENT_MAX_TOKENS, 10);
const maxTokens = Number.isFinite(rawMaxTokens)
  ? Math.min(rawMaxTokens, MAX_TOKENS_CAP)
  : 300;

const rawTimeoutMs = parseInt(process.env.KOSAME_AGENT_TIMEOUT_MS, 10);
const timeoutMs = Number.isFinite(rawTimeoutMs)
  ? Math.min(rawTimeoutMs, TIMEOUT_MS_CAP)
  : 15000;

const openaiModel =
  typeof process.env.KOSAME_AGENT_MODEL_OPENAI === "string" &&
  process.env.KOSAME_AGENT_MODEL_OPENAI.length > 0
    ? process.env.KOSAME_AGENT_MODEL_OPENAI
    : "gpt-4o-mini";

const geminiModel =
  typeof process.env.KOSAME_AGENT_MODEL_GEMINI === "string" &&
  process.env.KOSAME_AGENT_MODEL_GEMINI.length > 0
    ? process.env.KOSAME_AGENT_MODEL_GEMINI
    : "gemini-1.5-flash";

// Base gate: both env vars must be "true".
const liveCallsActuallyEnabled = liveCallsRequested && oneShotAllowed;

// Provider-level gate: base gate AND the relevant API key present.
const openaiLiveEnabled = liveCallsActuallyEnabled && openaiKeyPresent;
const geminiLiveEnabled = liveCallsActuallyEnabled && geminiKeyPresent;

function getConfig() {
  return {
    liveCallsRequested,
    oneShotAllowed,
    openaiKeyPresent,
    geminiKeyPresent,
    openaiModel,
    geminiModel,
    maxTokens,
    timeoutMs,
    liveCallsActuallyEnabled,
    openaiLiveEnabled,
    geminiLiveEnabled,
    reason: liveCallsActuallyEnabled
      ? "live calls gate open (key presence required per provider)"
      : "live calls disabled — KOSAME_AGENT_LIVE_CALLS_ENABLED or KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL not set to true",
  };
}

module.exports = { getConfig };
