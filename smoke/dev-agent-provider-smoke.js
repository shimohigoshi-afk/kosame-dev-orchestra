"use strict";

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

function check(label, condition, detail) {
  if (condition) {
    ok(label);
  } else {
    fail(label, detail || "condition false");
  }
}

const root = path.resolve(__dirname, "..");

console.log("===== dev-agent-provider smoke =====");

// --- require checks ---
console.log("--- require checks ---");

let mockProvider, gptProvider, geminiProvider;

try {
  mockProvider = require(path.join(root, "providers/mock-provider"));
  ok("require mock-provider");
} catch (e) {
  fail("require mock-provider", e.message);
}

try {
  gptProvider = require(path.join(root, "providers/gpt-provider"));
  ok("require gpt-provider");
} catch (e) {
  fail("require gpt-provider", e.message);
}

try {
  geminiProvider = require(path.join(root, "providers/gemini-provider"));
  ok("require gemini-provider");
} catch (e) {
  fail("require gemini-provider", e.message);
}

// --- interface shape checks ---
console.log("--- interface shape checks ---");

if (mockProvider) {
  check("mock-provider has name", typeof mockProvider.name === "string", `name=${mockProvider.name}`);
  check("mock-provider has run", typeof mockProvider.run === "function");
  check("mock-provider.name === 'mock'", mockProvider.name === "mock", `got "${mockProvider.name}"`);
}
if (gptProvider) {
  check("gpt-provider has name", typeof gptProvider.name === "string");
  check("gpt-provider has run", typeof gptProvider.run === "function");
  check("gpt-provider.name === 'gpt'", gptProvider.name === "gpt", `got "${gptProvider.name}"`);
}
if (geminiProvider) {
  check("gemini-provider has name", typeof geminiProvider.name === "string");
  check("gemini-provider has run", typeof geminiProvider.run === "function");
  check("gemini-provider.name === 'gemini'", geminiProvider.name === "gemini", `got "${geminiProvider.name}"`);
}

// --- runtime behavior checks ---
console.log("--- runtime behavior checks ---");

const samplePacket = {
  id: "smoke-001",
  type: "review",
  input: "smoke test input",
  options: {},
};

async function runChecks() {
  if (mockProvider) {
    const r = await mockProvider.run(samplePacket);
    check("mock run returns object",     typeof r === "object" && r !== null);
    check("mock success === true",       r.success === true,          `got ${r.success}`);
    check("mock provider === 'mock'",    r.provider === "mock",       `got "${r.provider}"`);
    check("mock response is string",     typeof r.response === "string");
    check("mock error is null",          r.error === null,            `got "${r.error}"`);
    check("mock dryRun === false",       r.dryRun === false,          `got ${r.dryRun}`);
  }

  if (gptProvider) {
    const r = await gptProvider.run(samplePacket);
    check("gpt run returns object",      typeof r === "object" && r !== null);
    check("gpt success === false",       r.success === false,         `got ${r.success}`);
    check("gpt provider === 'gpt'",      r.provider === "gpt",        `got "${r.provider}"`);
    check("gpt response is null",        r.response === null,         `got "${r.response}"`);
    check("gpt error contains 'disabled'", typeof r.error === "string" && r.error.includes("disabled"), `got "${r.error}"`);
    check("gpt dryRun === true",         r.dryRun === true,           `got ${r.dryRun}`);
  }

  if (geminiProvider) {
    const r = await geminiProvider.run(samplePacket);
    check("gemini run returns object",   typeof r === "object" && r !== null);
    check("gemini success === false",    r.success === false,         `got ${r.success}`);
    check("gemini provider === 'gemini'", r.provider === "gemini",   `got "${r.provider}"`);
    check("gemini response is null",     r.response === null,         `got "${r.response}"`);
    check("gemini error contains 'disabled'", typeof r.error === "string" && r.error.includes("disabled"), `got "${r.error}"`);
    check("gemini dryRun === true",      r.dryRun === true,           `got ${r.dryRun}`);
  }

  console.log(`===== result: ${passed} passed / ${failed} failed =====`);

  if (failed > 0) {
    process.exit(1);
  }
}

runChecks().catch((e) => {
  console.error("smoke error:", e);
  process.exit(1);
});
