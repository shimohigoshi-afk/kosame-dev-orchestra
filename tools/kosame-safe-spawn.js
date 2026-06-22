'use strict';

const { spawn } = require('node:child_process');
const { assertExecutorPolicy } = require('./kosame-executor-policy-kernel');
const {
  assertExecutionHostAllowed,
  classifyExecutionHost,
  summarizeExecutionHostGuard,
} = require('./kosame-execution-host-guard');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeSpawn(command, args = [], options = {}) {
  const argv = Array.isArray(args) ? args.map((item) => String(item)) : [];
  const plan = {
    executorId: options.executorId || options.executor || '',
    route: options.route || 'zero-confirm',
    command: [String(command || ''), ...argv].filter(Boolean),
    stdio: options.stdio || 'pipe',
    shell: false,
    interactive: false,
    tty: false,
    autoResponder: options.autoResponder !== false,
    promptClassifier: options.promptClassifier !== false,
    firewall: options.firewall !== false,
    safetyStopDetector: options.safetyStopDetector !== false,
    resultPOST: options.resultPOST !== false,
  };
  const hostInfo = classifyExecutionHost({
    executionHost: options.executionHost,
    execution_host: options.execution_host,
    host: options.host,
    executionSource: options.executionSource,
    source: options.executionSource,
    interactive: options.interactive,
    safeSpawn: true,
    safeSpawnActive: true,
    console: options.console,
    runner: options.runner,
    apiRunner: options.apiRunner,
  });

  assertExecutionHostAllowed({
    executionHost: hostInfo.executionHost,
    executionSource: options.executionSource,
    safeSpawn: true,
    interactive: false,
  });

  assertExecutorPolicy(plan);

  const child = spawn(command, argv, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });

  return {
    ok: true,
    child,
    hostInfo,
    executionHostSummary: summarizeExecutionHostGuard(hostInfo),
    plan,
    command: plan.command,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
}

module.exports = {
  safeSpawn,
};
