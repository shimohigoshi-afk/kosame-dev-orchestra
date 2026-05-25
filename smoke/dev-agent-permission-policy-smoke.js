"use strict";

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function checkFile(label, filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`  PASS  ${label}: exists`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}: not found at ${filePath}`);
    failed++;
  }
}

function checkKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes(keyword)) {
      console.log(`  PASS  ${label}`);
      passed++;
    } else {
      console.error(`  FAIL  ${label}`);
      failed++;
    }
  } catch (e) {
    console.error(`  FAIL  ${label}: cannot read file: ${e.message}`);
    failed++;
  }
}

const root = path.resolve(__dirname, "..");

const FILES = {
  permissionPolicy: path.join(root, "docs/ai-dev-team/permission-policy-v0.1.0.md"),
  commandBatching: path.join(root, "docs/ai-dev-team/claude-code-command-batching-v0.1.0.md"),
  ticket: path.join(root, "tickets/common/kosame_dev_orchestra_permission_strategy_v0_1_0.md"),
};

const REQUIRED_KEYWORDS = [
  "KOSAME Dev Orchestra",
  "Claude Code",
  "command batching",
  "human approval",
  "Secret Manager",
  "git push",
  "deploy",
  "じゅんやさんをコピペ作業員にしない",
];

console.log("===== dev-agent-permission-policy smoke =====");

console.log("--- file existence checks ---");
checkFile("permission-policy-v0.1.0.md", FILES.permissionPolicy);
checkFile("claude-code-command-batching-v0.1.0.md", FILES.commandBatching);
checkFile("kosame_dev_orchestra_permission_strategy_v0_1_0.md", FILES.ticket);

console.log("--- permission-policy keyword checks ---");
for (const kw of REQUIRED_KEYWORDS) {
  checkKeyword("permission-policy", FILES.permissionPolicy, kw);
}

console.log("--- command-batching keyword checks ---");
for (const kw of REQUIRED_KEYWORDS) {
  checkKeyword("command-batching", FILES.commandBatching, kw);
}

console.log("--- ticket keyword checks ---");
for (const kw of REQUIRED_KEYWORDS) {
  checkKeyword("ticket", FILES.ticket, kw);
}

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
