"use strict";

// KOSAME Cloud Run PM Agent — Secret Manager Readiness Pack (v0.4.2)
// Generates checklists and instructions for Secret Manager setup.
// IMPORTANT: Does NOT read, print, or access any secret values.
// AI can only see secret names (placeholders). Values are managed by humans only.
// Does not use process-spawn calls or synchronous shell execution.
// Human Approval required for all Secret Manager operations.

function generateSecretPresenceChecklist(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Secret presence checklist — names only, values never exposed",
    dryRun: true,
    humanApprovalRequired: true,
    projectId,
    secretNamesToConfirm: [
      "OPENAI_API_KEY (if using OpenAI — confirm in GCP Console only)",
      "GEMINI_API_KEY (if using Gemini — confirm in GCP Console only)",
    ],
    humanVerificationMethod: "GCP Console → Secret Manager → confirm secret name exists",
    forbidden: [
      "AI cannot access secret values",
      "Never print secret values in logs or terminal output",
      "Never store secret values in code, Git, or documentation",
      "Do not pass secret values to this tool or any automated script",
    ],
    iamCheck: {
      cloudRunServiceAccount: "Cloud Run default SA (or custom SA)",
      requiredRole: "Secret Manager Secret Accessor",
      verificationMethod: "GCP Console → IAM → confirm role assignment",
      note: "IAM role assignment requires Human Approval",
    },
    note: "Human confirms secret existence in GCP Console. AI does not access values.",
  };
}

function generateRuntimeEnvVarChecklist(options) {
  const opts = options || {};

  return {
    description: "Runtime environment variable checklist — names only, values never exposed",
    dryRun: true,
    humanApprovalRequired: true,
    envVarNames: [
      "NODE_ENV (set to production via --set-env-vars in gcloud run deploy)",
      "PORT (set to 8080 via --set-env-vars in gcloud run deploy)",
      "OPENAI_API_KEY (via secretKeyRef — only if OpenAI is needed)",
      "GEMINI_API_KEY (via secretKeyRef — only if Gemini is needed)",
    ],
    secretRefPattern: "Use secretKeyRef in cloud-run/pm-agent-service.template.yaml",
    verificationMethod: "GCP Console → Cloud Run → service → Edit → Environment variables",
    forbidden: [
      "Never hardcode API key values in Dockerfile, YAML, or code",
      "Never use --set-env-vars for secret values — use secretKeyRef only",
    ],
    note: "Verify env vars in GCP Console after deploy. AI does not print or access values.",
  };
}

function generateHumanSecretSetupInstructions(options) {
  const opts = options || {};
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Secret setup instructions for humans — v0.4.2",
    dryRun: true,
    humanApprovalRequired: true,
    instructions: [
      {
        step: 1,
        action: "GCP Console → Secret Manager を開く",
        note: "AI はこの操作を実行しない",
      },
      {
        step: 2,
        action: "必要な Secret を作成する（名前のみ確認・値は人間のみ入力）",
        secretNamesToCreate: [
          "OPENAI_API_KEY (if needed)",
          "GEMINI_API_KEY (if needed)",
        ],
        forbidden: "AI に値を渡さない・ターミナルに値を出力しない",
      },
      {
        step: 3,
        action: "Cloud Run Service Account に Secret Manager Secret Accessor ロールを付与",
        iamConsole: `GCP Console → IAM → ${projectId} → Service Account に役割追加`,
      },
      {
        step: 4,
        action: "cloud-run/pm-agent-service.template.yaml の secretKeyRef セクションを有効化",
        templatePath: "cloud-run/pm-agent-service.template.yaml",
        note: "# Uncomment セクションを人間が確認・有効化する",
      },
      {
        step: 5,
        action: "deploy 後: GCP Console → Cloud Run → service で env var が正しく参照されていることを確認",
      },
    ],
    note: "全操作はじゅんやさんが GCP Console から実施する。AI は実行しない。",
  };
}

function generateSecretManagerReadinessPack(options) {
  const opts = options || {};

  return {
    description: "Secret Manager Readiness Pack — v0.4.2",
    dryRun: true,
    humanApprovalRequired: true,
    generationPolicy: "Generates checklists and instructions only. Does not access any secret values.",
    safetyPrinciples: [
      "Secret 値は人間のみが GCP Console で確認する",
      "AI は Secret 名の placeholder のみ扱う",
      "値をコード・ログ・Git に含めない",
    ],
    secretPresenceChecklist: generateSecretPresenceChecklist(opts),
    runtimeEnvVarChecklist: generateRuntimeEnvVarChecklist(opts),
    humanSetupInstructions: generateHumanSecretSetupInstructions(opts),
    readinessChecklist: [
      "[ ] Secret Manager: 必要な Secret が登録済み（GCP Console で確認）",
      "[ ] IAM: Cloud Run SA に Secret Manager Secret Accessor ロール付与済み",
      "[ ] template.yaml: secretKeyRef セクションを人間が確認・有効化済み",
      "[ ] deploy 後: GCP Console で env var 参照を確認済み",
      "[ ] じゅんやさんの承認（Human Approval）",
    ],
    nextVersion: "v0.4.2",
  };
}

if (require.main === module) {
  const result = generateSecretManagerReadinessPack();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateSecretManagerReadinessPack,
  generateSecretPresenceChecklist,
  generateRuntimeEnvVarChecklist,
  generateHumanSecretSetupInstructions,
};
