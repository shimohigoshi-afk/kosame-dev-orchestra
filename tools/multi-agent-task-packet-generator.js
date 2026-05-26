"use strict";

/**
 * generateGeminiPacket
 * Gemini 向けタスクパケットを生成する。
 */
function generateGeminiPacket(id, taskType, instructions) {
  return {
    packetId: id,
    version: "v0.4.4",
    sourceAgent: "pm-agent",
    targetAgent: "gemini-agent",
    taskType: taskType,
    payload: {
      instructions: instructions,
      geminiOptions: {
        model: "gemini-1.5-pro",
        temperature: 0.2
      }
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * generateClaudeFixPacket
 * Claude Code 向け修正パケットを生成する。
 */
function generateClaudeFixPacket(id, errorOutput, failingTests) {
  return {
    packetId: id,
    version: "v0.4.4",
    sourceAgent: "pm-agent",
    targetAgent: "claude-code",
    taskType: "bug-fix",
    payload: {
      failureContext: {
        errorOutput: errorOutput,
        failingTests: failingTests
      },
      fixInstructions: "エラー出力を解析し、関連するファイルを修正してテストをパスさせてください。",
      safetyBoundary: {
        allowedCommands: ["npm run smoke:*", "npm run verify"]
      }
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  generateGeminiPacket,
  generateClaudeFixPacket
};
