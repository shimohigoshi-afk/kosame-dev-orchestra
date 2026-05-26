"use strict";

// Smoke test for v0.1.8 Gemini one-shot live call success record.
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
  successRecord: path.join(root, "docs/ai-dev-team/gemini-one-shot-success-record-v0.1.8.md"),
};

console.log("===== dev-agent-gemini-one-shot-success smoke =====");

console.log("--- file existence checks ---");
checkFile("gemini-one-shot-success-record-v0.1.8.md", FILES.successRecord);

console.log("--- success record: required content ---");
checkKeyword("success-record", FILES.successRecord, "readyForOneShot: true");
checkKeyword("success-record", FILES.successRecord, "success: true");
checkKeyword("success-record", FILES.successRecord, "provider: gemini");
checkKeyword("success-record", FILES.successRecord, "dryRun: false");
checkKeyword("success-record", FILES.successRecord, "error: null");
checkKeyword("success-record", FILES.successRecord, "APIキー値を記録しない");
checkKeyword("success-record", FILES.successRecord, "cleanup済み");
checkKeyword("success-record", FILES.successRecord, "git status");
checkKeyword("success-record", FILES.successRecord, "gemini-2.5-flash-lite");
checkKeyword("success-record", FILES.successRecord, "OpenAI");

console.log("--- safety: no real key patterns in success record ---");
checkNoKeyword("success-record", FILES.successRecord, "sk-");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
