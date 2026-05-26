"use strict";

/**
 * generateApprovalPolicyStatus
 * v0.4.3 の承認ポリシーに基づき、現在のポリシーサマリーを返却する。
 */
function generateApprovalPolicyStatus() {
  return {
    version: "v0.4.3",
    policyName: "YES地獄削減 / Approval Policy Pack",
    categories: {
      allowed: [
        "ls, grep, cat, find",
        "git status, git diff",
        "npm run smoke:*",
        "npm run verify",
        "git add"
      ],
      ask: [
        "git commit",
        "git push",
        "npm install",
        "gcloud / railway"
      ],
      deny: [
        "rm -rf",
        "git reset --hard",
        "env, printenv"
      ]
    },
    recommendation: "低リスクな Allowed 操作は Batching で実行し、Ask 操作でのみ人間の判断を仰いでください。"
  };
}

module.exports = {
  generateApprovalPolicyStatus
};
