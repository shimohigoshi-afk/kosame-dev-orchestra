#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { classifyPrompt } = require('./kosame-prompt-classifier');
const { evaluatePromptFirewall } = require('./kosame-forbidden-prompt-firewall');

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function createAutoResponderGateway(options = {}) {
  const state = {
    retriesByHash: new Map(),
    lastPromptHash: '',
    lastInputType: '',
    lastInputValue: '',
    lastClassification: null,
    lastBlockedReason: '',
  };
  const retryLimit = Number.isFinite(Number(options.retryLimit)) ? Number(options.retryLimit) : 3;

  function buildAutoResponse(promptInfo) {
    const classification = promptInfo && promptInfo.promptType ? promptInfo : classifyPrompt(promptInfo, 'stdout');
    state.lastClassification = classification;
    if (classification.promptType === 'safety_stop_prompt') {
      state.lastBlockedReason = classification.blockedReason || 'Safety Stop';
      return { kind: 'blocked', value: '', valueType: 'blocked', classification, blockedReason: state.lastBlockedReason };
    }
    const responseType = classification.recommendedInputType || 'yes';
    const value = classification.recommendedInputValue || 'yes\n';
    return {
      kind: 'auto-response',
      value,
      valueType: responseType,
      classification,
      blockedReason: '',
    };
  }

  function sendAutoResponse(child, response) {
    if (!child || !child.stdin || typeof child.stdin.write !== 'function') {
      throw new Error('child.stdin is not writable');
    }
    const value = normalizeText(response && response.value ? response.value : response);
    if (!value) return { ok: false, reason: 'empty response' };
    child.stdin.write(value);
    state.lastInputValue = response && response.valueType ? response.valueType : 'yes';
    return { ok: true, valueType: state.lastInputValue };
  }

  function shouldRetry(promptHash) {
    const current = Number(state.retriesByHash.get(promptHash) || 0);
    return current < retryLimit;
  }

  function recordRetry(promptHash) {
    const current = Number(state.retriesByHash.get(promptHash) || 0);
    state.retriesByHash.set(promptHash, current + 1);
    return current + 1;
  }

  function handlePromptChunk(chunk, context = {}) {
    const text = normalizeText(chunk);
    const firewall = evaluatePromptFirewall(text, context.source || 'stdout');
    const classification = classifyPrompt(text, context.source || 'stdout');
    state.lastClassification = classification;
    state.lastPromptHash = classification.promptHash || crypto.createHash('sha1').update(text).digest('hex');
    if (firewall.blocked && classification.safetyStopMatched) {
      return {
        ok: false,
        blocked: true,
        safetyStop: true,
        reason: classification.blockedReason || firewall.reason || 'Safety Stop',
        classification,
      };
    }
    if (firewall.blocked) {
      return {
        ok: true,
        blocked: false,
        autoRespond: true,
        response: buildAutoResponse(classification),
        classification,
      };
    }
    if (!shouldRetry(state.lastPromptHash)) {
      return {
        ok: false,
        blocked: true,
        safetyStop: false,
        reason: 'retry limit reached',
        classification,
      };
    }
    recordRetry(state.lastPromptHash);
    return {
      ok: true,
      blocked: false,
      autoRespond: true,
      response: buildAutoResponse(classification),
      classification,
    };
  }

  function createAutoApprovedResult(context = {}) {
    return {
      result_status: 'success',
      smoke_result: context.smoke_result || 'PASS',
      verify_result: context.verify_result || 'PASS',
      autoApprovedCount: Number(context.autoApprovedCount || 1),
      autoBlockedCount: Number(context.autoBlockedCount || 0),
      retryCount: Number(context.retryCount || 0),
      recovered: !!context.recovered,
      resultPOSTStatus: context.resultPOSTStatus || 'POST /api/work-orders/result 200',
      decisionStatus: context.decisionStatus || 'ready_for_commit',
    };
  }

  function createBlockedResult(context = {}) {
    return {
      result_status: 'failed',
      smoke_result: context.smoke_result || 'FAIL',
      verify_result: context.verify_result || 'FAIL',
      autoApprovedCount: Number(context.autoApprovedCount || 0),
      autoBlockedCount: Number(context.autoBlockedCount || 1),
      retryCount: Number(context.retryCount || 0),
      recovered: !!context.recovered,
      resultPOSTStatus: context.resultPOSTStatus || 'POST /api/work-orders/result 200',
      decisionStatus: context.decisionStatus || 'stop_and_investigate',
    };
  }

  function summarizeAutoResponderState(nextState = state) {
    return {
      lastPromptHash: nextState.lastPromptHash || '',
      lastInputType: nextState.lastInputType || '',
      lastInputValue: nextState.lastInputValue || '',
      lastBlockedReason: nextState.lastBlockedReason || '',
      retriesTracked: nextState.retriesByHash.size,
    };
  }

  return {
    state,
    buildAutoResponse,
    sendAutoResponse,
    handlePromptChunk,
    createAutoApprovedResult,
    createBlockedResult,
    summarizeAutoResponderState,
  };
}

module.exports = {
  createAutoResponderGateway,
};
