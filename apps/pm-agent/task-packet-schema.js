"use strict";

// Task Packet Schema for KOSAME Cloud Run PM Agent (v0.2.0)
// - No external API calls. No fetch. No dotenv. No Secret Manager.
// - Defines the minimum schema, validation, and a sample task packet.

const TASK_PACKET_SCHEMA = {
  required: ["id", "title", "kind", "riskLevel"],
  optional: [
    "targetRepo",
    "allowedFiles",
    "forbiddenFiles",
    "context",
    "acceptanceCriteria",
    "verificationCommands",
    "humanApprovalRequiredFor",
  ],
  fields: {
    id: {
      type: "string",
      description: "Unique task identifier (e.g. TASK-001)",
    },
    title: {
      type: "string",
      description: "Short human-readable task title",
    },
    kind: {
      type: "string",
      description: "Task category used for routing",
      allowedValues: [
        "docs",
        "summary",
        "bulk_reading",
        "classification",
        "implementation",
        "test",
        "smoke",
        "refactor",
        "product_decision",
        "final_review",
        "safety_gate",
        "deploy",
        "secret",
        "billing",
        "production_mutation",
      ],
    },
    riskLevel: {
      type: "string",
      description: "Risk classification of the task",
      allowedValues: ["low", "medium", "high", "critical"],
    },
    targetRepo: {
      type: "string",
      description: "Target repository (e.g. kosame-dev-orchestra)",
    },
    allowedFiles: {
      type: "array",
      description: "File paths Claude Code is permitted to modify",
    },
    forbiddenFiles: {
      type: "array",
      description: "File paths that must not be touched",
    },
    context: {
      type: "string",
      description: "Background information and motivation for the task",
    },
    acceptanceCriteria: {
      type: "array",
      description: "List of conditions that define task completion",
    },
    verificationCommands: {
      type: "array",
      description: "Commands to run to verify the task (e.g. npm run verify)",
    },
    humanApprovalRequiredFor: {
      type: "array",
      description: "Sub-operations within this task that require Human Approval",
    },
  },
};

function getTaskPacketSchema() {
  return TASK_PACKET_SCHEMA;
}

function validateTaskPacket(taskPacket) {
  if (!taskPacket || typeof taskPacket !== "object") {
    return { valid: false, errors: ["taskPacket must be a non-null object"] };
  }

  const errors = [];

  for (const field of TASK_PACKET_SCHEMA.required) {
    if (taskPacket[field] === undefined || taskPacket[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    } else if (typeof taskPacket[field] !== "string" || taskPacket[field].trim() === "") {
      errors.push(`Required field "${field}" must be a non-empty string`);
    }
  }

  if (taskPacket.kind) {
    const allowed = TASK_PACKET_SCHEMA.fields.kind.allowedValues;
    if (!allowed.includes(taskPacket.kind)) {
      errors.push(`Invalid kind "${taskPacket.kind}". Allowed: ${allowed.join(", ")}`);
    }
  }

  if (taskPacket.riskLevel) {
    const allowed = TASK_PACKET_SCHEMA.fields.riskLevel.allowedValues;
    if (!allowed.includes(taskPacket.riskLevel)) {
      errors.push(`Invalid riskLevel "${taskPacket.riskLevel}". Allowed: ${allowed.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function createSampleTaskPacket() {
  return {
    id: "TASK-001",
    title: "Add lightweight model routing to provider-config",
    kind: "implementation",
    riskLevel: "low",
    targetRepo: "kosame-dev-orchestra",
    allowedFiles: [
      "providers/provider-config.js",
      "docs/ai-dev-team/lightweight-model-routing-v0.1.9.md",
      "smoke/dev-agent-lightweight-model-routing-smoke.js",
    ],
    forbiddenFiles: [
      ".env",
      "node_modules/**",
      "~/anesty-board/**",
    ],
    context:
      "OpenAI and Gemini one-shot live calls have both succeeded. " +
      "Now formalise the lightweight model routing policy in provider-config.js.",
    acceptanceCriteria: [
      "lightweightRoutingPolicy is exported from getConfig()",
      "defaultGeminiModel is gemini-2.5-flash-lite",
      "defaultOpenAIModel is gpt-4o-mini",
      "bulkProcessingProvider is gemini",
      "reviewProvider is gpt",
      "npm run verify passes",
    ],
    verificationCommands: [
      "node --check providers/provider-config.js",
      "npm run verify",
    ],
    humanApprovalRequiredFor: [
      "git commit",
      "git push",
      "Any live API call",
    ],
  };
}

module.exports = { getTaskPacketSchema, validateTaskPacket, createSampleTaskPacket };
