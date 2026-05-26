"use strict";

// KOSAME Cloud Run PM Agent — foundation (v0.2.0)
// - No external API calls. No fetch. No dotenv. No Secret Manager.
// - Returns routing decisions as dry-run only in this version.
// - References provider-config.js for lightweightRoutingPolicy when available.

const path = require("path");

// Load lightweightRoutingPolicy from provider-config if available.
// Falls back to a hard-coded policy so this module is self-contained.
let _routingPolicy = null;
try {
  const configPath = path.resolve(__dirname, "../../providers/provider-config.js");
  const { getConfig } = require(configPath);
  _routingPolicy = getConfig().lightweightRoutingPolicy || null;
} catch (_) {
  // provider-config not available — use built-in policy below.
}

const BUILT_IN_ROUTING_POLICY = {
  bulkProcessingProvider: "gemini",
  reviewProvider: "gpt",
  premiumReviewProvider: "gpt",
  defaultGeminiModel: "gemini-2.5-flash-lite",
  defaultOpenAIModel: "gpt-4o-mini",
  premiumGeminiModel: "gemini-2.5-pro",
  premiumOpenAIModel: "gpt-4o",
};

const routingPolicy = _routingPolicy || BUILT_IN_ROUTING_POLICY;

// Task kind → recommended owner mapping.
const KIND_ROUTING = {
  // Gemini 寄せ: 大量処理・下読み・分類・要約
  docs:            { recommendedOwner: "gemini",          humanApprovalRequired: false, blocked: false },
  summary:         { recommendedOwner: "gemini",          humanApprovalRequired: false, blocked: false },
  bulk_reading:    { recommendedOwner: "gemini",          humanApprovalRequired: false, blocked: false },
  classification:  { recommendedOwner: "gemini",          humanApprovalRequired: false, blocked: false },
  // Claude Code 寄せ: 実装・テスト・smoke
  implementation:  { recommendedOwner: "claude_code",     humanApprovalRequired: false, blocked: false },
  test:            { recommendedOwner: "claude_code",     humanApprovalRequired: false, blocked: false },
  smoke:           { recommendedOwner: "claude_code",     humanApprovalRequired: false, blocked: false },
  refactor:        { recommendedOwner: "claude_code",     humanApprovalRequired: false, blocked: false },
  // PM / GPT 寄せ: 判断・レビュー・安全ゲート
  product_decision: { recommendedOwner: "kosame_pm",     humanApprovalRequired: false, blocked: false },
  final_review:    { recommendedOwner: "kosame_pm",       humanApprovalRequired: false, blocked: false },
  safety_gate:     { recommendedOwner: "kosame_pm",       humanApprovalRequired: false, blocked: false },
  // Human Approval 必須: deploy / secret / billing / 本番変更
  deploy:              { recommendedOwner: "human",       humanApprovalRequired: true,  blocked: true  },
  secret:              { recommendedOwner: "human",       humanApprovalRequired: true,  blocked: true  },
  billing:             { recommendedOwner: "human",       humanApprovalRequired: true,  blocked: true  },
  production_mutation: { recommendedOwner: "human",       humanApprovalRequired: true,  blocked: true  },
};

const RISK_OVERRIDE = {
  // critical riskLevel always requires human approval regardless of kind
  critical: { recommendedOwner: "human", humanApprovalRequired: true, blocked: true },
};

function getPmAgentInfo() {
  return {
    name: "KOSAME Cloud Run PM Agent",
    version: "v0.2.0",
    status: "foundation-only",
    plannedRuntime: "Cloud Run",
    sourceOfTruth: "GitHub",
    secretStore: "Secret Manager",
    allowedResponsibilities: [
      "Task intake and validation",
      "Dry-run routing decision",
      "Task packet schema enforcement",
      "Routing policy application",
      "Human Approval gate check",
    ],
    forbiddenResponsibilities: [
      "Reading API key values",
      "Reading Secret Manager values",
      "Executing live API calls without Human Approval",
      "Deploying to Cloud Run",
      "Mutating production environments",
      "Billing operations",
    ],
    humanApprovalRequiredFor: [
      "deploy",
      "secret",
      "billing",
      "production_mutation",
      "Any task with riskLevel: critical",
      "Enabling live API calls (--live flag + gate conditions)",
    ],
    routingPolicy,
  };
}

function decideTaskRoute(taskPacket) {
  if (!taskPacket || typeof taskPacket !== "object") {
    return {
      success: false,
      dryRun: true,
      recommendedOwner: null,
      reason: "Invalid task packet: must be an object",
      humanApprovalRequired: false,
      blocked: true,
      nextAction: "Provide a valid task packet object",
    };
  }

  const kind = taskPacket.kind || "";
  const riskLevel = taskPacket.riskLevel || "low";

  // Risk-level override: critical always requires human approval.
  if (riskLevel === "critical") {
    const override = RISK_OVERRIDE.critical;
    return {
      success: true,
      dryRun: true,
      recommendedOwner: override.recommendedOwner,
      reason: `riskLevel "critical" requires Human Approval regardless of task kind`,
      humanApprovalRequired: override.humanApprovalRequired,
      blocked: override.blocked,
      nextAction: "Obtain Human Approval before proceeding",
    };
  }

  const kindRule = KIND_ROUTING[kind];

  if (!kindRule) {
    return {
      success: true,
      dryRun: true,
      recommendedOwner: "kosame_pm",
      reason: `Unknown task kind "${kind}" — escalating to PM for triage`,
      humanApprovalRequired: false,
      blocked: false,
      nextAction: "PM to triage and assign appropriate owner",
    };
  }

  const nextAction = kindRule.blocked
    ? "Obtain Human Approval before proceeding"
    : `Assign to ${kindRule.recommendedOwner} and proceed`;

  return {
    success: true,
    dryRun: true,
    recommendedOwner: kindRule.recommendedOwner,
    reason: _buildReason(kind, kindRule, routingPolicy),
    humanApprovalRequired: kindRule.humanApprovalRequired,
    blocked: kindRule.blocked,
    nextAction,
  };
}

function _buildReason(kind, rule, policy) {
  if (rule.blocked) {
    return `Task kind "${kind}" requires Human Approval — blocked at PM Agent gate`;
  }
  if (rule.recommendedOwner === "gemini") {
    return `Task kind "${kind}" → bulk/read/classify → ${policy.bulkProcessingProvider} (${policy.defaultGeminiModel})`;
  }
  if (rule.recommendedOwner === "claude_code") {
    return `Task kind "${kind}" → implementation/test/smoke → claude_code`;
  }
  if (rule.recommendedOwner === "kosame_pm") {
    return `Task kind "${kind}" → decision/review/gate → ${policy.reviewProvider} (${policy.defaultOpenAIModel}) via PM`;
  }
  return `Task kind "${kind}" → ${rule.recommendedOwner}`;
}

function createDryRunDecision(taskPacket) {
  return decideTaskRoute(taskPacket);
}

module.exports = { getPmAgentInfo, decideTaskRoute, createDryRunDecision };
