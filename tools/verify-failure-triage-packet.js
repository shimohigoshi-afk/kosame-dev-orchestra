"use strict";

/**
 * generateTriagePacket
 * エラー出力を解析し、仕分け結果（Triage Packet）を生成する。
 */
function generateTriagePacket(errorOutput) {
  let category = "Unknown";
  let severity = "L2";

  if (errorOutput.includes("SyntaxError") || errorOutput.includes("unexpected token")) {
    category = "Syntax Error";
    severity = "L1";
  } else if (errorOutput.includes("FAIL") || errorOutput.includes("AssertionError")) {
    category = "Test Failure";
    severity = "L2";
  } else if (errorOutput.includes("ENOENT") || errorOutput.includes("not found")) {
    category = "Missing File";
    severity = "L2";
  } else if (errorOutput.includes("permission denied") || errorOutput.includes("EACCES")) {
    category = "Permission Error";
    severity = "L3";
  }

  return {
    version: "v0.4.6",
    category,
    severity,
    errorOutput: errorOutput.substring(0, 1000), // 長すぎる場合は切り詰め
    suggestedAction: severity === "L3" ? "Escalate to Human" : "Auto-assign to Claude Code",
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  generateTriagePacket
};
