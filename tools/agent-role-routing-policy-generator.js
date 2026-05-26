"use strict";

/**
 * suggestRole
 * タスクの種類に応じて、最適なエージェントロールを提案する。
 */
function suggestRole(taskType) {
  const mapping = {
    "design": "PM Agent",
    "management": "PM Agent",
    "review": "Gemini Agent",
    "summarize": "Gemini Agent",
    "gcp-check": "Gemini Agent",
    "implementation": "Claude Code",
    "bug-fix": "Claude Code",
    "refactor": "Claude Code",
    "cleanup": "Claude Code"
  };

  const role = mapping[taskType] || "Human / PM Agent";
  
  return {
    taskType,
    suggestedRole: role,
    reason: getReason(role, taskType)
  };
}

function getReason(role, taskType) {
  if (role === "Gemini Agent") return "大規模なコンテキスト処理と GCP 知識の活用";
  if (role === "Claude Code") return "高度な推論とツール実行による実装・修正";
  if (role === "PM Agent") return "プロジェクト全体俯瞰と意思決定";
  return "定義外のタスクのため人間の判断が必要";
}

module.exports = {
  suggestRole
};
