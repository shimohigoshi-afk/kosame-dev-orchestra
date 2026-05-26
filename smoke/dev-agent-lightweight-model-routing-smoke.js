"use strict";

// Smoke test for v0.1.9 lightweight model routing policy.
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
  providerConfig: path.join(root, "providers/provider-config.js"),
  routingDoc: path.join(root, "docs/ai-dev-team/lightweight-model-routing-v0.1.9.md"),
};

console.log("===== dev-agent-lightweight-model-routing smoke =====");

console.log("--- file existence checks ---");
checkFile("provider-config.js", FILES.providerConfig);
checkFile("lightweight-model-routing-v0.1.9.md", FILES.routingDoc);

console.log("--- provider-config: require and shape ---");
let config;
try {
  const { getConfig } = require(FILES.providerConfig);
  config = getConfig();
  ok("provider-config: require succeeds");
} catch (e) {
  fail("provider-config: require", e.message);
}

if (config) {
  const policy = config.lightweightRoutingPolicy;

  if (policy) {
    ok("lightweightRoutingPolicy: exists");

    if (policy.defaultGeminiModel === "gemini-2.5-flash-lite") {
      ok(`defaultGeminiModel === "gemini-2.5-flash-lite"`);
    } else {
      fail(`defaultGeminiModel === "gemini-2.5-flash-lite"`, `got: ${policy.defaultGeminiModel}`);
    }

    if (typeof policy.defaultOpenAIModel === "string" && policy.defaultOpenAIModel.length > 0) {
      ok(`defaultOpenAIModel exists: "${policy.defaultOpenAIModel}"`);
    } else {
      fail("defaultOpenAIModel exists and is non-empty string");
    }

    if (policy.bulkProcessingProvider === "gemini") {
      ok(`bulkProcessingProvider === "gemini"`);
    } else {
      fail(`bulkProcessingProvider === "gemini"`, `got: ${policy.bulkProcessingProvider}`);
    }

    if (policy.reviewProvider === "gpt") {
      ok(`reviewProvider === "gpt"`);
    } else {
      fail(`reviewProvider === "gpt"`, `got: ${policy.reviewProvider}`);
    }

    if (typeof policy.premiumReviewProvider === "string" && policy.premiumReviewProvider.length > 0) {
      ok(`premiumReviewProvider exists (env-overridable): "${policy.premiumReviewProvider}"`);
    } else {
      fail("premiumReviewProvider exists and is non-empty string");
    }

    if (typeof policy.premiumGeminiModel === "string" && policy.premiumGeminiModel.length > 0) {
      ok(`premiumGeminiModel exists (env-overridable): "${policy.premiumGeminiModel}"`);
    } else {
      fail("premiumGeminiModel exists and is non-empty string");
    }

    if (typeof policy.premiumOpenAIModel === "string" && policy.premiumOpenAIModel.length > 0) {
      ok(`premiumOpenAIModel exists (env-overridable): "${policy.premiumOpenAIModel}"`);
    } else {
      fail("premiumOpenAIModel exists and is non-empty string");
    }
  } else {
    fail("lightweightRoutingPolicy: missing from getConfig()");
  }

  // Ensure no API key values are returned
  const configStr = JSON.stringify(config);
  if (!configStr.includes(process.env.OPENAI_API_KEY || "\x00") ||
      process.env.OPENAI_API_KEY === undefined) {
    ok("config does not expose OPENAI_API_KEY value");
  } else {
    fail("config must not expose OPENAI_API_KEY value");
  }

  if (!configStr.includes(process.env.GEMINI_API_KEY || "\x00") ||
      process.env.GEMINI_API_KEY === undefined) {
    ok("config does not expose GEMINI_API_KEY value");
  } else {
    fail("config must not expose GEMINI_API_KEY value");
  }
}

console.log("--- provider-config: no external API calls ---");
checkNoKeyword("provider-config", FILES.providerConfig, "fetch(");
checkNoKeyword("provider-config", FILES.providerConfig, "require('dotenv')");
checkNoKeyword("provider-config", FILES.providerConfig, 'require("dotenv")');
checkNoKeyword("provider-config", FILES.providerConfig, "SecretManagerServiceClient");
checkNoKeyword("provider-config", FILES.providerConfig, "readFileSync('.env')");
checkNoKeyword("provider-config", FILES.providerConfig, 'readFileSync(".env")');

console.log("--- provider-config: no key value logging ---");
checkNoKeyword("provider-config", FILES.providerConfig, "console.log(process.env.OPENAI_API_KEY");
checkNoKeyword("provider-config", FILES.providerConfig, "console.log(process.env.GEMINI_API_KEY");

console.log("--- routing doc: required content ---");
checkKeyword("routing-doc", FILES.routingDoc, "gemini-2.5-flash-lite");
checkKeyword("routing-doc", FILES.routingDoc, "gpt-4o-mini");
checkKeyword("routing-doc", FILES.routingDoc, "bulkProcessingProvider");
checkKeyword("routing-doc", FILES.routingDoc, "reviewProvider");
checkKeyword("routing-doc", FILES.routingDoc, "premiumReviewProvider");
checkKeyword("routing-doc", FILES.routingDoc, "Human Approval");
checkKeyword("routing-doc", FILES.routingDoc, "APIキー値");
checkKeyword("routing-doc", FILES.routingDoc, "Secret");
checkKeyword("routing-doc", FILES.routingDoc, "BackOffice");
checkKeyword("routing-doc", FILES.routingDoc, "API を実行しない");

console.log("--- routing doc: no real key patterns ---");
checkNoKeyword("routing-doc", FILES.routingDoc, "sk-");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
