"use strict";

// Smoke test for v0.1.6 secret/API key injection guide and one-shot preflight.
// Does NOT call any external API.

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
  injectionGuide:  path.join(root, "docs/ai-dev-team/secret-api-key-injection-guide-v0.1.6.md"),
  oneShotChecklist: path.join(root, "docs/ai-dev-team/one-shot-live-call-checklist-v0.1.6.md"),
  preflight:       path.join(root, "tools/agent-one-shot-preflight.js"),
};

console.log("===== dev-agent-secret-injection smoke =====");

console.log("--- file existence checks ---");
checkFile("secret-api-key-injection-guide-v0.1.6.md", FILES.injectionGuide);
checkFile("one-shot-live-call-checklist-v0.1.6.md", FILES.oneShotChecklist);
checkFile("agent-one-shot-preflight.js", FILES.preflight);

console.log("--- injection guide: required content ---");
checkKeyword("injection-guide", FILES.injectionGuide, "APIキー値");
checkKeyword("injection-guide", FILES.injectionGuide, "AIチャット");
checkKeyword("injection-guide", FILES.injectionGuide, "OPENAI_API_KEY");
checkKeyword("injection-guide", FILES.injectionGuide, "GEMINI_API_KEY");
checkKeyword("injection-guide", FILES.injectionGuide, "KOSAME_AGENT_LIVE_CALLS_ENABLED");
checkKeyword("injection-guide", FILES.injectionGuide, "KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL");
checkKeyword("injection-guide", FILES.injectionGuide, "Human Approval");
checkKeyword("injection-guide", FILES.injectionGuide, "boolean");

console.log("--- one-shot checklist: required content ---");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "1回だけ");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "Human Approval");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "KOSAME_AGENT_LIVE_CALLS_ENABLED");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "APIキー値");
checkKeyword("one-shot-checklist", FILES.oneShotChecklist, "preflight");

console.log("--- safety: no real key patterns in docs ---");
checkNoKeyword("injection-guide", FILES.injectionGuide, "sk-");
checkNoKeyword("one-shot-checklist", FILES.oneShotChecklist, "sk-");

console.log("--- preflight tool: no external API calls ---");
checkNoKeyword("preflight", FILES.preflight, "fetch(");
checkNoKeyword("preflight", FILES.preflight, "require('dotenv')");
checkNoKeyword("preflight", FILES.preflight, 'require("dotenv")');
checkNoKeyword("preflight", FILES.preflight, "SecretManagerServiceClient");
checkNoKeyword("preflight", FILES.preflight, "readFileSync('.env')");
checkNoKeyword("preflight", FILES.preflight, 'readFileSync(".env")');
checkNoKeyword("preflight", FILES.preflight, "sk-");
checkNoKeyword("preflight", FILES.preflight, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("preflight", FILES.preflight, "console.log(process.env.GEMINI_API_KEY");

console.log("--- preflight tool: uses provider-config ---");
checkKeyword("preflight", FILES.preflight, "provider-config");
checkKeyword("preflight", FILES.preflight, "readyForOneShot");
checkKeyword("preflight", FILES.preflight, "providerKeyPresent");
checkKeyword("preflight", FILES.preflight, "did not call any external API");


const __savedSecretEnv = {
  KOSAME_AGENT_LIVE_CALLS_ENABLED: process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED,
  KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL: process.env.KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

delete process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
delete process.env.KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

console.log("--- runtime: preflight returns expected shape ---");

(async () => {
  try {
    const { preflight } = require(path.join(root, "tools/agent-one-shot-preflight"));

    const gptResult = await preflight("gpt");
    if (typeof gptResult === "object" && gptResult !== null) {
      ok("preflight('gpt') returns object");
    } else {
      fail("preflight('gpt') returns object", `got ${typeof gptResult}`);
    }
    if (typeof gptResult.readyForOneShot === "boolean") {
      ok("preflight('gpt').readyForOneShot is boolean");
    } else {
      fail("preflight('gpt').readyForOneShot is boolean", `got ${typeof gptResult.readyForOneShot}`);
    }
    if (gptResult.provider === "gpt") {
      ok("preflight('gpt').provider === 'gpt'");
    } else {
      fail("preflight('gpt').provider === 'gpt'", `got ${gptResult.provider}`);
    }
    if (typeof gptResult.checks === "object") {
      ok("preflight('gpt').checks is object");
    } else {
      fail("preflight('gpt').checks is object", `got ${typeof gptResult.checks}`);
    }
    if (gptResult.note && gptResult.note.includes("did not call any external API")) {
      ok("preflight('gpt').note mentions no external API");
    } else {
      fail("preflight('gpt').note mentions no external API", `got "${gptResult.note}"`);
    }

    const geminiResult = await preflight("gemini");
    if (geminiResult.provider === "gemini") {
      ok("preflight('gemini').provider === 'gemini'");
    } else {
      fail("preflight('gemini').provider === 'gemini'", `got ${geminiResult.provider}`);
    }
    if (typeof geminiResult.readyForOneShot === "boolean") {
      ok("preflight('gemini').readyForOneShot is boolean");
    } else {
      fail("preflight('gemini').readyForOneShot is boolean", `got ${typeof geminiResult.readyForOneShot}`);
    }

    // Without env vars, readyForOneShot must be false (gate conditions not met)
    if (gptResult.readyForOneShot === false) {
      ok("preflight('gpt').readyForOneShot === false (no env vars)");
    } else {
      fail("preflight('gpt').readyForOneShot === false (no env vars)", `got ${gptResult.readyForOneShot}`);
    }

    // Check that checks shape has expected keys
    const expectedKeys = ["liveCallsRequested", "oneShotAllowed", "providerKeyPresent", "maxTokensOk", "timeoutOk"];
    for (const key of expectedKeys) {
      if (key in gptResult.checks) {
        ok(`preflight('gpt').checks has "${key}"`);
      } else {
        fail(`preflight('gpt').checks has "${key}"`);
      }
    }
  } catch (e) {
    fail("preflight runtime check", e.message);
  }

  // Verify error on unsupported provider
  try {
    const { preflight } = require(path.join(root, "tools/agent-one-shot-preflight"));
    await preflight("mock");
    fail("preflight('mock') should throw");
  } catch (e) {
    ok("preflight('mock') throws (unsupported provider)");
  }

  console.log(`===== result: ${passed} passed / ${failed} failed =====`);

  if (failed > 0) {
    process.exit(1);
  }
})().catch((e) => {
  console.error("smoke error:", e);
  process.exit(1);
});
