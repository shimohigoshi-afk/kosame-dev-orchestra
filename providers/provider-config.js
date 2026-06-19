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

const deepseekKeyPresent =
  typeof process.env.DEEPSEEK_API_KEY === "string" &&
  process.env.DEEPSEEK_API_KEY.length > 0;

const llamaKeyPresent =
  typeof process.env.LLAMA_API_KEY === "string" &&
  process.env.LLAMA_API_KEY.length > 0;

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

// Lightweight model defaults (env-overridable).
// Gemini: gemini-2.5-flash-lite as lightweight default.
// OpenAI: gpt-4o-mini as lightweight default.
const defaultGeminiModel =
  typeof process.env.KOSAME_AGENT_MODEL_GEMINI === "string" &&
  process.env.KOSAME_AGENT_MODEL_GEMINI.length > 0
    ? process.env.KOSAME_AGENT_MODEL_GEMINI
    : "gemini-2.5-flash-lite";

const defaultOpenAIModel =
  typeof process.env.KOSAME_AGENT_MODEL_OPENAI === "string" &&
  process.env.KOSAME_AGENT_MODEL_OPENAI.length > 0
    ? process.env.KOSAME_AGENT_MODEL_OPENAI
    : "gpt-4o-mini";

// Premium (upper-tier) models — used only for high-risk / high-stakes tasks.
// Both are env-overridable so Human Approval can redirect to any model.
const premiumGeminiModel =
  typeof process.env.KOSAME_AGENT_PREMIUM_MODEL_GEMINI === "string" &&
  process.env.KOSAME_AGENT_PREMIUM_MODEL_GEMINI.length > 0
    ? process.env.KOSAME_AGENT_PREMIUM_MODEL_GEMINI
    : "gemini-2.5-pro";

const premiumOpenAIModel =
  typeof process.env.KOSAME_AGENT_PREMIUM_MODEL_OPENAI === "string" &&
  process.env.KOSAME_AGENT_PREMIUM_MODEL_OPENAI.length > 0
    ? process.env.KOSAME_AGENT_PREMIUM_MODEL_OPENAI
    : "gpt-4o";

// Lightweight routing policy.
// - bulkProcessingProvider: 大量処理・下読み・分類・要約は Gemini 寄せ
// - reviewProvider: 判断・レビュー・PM補助は GPT 寄せ
// - premiumReviewProvider: 高リスク・高単価・最終レビューは env で切り替え可能
const premiumReviewProvider =
  typeof process.env.KOSAME_AGENT_PREMIUM_REVIEW_PROVIDER === "string" &&
  process.env.KOSAME_AGENT_PREMIUM_REVIEW_PROVIDER.length > 0
    ? process.env.KOSAME_AGENT_PREMIUM_REVIEW_PROVIDER
    : "gpt";

const lightweightRoutingPolicy = {
  bulkProcessingProvider: "gemini",
  reviewProvider: "gpt",
  premiumReviewProvider,
  defaultGeminiModel,
  defaultOpenAIModel,
  premiumGeminiModel,
  premiumOpenAIModel,
};

// Keep legacy aliases for backward-compat with existing providers.
const openaiModel = defaultOpenAIModel;
const geminiModel = defaultGeminiModel;

// Base gate: both env vars must be "true".
const liveCallsActuallyEnabled = liveCallsRequested && oneShotAllowed;

// Provider-level gate: base gate AND the relevant API key present.
const openaiLiveEnabled = liveCallsActuallyEnabled && openaiKeyPresent;
const geminiLiveEnabled = liveCallsActuallyEnabled && geminiKeyPresent;
const deepseekLiveEnabled = liveCallsActuallyEnabled && deepseekKeyPresent;

const llamaAuditLane = {
  key: "llama_audit",
  provider: "llama",
  role: "audit/review",
  status: llamaKeyPresent ? "configured" : "missing",
  allowedUses: [
    "sanitized diff",
    "smoke review",
    "docs review",
    "security review",
  ],
  forbiddenUses: [
    "Secret",
    ".env",
    "credentials",
    "customer data",
    "Sales DX",
    "transcriber",
    "独自プロンプト",
    "保険ロジック",
  ],
  apiKeyPresent: llamaKeyPresent,
  apiKeyStatus: llamaKeyPresent ? "configured" : "missing",
};

function getConfig() {
  return {
    liveCallsRequested,
    oneShotAllowed,
    openaiKeyPresent,
    geminiKeyPresent,
    deepseekKeyPresent,
    llamaKeyPresent,
    openaiModel,
    geminiModel,
    maxTokens,
    timeoutMs,
    liveCallsActuallyEnabled,
    openaiLiveEnabled,
    geminiLiveEnabled,
    deepseekLiveEnabled,
    llamaAuditLane,
    lightweightRoutingPolicy,
    reason: liveCallsActuallyEnabled
      ? "live calls gate open (key presence required per provider)"
      : "live calls disabled — KOSAME_AGENT_LIVE_CALLS_ENABLED or KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL not set to true",
  };
}

module.exports = { getConfig };
