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
  readme:          path.join(root, "README.md"),
  aiDevTeamReadme: path.join(root, "docs/ai-dev-team/README.md"),
  roleMap:         path.join(root, "docs/ai-dev-team/role-map-v0.1.0.md"),
  operatingFlow:   path.join(root, "docs/ai-dev-team/operating-flow-v0.1.0.md"),
  reuseGuide:      path.join(root, "docs/ai-dev-team/reuse-guide-v0.1.0.md"),
  handoffTemplate: path.join(root, "docs/ai-dev-team/project-handoff-template-v0.1.0.md"),
  geminiPacket:    path.join(root, "docs/ai-dev-team/gemini-agent-task-packet-v0.1.0.md"),
};

console.log("===== dev-agent-docs smoke =====");

console.log("--- file existence checks ---");
for (const [key, filePath] of Object.entries(FILES)) {
  checkFile(key, filePath);
}

console.log("--- README.md keyword checks ---");
checkKeyword("README", FILES.readme, "KOSAME Dev Orchestra");
checkKeyword("README", FILES.readme, "じゅんやさん");
checkKeyword("README", FILES.readme, "Claude Code");
checkKeyword("README", FILES.readme, "Gemini");
checkKeyword("README", FILES.readme, "Human Approval");

console.log("--- docs/ai-dev-team/README.md keyword checks ---");
checkKeyword("ai-dev-team/README", FILES.aiDevTeamReadme, "KOSAME Dev Orchestra");
checkKeyword("ai-dev-team/README", FILES.aiDevTeamReadme, "Gemini");
checkKeyword("ai-dev-team/README", FILES.aiDevTeamReadme, "Secret Manager");
checkKeyword("ai-dev-team/README", FILES.aiDevTeamReadme, "n8n");

console.log("--- role-map keyword checks ---");
checkKeyword("role-map", FILES.roleMap, "じゅんやさん");
checkKeyword("role-map", FILES.roleMap, "こさめ");
checkKeyword("role-map", FILES.roleMap, "Gemini");
checkKeyword("role-map", FILES.roleMap, "Claude Code");
checkKeyword("role-map", FILES.roleMap, "Secret Manager");
checkKeyword("role-map", FILES.roleMap, "n8n");
checkKeyword("role-map", FILES.roleMap, "Human Approval");

console.log("--- operating-flow keyword checks ---");
checkKeyword("operating-flow", FILES.operatingFlow, "じゅんやさん");
checkKeyword("operating-flow", FILES.operatingFlow, "Human Approval");
checkKeyword("operating-flow", FILES.operatingFlow, "deploy");
checkKeyword("operating-flow", FILES.operatingFlow, "Gemini");
checkKeyword("operating-flow", FILES.operatingFlow, "commit");

console.log("--- reuse-guide keyword checks ---");
checkKeyword("reuse-guide", FILES.reuseGuide, "KOSAME Dev Orchestra");
checkKeyword("reuse-guide", FILES.reuseGuide, "Claude Code");
checkKeyword("reuse-guide", FILES.reuseGuide, "Secret Manager");
checkKeyword("reuse-guide", FILES.reuseGuide, "Human Approval");

console.log("--- project-handoff-template keyword checks ---");
checkKeyword("handoff-template", FILES.handoffTemplate, "KOSAME Dev Orchestra");
checkKeyword("handoff-template", FILES.handoffTemplate, "Human Approval");
checkKeyword("handoff-template", FILES.handoffTemplate, "commit");
checkKeyword("handoff-template", FILES.handoffTemplate, "deploy");

console.log("--- gemini-agent-task-packet keyword checks ---");
checkKeyword("gemini-packet", FILES.geminiPacket, "Gemini");
checkKeyword("gemini-packet", FILES.geminiPacket, "Secret Manager");
checkKeyword("gemini-packet", FILES.geminiPacket, "Human Approval");
checkKeyword("gemini-packet", FILES.geminiPacket, "Cloud Run");

console.log(`===== result: ${passed} passed / ${failed} failed =====`);

if (failed > 0) {
  process.exit(1);
}
