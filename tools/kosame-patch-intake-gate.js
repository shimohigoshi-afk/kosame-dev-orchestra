#!/usr/bin/env node
'use strict';

/**
 * KOSAME Patch Intake Gate v110.59.0
 *
 * 受信側の安全ゲート。
 * 外部 worker / patch 返却物が allowed scope, diff-only, secret redaction,
 * customer/IP/billing guard, verify command 要件を満たすかを判定する。
 */

const securityPolicy = require('./kosame-worker-security-policy');
const ipGate = require('./kosame-ip-protection-gate');
const costLedger = require('./kosame-cost-token-ledger');
const workerScorecard = require('./kosame-worker-scorecard');
const explainability = require('./kosame-router-explainability-dashboard');

const TOOL_META = {
  version: '110.59.0',
  feature: 'v110-59-patch-intake-gate',
  slug: 'kosame-patch-intake-gate',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';
const DIFF_LIKE_RE = /(?:^|\n)(?:diff --git|index [0-9a-f.]+|--- |\+\+\+ |@@ |\*\*\* Begin Patch|\*\*\* Update File:|\*\*\* Add File:)/i;
const CODE_FILE_RE = /\.(?:js|jsx|ts|tsx|mjs|cjs|json|yml|yaml|sh|ps1|py|go|rb|java|css|html|scss)$/i;
const DOC_FILE_RE = /\.(?:md|markdown|txt|rst)$/i;

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

function uniqueList(values) {
  return [...new Set(normalizeList(values))];
}

function isDiffLike(text) {
  return DIFF_LIKE_RE.test(String(text || ''));
}

function isCodeFile(file) {
  return CODE_FILE_RE.test(String(file || ''));
}

function isDocOrSmokeFile(file) {
  const text = String(file || '');
  return DOC_FILE_RE.test(text) || /(?:^|\/)smoke\/.*\.js$/i.test(text);
}

function detectCustomerData(text) {
  return /(?:customer(?:_?data|_?info|_?name)?|顧客(?:情報|データ)?|個人情報|pii|contact(?:_?info)?)/i.test(String(text || ''));
}

function detectBillingLead(text) {
  return /(?:billing|billing flow|subscription|pricing|revenue|lead management|sales flow|営業導線|課金導線)/i.test(String(text || ''));
}

function detectTranscriberCustomerData(text) {
  const source = String(text || '');
  return /transcriber/i.test(source) && detectCustomerData(source);
}

function detectSecretLike(text) {
  const source = String(text || '');
  const secretLike = securityPolicy.detectSecretLikeText(source);
  return secretLike.length > 0 || /\b(?:api[_-]?key|token|secret|credential|password|auth(?:orization)?|bearer)\b/i.test(source);
}

function detectIpCore(text) {
  const source = String(text || '');
  return ipGate.detectProtectedIP(source).length > 0 || /(?:full architecture|core architecture|orchestration|smart router|anesty board core|kosame dev orchestra core|事業モデル|収益モデル|課金導線|顧客管理|営業導線)/i.test(source);
}

function inferPatchType(patchSummary, declaredScope, patchText, changedFiles) {
  const text = compactText(patchSummary, declaredScope, patchText, changedFiles.join(' '));
  if (/docs?|readme|documentation|typo|wording|copy|文言|表示/i.test(text)) return 'routine_docs';
  if (/smoke|test|tests?|verify/i.test(text)) return 'routine_smoke';
  if (/ui|css|label|button|form|layout|style|copy edit|文言|表示/i.test(text)) return 'routine_ui';
  if (/utility|helper|function|lint|format/i.test(text)) return 'routine_light_code';
  if (/implement|refactor|fix|add|change|modify|code/i.test(text) || changedFiles.some(isCodeFile)) return 'implementation';
  return 'unknown';
}

function buildSafetyNotes(notes) {
  return uniqueList(notes).filter(Boolean);
}

function buildResult({
  sourceTaskPack,
  workerType,
  changedFiles,
  patchSummary,
  patchText,
  declaredScope,
  verifyCommands,
  riskNotes,
  approvalReceived,
  taskHint,
}) {
  const pack = sourceTaskPack || {};
  const worker = String(workerType || pack.workerType || pack.modelId || '').trim();
  const workerScore = workerScorecard.getWorkerScorecard(worker);
  const workerClass = String(pack.allowedWorkerClass || workerScore.modelTier || '').trim();
  const allowedFiles = uniqueList(pack.allowedFiles || []);
  const files = uniqueList(changedFiles);
  const declared = uniqueList(declaredScope || pack.allowedScope || []);
  const taskType = taskHint || pack.taskType || inferPatchType(patchSummary, declared.join(' '), patchText, files);
  const combinedText = compactText(
    patchSummary,
    declared.join(' '),
    patchText,
    riskNotes,
    files.join(' '),
  );

  const changedFilesAllowed = files.filter(file => allowedFiles.includes(file));
  const forbiddenFilesTouched = files.filter(file => !allowedFiles.includes(file));
  const scopeViolationDetected = forbiddenFilesTouched.length > 0;
  const secretLeakDetected = detectSecretLike(combinedText);
  const customerDataDetected = detectCustomerData(combinedText);
  const ipCoreDetected = detectIpCore(combinedText);
  const billingOrLeadManagementDetected = detectBillingLead(combinedText);
  const transcriberCustomerDataDetected = detectTranscriberCustomerData(combinedText);
  const verifyList = uniqueList(verifyCommands || pack.verifyCommands || []);
  const verifyCommandsPresent = verifyList.length > 0;
  const returnDiffOnlyRespected = !(pack.returnDiffOnly === true) || isDiffLike(patchText);
  const patchLooksLikeDiff = isDiffLike(patchText);
  const codeChange = taskType === 'implementation'
    || changedFiles.some(isCodeFile)
    || (!changedFiles.some(isDocOrSmokeFile) && /(?:function|class|const |let |var |module\.exports|=>|return )/i.test(String(patchText || '')));

  const patchSummaryText = compactText(patchSummary, declared.join(' '), riskNotes);
  const assessment = costLedger.evaluateRequestedModel(worker || 'gpt-5.4-mini', {
    title: patchSummaryText || pack.taskTitle || 'patch intake',
    description: combinedText,
  }, {
    approvalReceived: approvalReceived === true,
    externalSanitized: workerClass === 'sanitized_only',
  });

  const deepSeekLike = ['deepseek-chat', 'opencode', 'cheap_code_worker', 'sanitized_worker'].includes(worker.toLowerCase());
  const deepSeekSanitizedOnly = workerClass === 'sanitized_only';
  const gpt55Blocked = worker === 'gpt-5.5' && !assessment.approvalReceived;

  let accepted = false;
  let rejected = false;
  let humanGateRequired = false;
  const reasons = [];
  const safetyNotes = [];
  let recommendedNextAction = 'review_patch_manually';

  if (gpt55Blocked) {
    humanGateRequired = true;
    reasons.push('gpt-5.5 requires explicit approval');
    recommendedNextAction = 'require_human_approval_for_gpt_5_5';
  }

  if (scopeViolationDetected) {
    rejected = true;
    reasons.push(`changed files outside allowed scope: ${forbiddenFilesTouched.join(', ')}`);
    recommendedNextAction = 'resend_with_allowed_files_only';
  }

  if (secretLeakDetected) {
    humanGateRequired = true;
    reasons.push('secret/API key-like content detected');
    recommendedNextAction = 'redact_secret_content_and_resubmit';
  }

  if (customerDataDetected) {
    humanGateRequired = true;
    reasons.push('customer data detected');
    recommendedNextAction = 'remove_customer_data_and_resubmit';
  }

  if (transcriberCustomerDataDetected) {
    humanGateRequired = true;
    reasons.push('transcriber/customer data detected');
    recommendedNextAction = 'route_transcriber_customer_data_to_human_gate';
  }

  if (ipCoreDetected) {
    humanGateRequired = true;
    reasons.push('IP/core/full architecture/orchestration/billing/lead-management scope detected');
    recommendedNextAction = 'route_ip_core_scope_to_human_gate';
  }

  if (billingOrLeadManagementDetected) {
    humanGateRequired = true;
    reasons.push('billing or lead-management scope detected');
    recommendedNextAction = 'route_billing_lead_management_scope_to_human_gate';
  }

  if (deepSeekLike && !deepSeekSanitizedOnly) {
    rejected = true;
    reasons.push('DeepSeek/opencode patches require sanitized_only task pack');
    recommendedNextAction = 'resend_with_sanitized_only_task_pack';
  }

  if (pack.returnDiffOnly === true && !patchLooksLikeDiff) {
    rejected = true;
    reasons.push('returnDiffOnly source task pack was not answered with diff-like content');
    recommendedNextAction = 'resend_diff_or_patch_only_response';
  }

  if (codeChange && !verifyCommandsPresent) {
    rejected = true;
    reasons.push('verifyCommands missing for code change');
    recommendedNextAction = 'add_verify_commands_and_resubmit';
  }

  if (!scopeViolationDetected && !secretLeakDetected && !customerDataDetected && !ipCoreDetected && !billingOrLeadManagementDetected && !transcriberCustomerDataDetected && !rejected && !humanGateRequired) {
    if (deepSeekLike && !deepSeekSanitizedOnly) {
      rejected = true;
    } else if (worker === 'gpt-5.5' && !assessment.approvalReceived) {
      humanGateRequired = true;
    } else {
      accepted = true;
      recommendedNextAction = 'accept_patch';
    }
  }

  if (humanGateRequired) {
    accepted = false;
    if (!rejected) {
      recommendedNextAction = recommendedNextAction === 'review_patch_manually'
        ? 'route_to_human_gate'
        : recommendedNextAction;
    }
  }

  if (rejected) {
    accepted = false;
  }

  const routerExplanation = explainability.buildRouterExplanation(
    {
      title: patchSummaryText || pack.taskTitle || 'patch intake',
      description: combinedText,
      file_scope: files,
    },
    {
      selectedWorker: workerScore.workerName,
      selectedModel: workerScore.modelId,
      modelTier: workerScore.modelTier,
      taskType,
      reason: reasons.join('; ') || 'patch intake gate evaluation',
      costPolicy: assessment,
      workerScorecard: workerScore,
      approvalReceived: assessment.approvalReceived,
    },
    {
      requestedModel: worker,
      approvalReceived: assessment.approvalReceived,
    },
  );

  safetyNotes.push(
    `allowedFiles=${allowedFiles.length}`,
    `changedFilesAllowed=${changedFilesAllowed.length}`,
    `verifyCommandsPresent=${verifyCommandsPresent}`,
    `returnDiffOnlyRespected=${returnDiffOnlyRespected}`,
    `patchLooksLikeDiff=${patchLooksLikeDiff}`,
    routerExplanation.costReason,
    routerExplanation.humanGateReason,
  );

  if (scopeViolationDetected) safetyNotes.push('out-of-scope file changes blocked');
  if (secretLeakDetected) safetyNotes.push('secret/API key-like content blocked');
  if (customerDataDetected) safetyNotes.push('customer data blocked');
  if (transcriberCustomerDataDetected) safetyNotes.push('transcriber customer data blocked');
  if (ipCoreDetected) safetyNotes.push('IP/core scope blocked');
  if (billingOrLeadManagementDetected) safetyNotes.push('billing/lead-management scope blocked');
  if (deepSeekLike) safetyNotes.push(deepSeekSanitizedOnly ? 'DeepSeek/opencode sanitized_only accepted path' : 'DeepSeek/opencode requires sanitized_only task pack');
  if (gpt55Blocked) safetyNotes.push('gpt-5.5 requires explicit approval');

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    workerType: worker || null,
    taskId: pack.taskId || null,
    accepted,
    rejected,
    humanGateRequired,
    humanGateReason: humanGateRequired ? reasons.join('; ') || 'human gate required' : 'human gate not required',
    changedFilesAllowed,
    forbiddenFilesTouched,
    scopeViolationDetected,
    secretLeakDetected,
    customerDataDetected,
    ipCoreDetected,
    billingOrLeadManagementDetected,
    transcriberCustomerDataDetected,
    verifyCommandsPresent,
    returnDiffOnlyRespected,
    safetyNotes: buildSafetyNotes(safetyNotes),
    recommendedNextAction,
    changedFiles: files,
    patchSummary: patchSummaryText,
    routerExplanation,
    sourceTaskPack: pack,
    declaredScope: declared,
    verifyCommands: verifyList,
    riskNotes: String(riskNotes || ''),
  };
}

function buildPatchIntakeGate(patch = {}, context = {}) {
  return buildResult({
    sourceTaskPack: patch.sourceTaskPack || context.sourceTaskPack || {},
    workerType: patch.workerType || context.workerType,
    changedFiles: patch.changedFiles || context.changedFiles,
    patchSummary: patch.patchSummary || context.patchSummary,
    patchText: patch.diffText || patch.patchText || context.diffText || context.patchText,
    declaredScope: patch.declaredScope || context.declaredScope,
    verifyCommands: patch.verifyCommands || context.verifyCommands,
    riskNotes: patch.riskNotes || context.riskNotes,
    approvalReceived: patch.approvalReceived ?? context.approvalReceived ?? false,
    taskHint: patch.taskHint || context.taskHint,
  });
}

function evaluatePatchIntake(patch, context = {}) {
  return buildPatchIntakeGate(patch, context);
}

module.exports = {
  TOOL_META,
  buildPatchIntakeGate,
  evaluatePatchIntake,
  isDiffLike,
  isCodeFile,
  detectCustomerData,
  detectBillingLead,
  detectTranscriberCustomerData,
  detectSecretLike,
  detectIpCore,
};
