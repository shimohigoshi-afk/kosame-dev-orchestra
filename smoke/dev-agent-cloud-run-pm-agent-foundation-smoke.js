"use strict";

// Smoke test for v0.2.0 Cloud Run PM Agent foundation.
// Does NOT call any external API. Does NOT use dotenv. Does NOT read secrets.

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`);
  failed++;
}

function checkFile(label, filePath) {
  if (fs.existsSync(filePath)) {
    ok(`${label}: exists`);
  } else {
    fail(`${label}: not found at ${filePath}`);
  }
}

function checkKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes(keyword)) {
      ok(label);
    } else {
      fail(label);
    }
  } catch (e) {
    fail(label, `cannot read file: ${e.message}`);
  }
}

function checkNoKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} does NOT contain "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes(keyword)) {
      ok(label);
    } else {
      fail(label, "found forbidden pattern");
    }
  } catch (e) {
    fail(label, `cannot read file: ${e.message}`);
  }
}

const root = path.resolve(__dirname, "..");

const FILES = {
  pmAgent:      path.join(root, "apps/pm-agent/pm-agent.js"),
  schema:       path.join(root, "apps/pm-agent/task-packet-schema.js"),
  dryRun:       path.join(root, "apps/pm-agent/pm-agent-dry-run.js"),
  pmReadme:     path.join(root, "apps/pm-agent/README.md"),
  foundationDoc: path.join(root, "docs/ai-dev-team/cloud-run-pm-agent-foundation-v0.2.0.md"),
};

console.log("===== dev-agent-cloud-run-pm-agent-foundation smoke =====");

console.log("--- file existence checks ---");
checkFile("pm-agent.js",                         FILES.pmAgent);
checkFile("task-packet-schema.js",               FILES.schema);
checkFile("pm-agent-dry-run.js",                 FILES.dryRun);
checkFile("apps/pm-agent/README.md",             FILES.pmReadme);
checkFile("cloud-run-pm-agent-foundation-v0.2.0.md", FILES.foundationDoc);

console.log("--- require checks ---");
let pmAgent, schema, dryRunMod;
try {
  pmAgent = require(FILES.pmAgent);
  ok("require pm-agent.js");
} catch (e) { fail("require pm-agent.js", e.message); }

try {
  schema = require(FILES.schema);
  ok("require task-packet-schema.js");
} catch (e) { fail("require task-packet-schema.js", e.message); }

try {
  dryRunMod = require(FILES.dryRun);
  ok("require pm-agent-dry-run.js");
} catch (e) { fail("require pm-agent-dry-run.js", e.message); }

console.log("--- getPmAgentInfo() shape ---");
if (pmAgent && typeof pmAgent.getPmAgentInfo === "function") {
  const info = pmAgent.getPmAgentInfo();
  ok("getPmAgentInfo() exists");
  if (info.name === "KOSAME Cloud Run PM Agent") ok(`name === "KOSAME Cloud Run PM Agent"`);
  else fail(`name === "KOSAME Cloud Run PM Agent"`, `got: ${info.name}`);
  if (info.version === "v0.2.0") ok(`version === "v0.2.0"`);
  else fail(`version === "v0.2.0"`, `got: ${info.version}`);
  if (info.status === "foundation-only") ok(`status === "foundation-only"`);
  else fail(`status === "foundation-only"`, `got: ${info.status}`);
  if (info.plannedRuntime === "Cloud Run") ok(`plannedRuntime === "Cloud Run"`);
  else fail(`plannedRuntime === "Cloud Run"`, `got: ${info.plannedRuntime}`);
  if (info.sourceOfTruth === "GitHub") ok(`sourceOfTruth === "GitHub"`);
  else fail(`sourceOfTruth === "GitHub"`, `got: ${info.sourceOfTruth}`);
  if (info.secretStore === "Secret Manager") ok(`secretStore === "Secret Manager"`);
  else fail(`secretStore === "Secret Manager"`, `got: ${info.secretStore}`);
} else {
  fail("getPmAgentInfo() not exported");
}

console.log("--- task-packet-schema checks ---");
let sample;
if (schema) {
  if (typeof schema.createSampleTaskPacket === "function") {
    sample = schema.createSampleTaskPacket();
    ok("createSampleTaskPacket() exists");
    if (sample && typeof sample === "object" && sample.id && sample.kind) {
      ok("createSampleTaskPacket() returns valid-shaped packet");
    } else {
      fail("createSampleTaskPacket() must return object with id and kind");
    }
  } else {
    fail("createSampleTaskPacket() not exported");
  }

  if (typeof schema.validateTaskPacket === "function") {
    const result = schema.validateTaskPacket(sample);
    ok("validateTaskPacket() exists");
    if (result && result.valid === true) ok("validateTaskPacket(sample) => valid: true");
    else fail("validateTaskPacket(sample) => valid: true", `got: ${JSON.stringify(result)}`);
  } else {
    fail("validateTaskPacket() not exported");
  }

  if (typeof schema.getTaskPacketSchema === "function") {
    const s = schema.getTaskPacketSchema();
    ok("getTaskPacketSchema() exists");
    if (s && Array.isArray(s.required)) ok("schema has required array");
    else fail("schema.required must be an array");
  } else {
    fail("getTaskPacketSchema() not exported");
  }
}

console.log("--- decideTaskRoute: routing correctness ---");
if (pmAgent && typeof pmAgent.decideTaskRoute === "function") {
  // dry-run flag
  const sampleDecision = pmAgent.decideTaskRoute(sample || { id: "T-1", title: "t", kind: "implementation", riskLevel: "low" });
  if (sampleDecision.dryRun === true) ok("decideTaskRoute() returns dryRun: true");
  else fail("decideTaskRoute() must return dryRun: true", `got: ${sampleDecision.dryRun}`);

  // blocked / human approval required for dangerous kinds
  const dangerousKinds = ["deploy", "secret", "billing", "production_mutation"];
  for (const kind of dangerousKinds) {
    const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
    if (d.humanApprovalRequired === true && d.blocked === true) {
      ok(`kind "${kind}" => humanApprovalRequired: true, blocked: true`);
    } else {
      fail(`kind "${kind}" => humanApprovalRequired: true, blocked: true`, JSON.stringify(d));
    }
  }

  // critical riskLevel always blocked
  const criticalDecision = pmAgent.decideTaskRoute({ id: "T", title: "t", kind: "implementation", riskLevel: "critical" });
  if (criticalDecision.humanApprovalRequired === true && criticalDecision.blocked === true) {
    ok("riskLevel: critical => humanApprovalRequired: true, blocked: true");
  } else {
    fail("riskLevel: critical must be blocked", JSON.stringify(criticalDecision));
  }

  // Gemini 推奨
  const geminiKinds = ["docs", "summary", "classification"];
  for (const kind of geminiKinds) {
    const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
    if (d.recommendedOwner === "gemini") ok(`kind "${kind}" => recommendedOwner: gemini`);
    else fail(`kind "${kind}" => recommendedOwner: gemini`, `got: ${d.recommendedOwner}`);
  }

  // claude_code 推奨
  const claudeKinds = ["implementation", "smoke", "test"];
  for (const kind of claudeKinds) {
    const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
    if (d.recommendedOwner === "claude_code") ok(`kind "${kind}" => recommendedOwner: claude_code`);
    else fail(`kind "${kind}" => recommendedOwner: claude_code`, `got: ${d.recommendedOwner}`);
  }

  // kosame_pm 推奨
  const pmKinds = ["final_review", "safety_gate"];
  for (const kind of pmKinds) {
    const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
    if (d.recommendedOwner === "kosame_pm") ok(`kind "${kind}" => recommendedOwner: kosame_pm`);
    else fail(`kind "${kind}" => recommendedOwner: kosame_pm`, `got: ${d.recommendedOwner}`);
  }
} else {
  fail("decideTaskRoute() not exported");
}

console.log("--- safety: no external API calls or secrets in source files ---");
const safeFiles = [FILES.pmAgent, FILES.schema, FILES.dryRun];
for (const filePath of safeFiles) {
  const label = path.basename(filePath);
  checkNoKeyword(label, filePath, "fetch(");
  checkNoKeyword(label, filePath, "require('dotenv')");
  checkNoKeyword(label, filePath, 'require("dotenv")');
  checkNoKeyword(label, filePath, "readFileSync('.env')");
  checkNoKeyword(label, filePath, 'readFileSync(".env")');
  checkNoKeyword(label, filePath, "SecretManagerServiceClient");
  checkNoKeyword(label, filePath, "console.log(process.env.OPENAI_API_KEY");
  checkNoKeyword(label, filePath, "console.log(process.env.GEMINI_API_KEY");
}

console.log("--- docs: required content ---");
checkKeyword("foundation-doc", FILES.foundationDoc, "Cloud Run");
checkKeyword("foundation-doc", FILES.foundationDoc, "Human Approval");
checkKeyword("foundation-doc", FILES.foundationDoc, "Secret Manager");
checkKeyword("foundation-doc", FILES.foundationDoc, "GitHub Actions");
checkKeyword("foundation-doc", FILES.foundationDoc, "じゅんやさんをコピペ作業員にしない");
checkKeyword("foundation-doc", FILES.foundationDoc, "危険箇所だけガード");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
