"use strict";

/**
 * generateGeminiPrompt
 * タスクパケットから Gemini 向けのシステムプロンプトを生成する。
 */
function generateGeminiPrompt(packet) {
  if (!packet || packet.targetAgent !== "gemini-agent") {
    throw new Error("Invalid packet for Gemini Agent");
  }

  const { payload, taskType } = packet;

  return `
# Role: Gemini Agent (KOSAME Dev Orchestra)
You are an expert in Google Cloud and system analysis.
Task Type: ${taskType}

# Instructions:
${payload.instructions}

# Guidelines:
- Provide analysis in Japanese.
- Focus on ${payload.focusAreas ? payload.focusAreas.join(", ") : "security, cost, and best practices"}.
- Use JSON format for structured data output if possible.

# Request:
Please execute the task based on the above.
`.trim();
}

module.exports = {
  generateGeminiPrompt
};
