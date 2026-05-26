"use strict";

/**
 * generateClaudeFixInstructions
 * タスクパケットから Claude Code 向けの修正指示文を生成する。
 */
function generateClaudeFixInstructions(packet) {
  if (!packet || packet.targetAgent !== "claude-code") {
    throw new Error("Invalid packet for Claude Code");
  }

  const { payload } = packet;
  const { failureContext, safetyBoundary } = payload;

  return `
# Task: Bug Fix
The following error occurred:
\`\`\`
${failureContext.errorOutput}
\`\`\`

# Failing Tests:
${failureContext.failingTests.join("\n")}

# Instructions:
1. Analyze the error output.
2. Locate and fix the root cause in the source code.
3. Run the following commands to verify the fix:
   ${safetyBoundary.allowedCommands.join(", ")}

# Constraints:
- Do not modify files in: ${safetyBoundary.prohibitedFiles ? safetyBoundary.prohibitedFiles.join(", ") : "None specified"}
- Follow the KOSAME Dev Orchestra coding standards.
`.trim();
}

module.exports = {
  generateClaudeFixInstructions
};
