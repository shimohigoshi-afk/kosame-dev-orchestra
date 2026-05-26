"use strict";

// KOSAME Cloud Run PM Agent — n8n First Connection Pack (v0.4.2)
// Generates n8n connection configuration and result record templates.
// Does NOT send HTTP requests. No dotenv files. No credential access.
// Does not use process-spawn calls or synchronous shell execution.
// Production connection requires Human Approval.

function generateN8nHttpRequestNodeConfig(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";
  const timeout = opts.timeout || 30000;

  return {
    description: "n8n HTTP Request node configuration for Cloud Run PM Agent",
    dryRun: true,
    nodeType: "n8n-nodes-base.httpRequest",
    method: "POST",
    url: `${serviceUrl}/dry-run-task`,
    headers: { "Content-Type": "application/json" },
    authentication: "None (initial v0.4.0) — add Cloud Run Invoker auth in v0.5.0",
    timeoutMs: timeout,
    retryOnFail: true,
    retryCount: 1,
    retryDelay: 2000,
    idempotency: "task.id をべき等キーとして使用。同じ id を複数回送っても同じ routing decision が返る。",
    note: "Replace SERVICE_URL_PLACEHOLDER with actual Cloud Run URL. Execute after Human Approval.",
  };
}

function generateN8nDryRunTaskPayload(options) {
  const opts = options || {};
  const taskKind = opts.taskKind || "implementation";
  const riskLevel = opts.riskLevel || "low";
  const targetRepo = opts.targetRepo || "kosame-dev-orchestra";

  return {
    description: "n8n dry-run task payload template",
    dryRun: true,
    samplePayload: {
      id: "N8N-TASK-PLACEHOLDER",
      title: "TASK_TITLE_PLACEHOLDER",
      kind: taskKind,
      riskLevel,
      targetRepo,
      context: "CONTEXT_PLACEHOLDER (任意)",
    },
    payloadRules: [
      "id は一意にすること",
      "kind は許可値のみ: docs/implementation/deploy/secret/billing など",
      "riskLevel は low / medium / high / critical",
      "Secret / API キー値を payload に含めない",
    ],
    responseHandling: {
      "decision.recommendedOwner === 'claude_code'": "Claude Code へタスク転送",
      "decision.recommendedOwner === 'gemini'": "Gemini Agent へタスク転送",
      "decision.recommendedOwner === 'human'": "じゅんやさんへ通知",
      "decision.blocked === true": "n8n workflow を停止 → じゅんやさんへ通知",
    },
    note: "Production connection requires Human Approval.",
  };
}

function generateN8nConnectionResultRecordTemplate(options) {
  const opts = options || {};
  const serviceUrl = opts.serviceUrl || "SERVICE_URL_PLACEHOLDER";

  return {
    description: "n8n First Connection Result Record Template — v0.4.2",
    dryRun: true,
    serviceUrl,
    connectionAttemptedAt: "YYYY-MM-DD HH:MM:SS",
    approvedBy: "じゅんやさん",
    connectionTest: {
      healthCheck: "PENDING (pass / fail)",
      dryRunTask_implementation: "PENDING (pass / fail)",
      dryRunTask_blocked: "PENDING (pass / fail)",
      n8nWorkflowTrigger: "PENDING (pass / fail)",
    },
    overallResult: "PENDING (success / failed)",
    authenticationUsed: "PENDING (none / Cloud Run Invoker)",
    rollbackIfFailed: "Cloud Run service update or rollback — Human Approval required",
    nextAction: "PENDING (success → dryRunOnly: false 移行設計 / fail → 原因調査)",
  };
}

function generateN8nFirstConnectionPack(options) {
  const opts = options || {};

  return {
    description: "n8n First Connection Pack — v0.4.2",
    dryRun: true,
    humanApprovalRequired: true,
    generationPolicy: "Generates configuration objects and templates only. Does not send HTTP requests.",
    note: "n8n 接続は Human Approval 後にじゅんやさんが実施する。AIは接続しない。",
    httpRequestNodeConfig: generateN8nHttpRequestNodeConfig(opts),
    dryRunTaskPayload: generateN8nDryRunTaskPayload(opts),
    connectionResultTemplate: generateN8nConnectionResultRecordTemplate(opts),
    connectionChecklist: [
      "[ ] Cloud Run URL 確定済み（v0.4.0 deploy 後）",
      "[ ] POST /dry-run-task smoke 全 PASS（v0.4.1 確認済み）",
      "[ ] n8n instance が Cloud Run URL にアクセス可能なネットワーク設定",
      "[ ] n8n HTTP Request node の URL を Cloud Run URL に設定",
      "[ ] blocked: true 時の n8n workflow 分岐を設計済み",
      "[ ] じゅんやさんの承認（Human Approval）",
    ],
    nextVersion: "v0.4.2",
  };
}

if (require.main === module) {
  const result = generateN8nFirstConnectionPack();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  generateN8nFirstConnectionPack,
  generateN8nHttpRequestNodeConfig,
  generateN8nDryRunTaskPayload,
  generateN8nConnectionResultRecordTemplate,
};
