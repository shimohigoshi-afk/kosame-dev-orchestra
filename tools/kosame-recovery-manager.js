#!/usr/bin/env node
'use strict';

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function createRecoveryPlan(input = {}) {
  const failures = Array.isArray(input.failures) ? input.failures.slice(0, 20) : [];
  const retryable = failures.filter((item) => !/Safety Stop|blocked|force push|tag force/i.test(normalizeText(item.reason || item.message)));
  return {
    retryableCount: retryable.length,
    blockedCount: failures.length - retryable.length,
    shouldRetry: retryable.length > 0,
    shouldBlock: failures.length > 0 && retryable.length === 0,
    retryCount: Number.isFinite(Number(input.retryCount)) ? Number(input.retryCount) : retryable.length,
    recovered: !!input.recovered || retryable.length > 0,
    fallbackResult: input.fallbackResult || null,
  };
}

function buildBlockedResult(context = {}) {
  return {
    ok: false,
    blocked: true,
    recovered: !!context.recovered,
    retryCount: Number.isFinite(Number(context.retryCount)) ? Number(context.retryCount) : 0,
    result_status: 'failed',
    smoke_result: context.smoke_result || 'FAIL',
    verify_result: context.verify_result || 'FAIL',
    result_summary: context.result_summary || 'blocked by recovery manager',
    resultPOSTStatus: context.resultPOSTStatus || 'POST /api/work-orders/result 200',
    reason: context.reason || 'blocked',
  };
}

function summarizeRecoveryManagerState(state = {}) {
  return {
    retryableCount: Number(state.retryableCount || 0),
    blockedCount: Number(state.blockedCount || 0),
    shouldRetry: !!state.shouldRetry,
    shouldBlock: !!state.shouldBlock,
    retryCount: Number(state.retryCount || 0),
    recovered: !!state.recovered,
  };
}

module.exports = {
  createRecoveryPlan,
  buildBlockedResult,
  summarizeRecoveryManagerState,
};
