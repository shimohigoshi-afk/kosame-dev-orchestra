"use strict";

// Smoke test for v0.1.5 live-call implementation.
// Verifies file existence, implementation patterns, and safety constraints.
// Does NOT call external APIs.

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
  liveCallDoc:     path.join(root, "docs/ai-dev-team/agent-live-call-implementation-v0.1.5.md"),
  oneShotTool:     path.join(root, "tools/agent-live-call-one-shot.js"),
  gptProvider:     path.join(root, "providers/gpt-provider.js"),
  geminiProvider:  path.join(root, "providers/gemini-provider.js"),
  runnerLocal:     path.join(root, "tools/agent-runner-local.js"),
  providerConfig:  path.join(root, "providers/provider-config.js"),
};

console.log("===== dev-agent-live-call-implementation smoke =====");

console.log("--- file existence checks ---");
checkFile("live-call-implementation-doc", FILES.liveCallDoc);
checkFile("agent-live-call-one-shot", FILES.oneShotTool);
checkFile("gpt-provider", FILES.gptProvider);
checkFile("gemini-provider", FILES.geminiProvider);
checkFile("agent-runner-local", FILES.runnerLocal);

console.log("--- gpt-provider: fetch implementation ---");
checkKeyword("gpt-provider", FILES.gptProvider, "fetch(");
checkKeyword("gpt-provider", FILES.gptProvider, "AbortController");
checkKeyword("gpt-provider", FILES.gptProvider, "max_tokens");
checkKeyword("gpt-provider", FILES.gptProvider, "api.openai.com");
checkKeyword("gpt-provider", FILES.gptProvider, "Authorization");

console.log("--- gemini-provider: fetch implementation ---");
checkKeyword("gemini-provider", FILES.geminiProvider, "fetch(");
checkKeyword("gemini-provider", FILES.geminiProvider, "AbortController");
checkKeyword("gemini-provider", FILES.geminiProvider, "maxOutputTokens");
checkKeyword("gemini-provider", FILES.geminiProvider, "generativelanguage.googleapis.com");

console.log("--- agent-runner-local: --live flag support ---");
checkKeyword("agent-runner-local", FILES.runnerLocal, "--live");
checkKeyword("agent-runner-local", FILES.runnerLocal, "liveFlag");

console.log("--- safety: no API key values in output ---");
checkNoKeyword("gpt-provider", FILES.gptProvider, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("gpt-provider", FILES.gptProvider, "console.log(process.env.GEMINI_API_KEY");
checkNoKeyword("gemini-provider", FILES.geminiProvider, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("gemini-provider", FILES.geminiProvider, "console.log(process.env.GEMINI_API_KEY");
checkNoKeyword("agent-runner-local", FILES.runnerLocal, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("agent-runner-local", FILES.runnerLocal, "console.log(process.env.GEMINI_API_KEY");
checkNoKeyword("one-shot-tool", FILES.oneShotTool, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("one-shot-tool", FILES.oneShotTool, "console.log(process.env.GEMINI_API_KEY");

console.log("--- safety: no dotenv or .env reading ---");
checkNoKeyword("gpt-provider",    FILES.gptProvider,    "require('dotenv')");
checkNoKeyword("gpt-provider",    FILES.gptProvider,    'require("dotenv")');
checkNoKeyword("gemini-provider", FILES.geminiProvider, "require('dotenv')");
checkNoKeyword("gemini-provider", FILES.geminiProvider, 'require("dotenv")');
checkNoKeyword("agent-runner-local", FILES.runnerLocal, "require('dotenv')");
checkNoKeyword("agent-runner-local", FILES.runnerLocal, 'require("dotenv")');
checkNoKeyword("provider-config", FILES.providerConfig, "require('dotenv')");
checkNoKeyword("provider-config", FILES.providerConfig, 'require("dotenv")');
checkNoKeyword("one-shot-tool",   FILES.oneShotTool,   "require('dotenv')");
checkNoKeyword("one-shot-tool",   FILES.oneShotTool,   'require("dotenv")');
checkNoKeyword("gpt-provider",    FILES.gptProvider,    "readFileSync('.env')");
checkNoKeyword("gpt-provider",    FILES.gptProvider,    'readFileSync(".env")');
checkNoKeyword("gemini-provider", FILES.geminiProvider, "readFileSync('.env')");
checkNoKeyword("gemini-provider", FILES.geminiProvider, 'readFileSync(".env")');

console.log("--- docs: live call activation requirements ---");
checkKeyword("live-call-doc", FILES.liveCallDoc, "--live");
checkKeyword("live-call-doc", FILES.liveCallDoc, "KOSAME_AGENT_LIVE_CALLS_ENABLED");
checkKeyword("live-call-doc", FILES.liveCallDoc, "KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL");
checkKeyword("live-call-doc", FILES.liveCallDoc, "Human Approval");
checkKeyword("live-call-doc", FILES.liveCallDoc, "dry-run");
checkKeyword("live-call-doc", FILES.liveCallDoc, "APIキー値");

console.log("--- runtime: providers dry-run when options.live not set ---");
(async () => {
  try {
    const gpt = require(path.join(root, "providers/gpt-provider"));
    const r = await gpt.run({ id: "smoke", type: "review", input: "test", options: {} });
    if (r.dryRun === true) {
      ok("gpt provider dryRun === true (no options)");
    } else {
      fail("gpt provider dryRun === true (no options)", `got ${r.dryRun}`);
    }
    if (r.success === false) {
      ok("gpt provider success === false (no options)");
    } else {
      fail("gpt provider success === false (no options)", `got ${r.success}`);
    }
  } catch (e) {
    fail("gpt provider runtime check", e.message);
  }

  try {
    const gemini = require(path.join(root, "providers/gemini-provider"));
    const r = await gemini.run(
      { id: "smoke", type: "review", input: "test", options: {} },
      { live: false }
    );
    if (r.dryRun === true) {
      ok("gemini provider dryRun === true (live=false)");
    } else {
      fail("gemini provider dryRun === true (live=false)", `got ${r.dryRun}`);
    }
    if (r.success === false) {
      ok("gemini provider success === false (live=false)");
    } else {
      fail("gemini provider success === false (live=false)", `got ${r.success}`);
    }
  } catch (e) {
    fail("gemini provider runtime check", e.message);
  }

  console.log(`===== result: ${passed} passed / ${failed} failed =====`);

  if (failed > 0) {
    process.exit(1);
  }
})().catch((e) => {
  console.error("smoke error:", e);
  process.exit(1);
});
