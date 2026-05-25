"use strict";

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
  providerConfig:  path.join(root, "providers/provider-config.js"),
  gptProvider:     path.join(root, "providers/gpt-provider.js"),
  geminiProvider:  path.join(root, "providers/gemini-provider.js"),
  liveGateCheck:   path.join(root, "tools/agent-live-gate-check.js"),
  liveGateDoc:     path.join(root, "docs/ai-dev-team/agent-live-call-gate-v0.1.4.md"),
};

console.log("===== dev-agent-live-gate smoke =====");

console.log("--- file existence checks ---");
for (const [key, filePath] of Object.entries(FILES)) {
  checkFile(key, filePath);
}

console.log("--- provider-config.js content checks ---");
checkKeyword("provider-config", FILES.providerConfig, "KOSAME_AGENT_LIVE_CALLS_ENABLED");
checkKeyword("provider-config", FILES.providerConfig, "liveCallsActuallyEnabled");
checkKeyword("provider-config", FILES.providerConfig, "openaiKeyPresent");
checkKeyword("provider-config", FILES.providerConfig, "geminiKeyPresent");
checkNoKeyword("provider-config", FILES.providerConfig, "require('dotenv')");
checkNoKeyword("provider-config", FILES.providerConfig, 'require("dotenv")');
checkNoKeyword("provider-config", FILES.providerConfig, "readFileSync('.env')");
checkNoKeyword("provider-config", FILES.providerConfig, 'readFileSync(".env")');

console.log("--- provider-config: API key values are not logged ---");
checkNoKeyword("provider-config", FILES.providerConfig, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("provider-config", FILES.providerConfig, "console.log(process.env.GEMINI_API_KEY");

console.log("--- gpt-provider.js uses provider-config ---");
checkKeyword("gpt-provider", FILES.gptProvider, "provider-config");
checkKeyword("gpt-provider", FILES.gptProvider, "liveCallsActuallyEnabled");
checkKeyword("gpt-provider", FILES.gptProvider, "dryRun");

console.log("--- gemini-provider.js uses provider-config ---");
checkKeyword("gemini-provider", FILES.geminiProvider, "provider-config");
checkKeyword("gemini-provider", FILES.geminiProvider, "liveCallsActuallyEnabled");
checkKeyword("gemini-provider", FILES.geminiProvider, "dryRun");

console.log("--- docs/agent-live-call-gate-v0.1.4.md keyword checks ---");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "KOSAME Dev Orchestra");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "liveCallsActuallyEnabled");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "Human Approval");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "disabled");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "Secret Manager");
checkKeyword("live-gate-doc", FILES.liveGateDoc, ".env");
checkKeyword("live-gate-doc", FILES.liveGateDoc, "APIキー値は絶対に出力しない");

console.log("--- runtime: liveCallsActuallyEnabled === false ---");
try {
  const { getConfig } = require(path.join(root, "providers/provider-config"));
  const config = getConfig();
  if (config.liveCallsActuallyEnabled === false) {
    ok("liveCallsActuallyEnabled === false");
  } else {
    fail("liveCallsActuallyEnabled === false", `got ${config.liveCallsActuallyEnabled}`);
  }
  if (typeof config.liveCallsRequested === "boolean") {
    ok("liveCallsRequested is boolean");
  } else {
    fail("liveCallsRequested is boolean", `got ${typeof config.liveCallsRequested}`);
  }
  if (typeof config.openaiKeyPresent === "boolean") {
    ok("openaiKeyPresent is boolean");
  } else {
    fail("openaiKeyPresent is boolean", `got ${typeof config.openaiKeyPresent}`);
  }
  if (typeof config.geminiKeyPresent === "boolean") {
    ok("geminiKeyPresent is boolean");
  } else {
    fail("geminiKeyPresent is boolean", `got ${typeof config.geminiKeyPresent}`);
  }
  if (typeof config.reason === "string" && config.reason.length > 0) {
    ok("reason is non-empty string");
  } else {
    fail("reason is non-empty string", `got "${config.reason}"`);
  }
} catch (e) {
  fail("provider-config runtime check", e.message);
}

console.log("--- runtime: gpt/gemini providers return dryRun=true ---");
(async () => {
  try {
    const gptProvider = require(path.join(root, "providers/gpt-provider"));
    const r = await gptProvider.run({ id: "smoke", type: "review", input: "test", options: {} });
    if (r.dryRun === true) {
      ok("gpt provider dryRun === true");
    } else {
      fail("gpt provider dryRun === true", `got ${r.dryRun}`);
    }
    if (r.success === false) {
      ok("gpt provider success === false");
    } else {
      fail("gpt provider success === false", `got ${r.success}`);
    }
  } catch (e) {
    fail("gpt provider runtime check", e.message);
  }

  try {
    const geminiProvider = require(path.join(root, "providers/gemini-provider"));
    const r = await geminiProvider.run({ id: "smoke", type: "review", input: "test", options: {} });
    if (r.dryRun === true) {
      ok("gemini provider dryRun === true");
    } else {
      fail("gemini provider dryRun === true", `got ${r.dryRun}`);
    }
    if (r.success === false) {
      ok("gemini provider success === false");
    } else {
      fail("gemini provider success === false", `got ${r.success}`);
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
