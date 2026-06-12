#!/usr/bin/env node
'use strict';

/**
 * KOSAME Grok Safe Review Lane v110.61.0
 *
 * v110.60 の safe trial / intake 結果を受けて、
 * Grok 想定の review-only lane を dryRun で構成する。
 * 役割は穴探し・反対意見・リスク指摘・見落とし検出に限定し、
 * 最終裁定は human に残す。
 */

const generator = require('./kosame-sanitized-task-pack-generator');
const patchGate = require('./kosame-patch-intake-gate');
const securityPolicy = require('./kosame-worker-security-policy');
const ipGate = require('./kosame-ip-protection-gate');
const costLedger = require('./kosame-cost-token-ledger');
const workerScorecard = require('./kosame-worker-scorecard');
const explainability = require('./kosame-router-explainability-dashboard');

const TOOL_META = {
  version: '110.61.0',
  feature: 'v110-61-grok-safe-review-lane',
  slug: 'kosame-grok-safe-review-lane',
};

const REVIEW_STATUS = {
  safe: 'safe',
  caution: 'caution',
  blocked: 'blocked',
  human_gate: 'human_gate',
};

const FORBIDDEN_SCOPE_LABELS = [
  'Secret / API keys / .env / credentials',
  'customer data / customer_info / lead management',
  'IP core / full architecture / orchestration full design',
  'billing / pricing / subscription / revenue model',
  'lead management / sales flow / customer management core',
  '営業DX',
  'transcriber',
];

const FORBIDDEN_SCOPE_REPLACEMENTS = [
  { pattern: /営業DX/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /transcriber/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /customer(?:_?data|_?info|_?name)?/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /顧客(?:情報|データ)?/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /(?:full architecture|core architecture|overall architecture|アプリ(?:全体|中核)設計|中核設計|全体設計)/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /(?:Smart Router(?:全体|中核|core|architecture|設計)|KOSAME Dev Orchestra core|ANESTY Board(?:中核|全体設計|アーキテクチャ)|orchestration(?:全体| core| architecture| design)|オーケストレーション(?:全体|中核|設計))/gi, replacement: '[REDACTED_SCOPE]' },
  { pattern: /(?:billing|pricing|subscription|revenue model|収益モデル|課金導線|課金(?:モデル|設計|フロー)|lead management|営業導線|customer management)/gi, replacement: '[REDACTED_SCOPE]' },
];

const RISK_PATTERNS = [
  { label: 'secret', regex: /(?:api[_-]?key|token|secret|credential|password|authorization|authentication|bearer|sk-[A-Za-z0-9_-]{12,})/i },
  { label: 'customer', regex: /(?:customer(?:_?data|_?info|_?name)?|顧客(?:情報|データ)?|個人情報|pii)/i },
  { label: 'sales_dx', regex: /(?:営業DX|sales dx|sales-dx|transcriber)/i },
  { label: 'ip_core', regex: /(?:full architecture|core architecture|overall architecture|事業モデル|収益モデル|課金導線|顧客管理|営業導線|Smart Router|ANESTY Board core|KOSAME Dev Orchestra core)/i },
  { label: 'billing', regex: /(?:billing|pricing|subscription|revenue model|課金|lead management)/i },
];

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(item => (item == null ? [] : [String(item).trim()]))
    .filter(Boolean))];
}

function truncate(text, max = 240) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function sanitizeReviewText(text) {
  let value = String(text || '');
  value = securityPolicy.redactForWorker(value);
  for (const { pattern, replacement } of FORBIDDEN_SCOPE_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }
  value = value
    .replace(/(?:\*\*\* Begin Patch|\*\*\* End Patch|diff --git|index [0-9a-f.]+|--- |\+\+\+ |@@)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(value, 520);
}

function isRoutineReview(taskType) {
  return taskType === 'routine_docs'
    || taskType === 'routine_smoke'
    || taskType === 'routine_ui'
    || taskType === 'routine_light_code';
}

function detectRiskFlags(text) {
  const source = String(text || '');
  const secretLeakDetected = securityPolicy.detectSecretLikeText(source).length > 0 || RISK_PATTERNS[0].regex.test(source);
  const customerDataDetected = RISK_PATTERNS[1].regex.test(source);
  const salesDxDetected = RISK_PATTERNS[2].regex.test(source);
  const ipCoreDetected = ipGate.detectProtectedIP(source).length > 0 || RISK_PATTERNS[3].regex.test(source);
  const billingOrLeadManagementDetected = RISK_PATTERNS[4].regex.test(source);
  const transcriberDetected = /transcriber/i.test(source);

  return {
    secretLeakDetected,
    customerDataDetected,
    salesDxDetected,
    ipCoreDetected,
    billingOrLeadManagementDetected,
    transcriberDetected,
    hasRisk: secretLeakDetected || customerDataDetected || salesDxDetected || ipCoreDetected || billingOrLeadManagementDetected || transcriberDetected,
    hits: [
      ...(secretLeakDetected ? ['secret'] : []),
      ...(customerDataDetected ? ['customer'] : []),
      ...(salesDxDetected ? ['sales_dx'] : []),
      ...(ipCoreDetected ? ['ip_core'] : []),
      ...(billingOrLeadManagementDetected ? ['billing'] : []),
      ...(transcriberDetected ? ['transcriber'] : []),
    ],
  };
}

function buildIntakeSummary(patchIntakeGate, sourceTaskPack) {
  if (!patchIntakeGate) {
    return compactText(
      'Patch intake not provided;',
      `allowedFiles=${(sourceTaskPack.allowedFiles || []).length}`,
      `allowedScope=${(sourceTaskPack.allowedScope || []).length}`,
    );
  }

  return compactText(
    `accepted=${patchIntakeGate.accepted === true}`,
    `rejected=${patchIntakeGate.rejected === true}`,
    `humanGate=${patchIntakeGate.humanGateRequired === true}`,
    patchIntakeGate.recommendedNextAction ? `next=${patchIntakeGate.recommendedNextAction}` : '',
    patchIntakeGate.changedFilesAllowed ? `allowedFiles=${patchIntakeGate.changedFilesAllowed.length}` : '',
    patchIntakeGate.forbiddenFilesTouched ? `forbiddenFiles=${patchIntakeGate.forbiddenFilesTouched.length}` : '',
  );
}

function buildReviewPrompt(reviewPacket) {
  return [
    'Grok review-only lane.',
    'Find missing pieces, risks, edge cases, counterarguments, and safety gaps.',
    'Do not make the final approval decision; human remains final owner.',
    'Do not use raw patch text or reveal secrets/customer/IP-core/billing/transcriber details.',
    `Task: ${reviewPacket.taskTitle || reviewPacket.taskId || 'sanitized review'}`,
    `Summary: ${reviewPacket.sanitizedSummary || 'n/a'}`,
    `Diff summary: ${reviewPacket.diffSummary || 'n/a'}`,
    `Intake: ${reviewPacket.intakeSummary || 'n/a'}`,
    `Allowed files: ${(reviewPacket.allowedFiles || []).join(', ') || 'none'}`,
    `Review focus: ${(reviewPacket.reviewFocus || []).join(', ') || 'hole-finding'}`,
    'Return JSON with findings, risks, missingPieces, and recommendedNextAction only.',
  ].join('\n');
}

function buildReviewResult(status, reviewPacket, notes = []) {
  const base = {
    status,
    reviewRole: 'grok',
    finalDecisionOwner: 'human',
    findings: [],
    risks: [],
    missingPieces: [],
    recommendedNextAction: 'route_to_human_review',
    confidence: 'medium',
    notes: uniqueList(notes),
  };

  if (status === REVIEW_STATUS.safe) {
    return {
      ...base,
      findings: ['No blocking issue identified in the sanitized summary.'],
      missingPieces: ['Confirm implementation and smoke still pass.'],
      recommendedNextAction: 'proceed_to_human_verification',
      confidence: 'high',
    };
  }

  if (status === REVIEW_STATUS.caution) {
    return {
      ...base,
      findings: ['Look for edge cases, regressions, and missing verification.'],
      risks: ['Review result is advisory only.', 'Use verify/smoke to confirm before release.'],
      missingPieces: ['Confirm changed files are minimal.', 'Confirm no hidden scope drift.'],
      recommendedNextAction: 'review_with_extra_verification',
      confidence: 'medium',
    };
  }

  if (status === REVIEW_STATUS.human_gate) {
    return {
      ...base,
      findings: ['Sensitive content was redacted; Grok should not receive the raw patch.'],
      risks: ['Human gate required before any further review or acceptance.'],
      missingPieces: ['Collect a human-approved sanitized summary if review should continue.'],
      recommendedNextAction: 'route_to_human_gate',
      confidence: 'low',
    };
  }

  return {
    ...base,
    findings: ['Review lane blocked before Grok handoff.'],
    risks: ['Unsafe or out-of-scope input detected.'],
    missingPieces: ['Regenerate sanitized packet or fix scope violations.'],
    recommendedNextAction: 'block_and_regenerate',
    confidence: 'low',
  };
}

function determineStatus({
  sourceTaskPack,
  patchIntakeGate,
  riskFlags,
  taskType,
}) {
  if (!sourceTaskPack || sourceTaskPack.allowedWorkerClass !== 'sanitized_only') {
    return {
      status: REVIEW_STATUS.blocked,
      reason: 'source task pack must be sanitized_only',
      humanGateRequired: true,
      blocked: true,
    };
  }

  if (patchIntakeGate && patchIntakeGate.rejected === true && patchIntakeGate.humanGateRequired !== true) {
    return {
      status: REVIEW_STATUS.blocked,
      reason: patchIntakeGate.recommendedNextAction || 'patch intake rejected',
      humanGateRequired: false,
      blocked: true,
    };
  }

  if (patchIntakeGate && patchIntakeGate.humanGateRequired === true) {
    return {
      status: REVIEW_STATUS.human_gate,
      reason: patchIntakeGate.humanGateReason || 'patch intake requires human gate',
      humanGateRequired: true,
      blocked: false,
    };
  }

  if (sourceTaskPack.humanGateRequired === true) {
    return {
      status: REVIEW_STATUS.human_gate,
      reason: sourceTaskPack.humanGateReason || 'source task pack requires human gate',
      humanGateRequired: true,
      blocked: false,
    };
  }

  if (riskFlags.hasRisk) {
    return {
      status: REVIEW_STATUS.human_gate,
      reason: `sensitive content redacted (${riskFlags.hits.slice(0, 3).join(', ')})`,
      humanGateRequired: true,
      blocked: false,
    };
  }

  if (patchIntakeGate && patchIntakeGate.accepted === true) {
    return {
      status: isRoutineReview(taskType) ? REVIEW_STATUS.safe : REVIEW_STATUS.caution,
      reason: isRoutineReview(taskType)
        ? 'sanitized patch intake accepted for routine review'
        : 'sanitized patch intake accepted; review remains advisory',
      humanGateRequired: false,
      blocked: false,
    };
  }

  if (isRoutineReview(taskType)) {
    return {
      status: REVIEW_STATUS.safe,
      reason: 'safe summary only; routine review lane',
      humanGateRequired: false,
      blocked: false,
    };
  }

  return {
    status: REVIEW_STATUS.caution,
    reason: 'sanitized summary only; review remains advisory',
    humanGateRequired: false,
    blocked: false,
  };
}

function buildGrokSafeReviewLane(task, context = {}) {
  const trialResult = context.trialResult || null;
  const sourceTaskPack = context.sourceTaskPack
    || trialResult?.sourceTaskPack
    || generator.buildSanitizedTaskPack(task, {
      ...context,
      workerType: context.workerType || trialResult?.workerType || 'grok',
      requestedModel: context.workerType || trialResult?.workerType || 'grok',
      externalSanitized: true,
    });

  const workerType = String(context.workerType || trialResult?.workerType || sourceTaskPack.workerType || 'grok').trim() || 'grok';
  const grokScorecard = workerScorecard.getWorkerScorecard('grok');
  const taskType = context.taskType || costLedger.classifyTaskType(task, context);
  const patchIntakeGate = context.patchIntakeGate || trialResult?.patchIntakeGate || null;
  const reviewSummary = sanitizeReviewText(
    context.reviewSummary
    || patchIntakeGate?.patchSummary
    || trialResult?.mockWorkerOutput?.patchSummary
    || sourceTaskPack.taskSummary
    || task?.title
    || 'sanitized review',
  );
  const diffSummary = sanitizeReviewText(
    context.diffSummary
    || context.patchSummary
    || trialResult?.mockWorkerOutput?.patchSummary
    || patchIntakeGate?.patchSummary
    || reviewSummary,
  );
  const intakeSummary = sanitizeReviewText(
    context.intakeSummary
    || buildIntakeSummary(patchIntakeGate, sourceTaskPack),
  );
  const combinedText = compactText(
    sourceTaskPack.taskTitle,
    reviewSummary,
    diffSummary,
    intakeSummary,
    patchIntakeGate?.humanGateReason,
    patchIntakeGate?.recommendedNextAction,
    context.reviewNotes,
  );

  const riskFlags = detectRiskFlags(combinedText);
  const statusInfo = determineStatus({
    sourceTaskPack,
    patchIntakeGate,
    riskFlags,
    taskType,
  });
  const redactionApplied = riskFlags.hasRisk
    || reviewSummary !== sanitizeReviewText(context.reviewSummary || reviewSummary)
    || diffSummary !== sanitizeReviewText(context.diffSummary || context.patchSummary || diffSummary);

  const reviewPacket = {
    reviewId: String(context.reviewId || sourceTaskPack.taskId || task?.id || `grok-review-${Date.now()}`),
    taskId: sourceTaskPack.taskId || task?.id || null,
    taskTitle: sourceTaskPack.taskTitle || sanitizeReviewText(task?.title || 'sanitized review'),
    reviewRole: 'grok',
    reviewPurpose: 'hole-finding / adversarial review only',
    reviewFocus: [
      'missing pieces',
      'risks',
      'edge cases',
      'counterarguments',
      'verification gaps',
    ],
    reviewConstraints: [
      'not final decision maker',
      'no raw patch text',
      'no secret/customer/IP-core/billing/transcriber details',
    ],
    allowedFiles: uniqueList(sourceTaskPack.allowedFiles || []),
    allowedScope: uniqueList(sourceTaskPack.allowedScope || []),
    forbiddenScope: [...FORBIDDEN_SCOPE_LABELS],
    expectedOutputFormat: 'json',
    verifyCommands: uniqueList(patchIntakeGate?.verifyCommands || sourceTaskPack.verifyCommands || []),
    sanitizedSummary: reviewSummary,
    diffSummary,
    intakeSummary,
    redactionApplied,
    humanGateRequired: statusInfo.humanGateRequired,
    humanGateReason: statusInfo.reason,
  };

  const reviewResult = buildReviewResult(statusInfo.status, reviewPacket, [
    `taskType=${taskType}`,
    statusInfo.reason,
    statusInfo.blocked ? 'review blocked before Grok handoff' : null,
    statusInfo.humanGateRequired ? 'human gate required' : null,
  ]);

  const costPolicy = costLedger.buildLedgerRecord(task, {
    verifyRunCount: Number(context.verifyRunCount || 0),
    externalSanitized: true,
  });

  const routerExplanation = explainability.buildRouterExplanation(task, {
    selectedWorker: grokScorecard.workerName,
    selectedModel: grokScorecard.modelId,
    modelTier: grokScorecard.modelTier,
    taskType,
    reason: statusInfo.reason,
    costPolicy,
    workerScorecard: grokScorecard,
    humanGateRequired: statusInfo.humanGateRequired,
    humanGateReason: statusInfo.reason,
    approvalRequired: grokScorecard.approvalRequired,
    safetyNotes: [
      'Grok lane is review-only.',
      'Grok is not the final decision maker.',
      statusInfo.status === REVIEW_STATUS.safe ? 'safe review packet' : null,
      statusInfo.status === REVIEW_STATUS.caution ? 'caution review packet' : null,
      statusInfo.status === REVIEW_STATUS.human_gate ? 'human gate required' : null,
      statusInfo.status === REVIEW_STATUS.blocked ? 'blocked before handoff' : null,
    ].filter(Boolean).join('; '),
  }, {
    requestedModel: workerType,
    approvalReceived: false,
  });

  const reviewPrompt = buildReviewPrompt(reviewPacket);
  const safetyNotes = uniqueList([
    statusInfo.reason,
    statusInfo.status === REVIEW_STATUS.safe ? 'routine docs/smoke/UI stays cheap-first.' : null,
    statusInfo.status === REVIEW_STATUS.caution ? 'advisory review only; not final approval.' : null,
    statusInfo.status === REVIEW_STATUS.human_gate ? 'redacted summary sent to human gate.' : null,
    statusInfo.status === REVIEW_STATUS.blocked ? 'blocked before Grok handoff.' : null,
    patchIntakeGate?.recommendedNextAction ? `intake:${patchIntakeGate.recommendedNextAction}` : null,
    reviewResult.recommendedNextAction ? `review:${reviewResult.recommendedNextAction}` : null,
    routerExplanation.safetyNotes,
  ]);

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    dryRun: true,
    reviewId: reviewPacket.reviewId,
    taskId: reviewPacket.taskId,
    workerType,
    reviewRole: 'grok',
    status: statusInfo.status,
    safe: statusInfo.status === REVIEW_STATUS.safe,
    caution: statusInfo.status === REVIEW_STATUS.caution,
    blocked: statusInfo.status === REVIEW_STATUS.blocked,
    humanGateRequired: statusInfo.humanGateRequired,
    humanGateReason: statusInfo.reason,
    finalDecisionOwner: 'human',
    sourceTaskPack,
    patchIntakeGate,
    reviewPacket,
    reviewResult,
    reviewPrompt,
    redactionApplied,
    secretLeakDetected: riskFlags.secretLeakDetected,
    customerDataDetected: riskFlags.customerDataDetected,
    salesDxDetected: riskFlags.salesDxDetected,
    transcriberDetected: riskFlags.transcriberDetected,
    ipCoreDetected: riskFlags.ipCoreDetected,
    billingOrLeadManagementDetected: riskFlags.billingOrLeadManagementDetected,
    routerExplanation,
    safetyNotes,
    recommendedNextAction: reviewResult.recommendedNextAction,
    costPolicy,
  };
}

function runGrokSafeReviewLane(task, context = {}) {
  return buildGrokSafeReviewLane(task, context);
}

module.exports = {
  TOOL_META,
  REVIEW_STATUS,
  buildGrokSafeReviewLane,
  runGrokSafeReviewLane,
  buildReviewPrompt,
  buildReviewResult,
  sanitizeReviewText,
};
