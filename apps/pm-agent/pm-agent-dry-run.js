"use strict";

// PM Agent dry-run CLI tool (v0.2.0)
// - Loads a sample task packet and runs decideTaskRoute() dry-run.
// - No external API calls. No fetch. No dotenv. No Secret Manager.
// Run: node apps/pm-agent/pm-agent-dry-run.js

const { getPmAgentInfo, decideTaskRoute } = require("./pm-agent.js");
const { createSampleTaskPacket, validateTaskPacket } = require("./task-packet-schema.js");

function runDryRun(taskPacket) {
  const info = getPmAgentInfo();
  const validation = validateTaskPacket(taskPacket);
  const decision = decideTaskRoute(taskPacket);

  return {
    agent: {
      name: info.name,
      version: info.version,
      status: info.status,
    },
    taskPacket: {
      id: taskPacket.id,
      title: taskPacket.title,
      kind: taskPacket.kind,
      riskLevel: taskPacket.riskLevel,
    },
    validation,
    decision,
    meta: {
      executedAt: new Date().toISOString(),
      note: "This is a dry-run. No external API was called. No Secret was read.",
    },
  };
}

function runAndPrint(taskPacket) {
  const result = runDryRun(taskPacket);
  console.log("===== PM Agent Dry-Run =====");
  console.log(JSON.stringify(result, null, 2));
  console.log("===== end =====");
  return result;
}

if (require.main === module) {
  const sample = createSampleTaskPacket();
  runAndPrint(sample);
}

module.exports = { runDryRun, runAndPrint };
