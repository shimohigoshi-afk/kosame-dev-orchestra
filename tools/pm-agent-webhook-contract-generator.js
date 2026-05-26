"use strict";

// KOSAME Cloud Run PM Agent — Webhook Contract Generator (v0.3.0)
// Generates external caller contract and security checklist.
// No external API calls. No .env/secrets. No gcloud execution.

function generateWebhookContract(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";
  const callerName = opts.callerName || "n8n";

  return {
    description: "External Caller Contract — Cloud Run PM Agent (v0.3.0)",
    dryRun: true,
    serviceUrl,
    callerName,
    contractVersion: "v0.3.0",
    endpoints: {
      health: {
        method: "GET",
        path: "/health",
        description: "ヘルスチェック（Cloud Run probe / n8n connection check）",
        expectedStatus: 200,
        expectedBody: { status: "ok" },
      },
      info: {
        method: "GET",
        path: "/info",
        description: "PM Agent メタ情報",
        expectedStatus: 200,
        expectedBody: { dryRunOnly: true },
      },
      dryRunTask: {
        method: "POST",
        path: "/dry-run-task",
        description: "Task Packet を受け取り routing decision を返す",
        requestBody: {
          id: "string (required)",
          title: "string (required)",
          kind: "string (required) — docs/implementation/deploy/etc.",
          riskLevel: "string (required) — low/medium/high/critical",
          targetRepo: "string (optional)",
          context: "string (optional)",
        },
        expectedStatus: 200,
        expectedBody: {
          success: "boolean",
          dryRun: true,
          decision: {
            recommendedOwner: "string — gemini/claude_code/kosame_pm/human",
            blocked: "boolean",
            humanApprovalRequired: "boolean",
          },
        },
      },
    },
    securityPolicy: {
      authentication: "v0.4.0 初回では --allow-unauthenticated（n8n 接続確認後に認証追加）",
      secretExposure: "Secret Manager 参照は Service Account 経由のみ。API キーを URL/body に含めない",
      inputValidation: "Task Packet スキーマバリデーション実装済み",
      rateLimit: "max-instances 1 で自然に制限（v0.4.0 初回段階）",
    },
    n8nConnectionGuide: [
      "1. n8n HTTP Request node で POST /dry-run-task を呼ぶ",
      "2. Body: Task Packet JSON",
      "3. Headers: Content-Type: application/json",
      "4. Response: decision.recommendedOwner で分岐",
      "5. blocked: true の場合は n8n workflow を止めてじゅんやさんに通知",
    ],
    note: "v0.4.0 deploy 後に実接続テスト。v0.3.0 は設計のみ。",
  };
}

function generateWebhookSecurityChecklist(options) {
  return {
    description: "Webhook Intake Security Checklist — v0.3.0",
    dryRun: true,
    checklist: [
      "[ ] Cloud Run URL は HTTPS のみ",
      "[ ] 初回は --allow-unauthenticated（n8n 接続確認用）",
      "[ ] 接続確認後: Cloud Run Invoker 認証を追加",
      "[ ] n8n から送信する body に Secret や API キーを含めない",
      "[ ] blocked: true を受け取った場合の n8n ワークフロー分岐を設計済みか",
      "[ ] Secret Manager 参照は Cloud Run Service Account のみ（コード内 hardcode 禁止）",
    ],
    note: "v0.4.0 deploy 後に実際のチェックを行う。",
  };
}

if (require.main === module) {
  const result = {
    webhookContract: generateWebhookContract(),
    securityChecklist: generateWebhookSecurityChecklist(),
  };
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { generateWebhookContract, generateWebhookSecurityChecklist };
