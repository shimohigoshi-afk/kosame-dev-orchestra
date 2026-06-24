#!/usr/bin/env node
'use strict';

const { runDirectSpawnAudit } = require('./kosame-direct-spawn-audit');
const { runStartupAudit } = require('./kosame-startup-audit');
const { assertExecutorPolicy } = require('./kosame-executor-policy-kernel');
const { detectSafetyStop } = require('./kosame-safety-stop-detector');
const { evaluateNoYesGate } = require('./kosame-no-yes-gate');

function runAuditGate(options = {}) {
  const directSpawn = runDirectSpawnAudit(options);
  const startup = runStartupAudit(options);
  const executorPolicy = assertExecutorPolicy({
    executorId: 'claude-zero-confirm',
    route: 'zero-confirm',
    command: ['claude', '--dangerously-skip-permissions', '-p'],
    stdio: 'pipe',
    shell: false,
    interactive: false,
    tty: false,
    prompt: options.prompt || 'ok',
    autoResponder: true,
    promptClassifier: true,
    promptFirewall: true,
    safetyStopDetector: true,
    resultPOST: true,
  });
  const safetyStop = detectSafetyStop(options.prompt || '');
  const noYes = evaluateNoYesGate({
    text: options.prompt || '',
    source: options.source || 'stdout',
    executionHost: options.executionHost || 'kosame-console',
  });

  return {
    pass: !!directSpawn.pass && !!startup.pass && !!executorPolicy.ok && !safetyStop.matched && !noYes.interactivePromptBlocked,
    directSpawn,
    startup,
    executorPolicy,
    safetyStop,
    noYes,
  };
}

module.exports = {
  runAuditGate,
};
