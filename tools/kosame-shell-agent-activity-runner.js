#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  appendShellAgentActivityEvent,
  compactText,
} = require('./kosame-shell-agent-activity');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PROJECT = 'KOSAME Dev Orchestra';
const ALLOWED_SCRIPTS = new Set([
  'verify',
  'smoke:v110-84-18',
  'smoke:v110-84-17',
  'smoke:v110-84-16',
  'smoke:v110-84-15',
  'activity:fail-sample',
]);

const CLI_USAGE = `Usage:
  node tools/kosame-shell-agent-activity-runner.js --script verify --agent Codex --task "v110.84.18 verify"

Options:
  --script <npm-script>   Whitelisted npm script to run
  --agent <name>
  --project <name>
  --task <text>
  --message <text>
  --log-path <path>`;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function printUsage() {
  console.error(CLI_USAGE);
}

function parseRunnerArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const parsed = {
    script: '',
    agent: '',
    project: '',
    task: '',
    message: '',
    logPath: '',
    help: false,
    _extras: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--script' || arg === '--agent' || arg === '--project' || arg === '--task' || arg === '--message' || arg === '--log-path') {
      const value = args[index + 1];
      if (typeof value !== 'string' || !value.trim()) {
        parsed._extras.push(arg);
      } else {
        const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        parsed[key] = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--script=')) {
      parsed.script = arg.slice('--script='.length);
      continue;
    }
    if (arg.startsWith('--agent=')) {
      parsed.agent = arg.slice('--agent='.length);
      continue;
    }
    if (arg.startsWith('--project=')) {
      parsed.project = arg.slice('--project='.length);
      continue;
    }
    if (arg.startsWith('--task=')) {
      parsed.task = arg.slice('--task='.length);
      continue;
    }
    if (arg.startsWith('--message=')) {
      parsed.message = arg.slice('--message='.length);
      continue;
    }
    if (arg.startsWith('--log-path=')) {
      parsed.logPath = arg.slice('--log-path='.length);
      continue;
    }
    parsed._extras.push(arg);
  }

  return parsed;
}

function validateScriptName(script) {
  const normalized = normalizeText(script);
  if (!normalized) {
    throw new Error('Missing required --script');
  }
  if (!/^[A-Za-z0-9:_-]+$/.test(normalized)) {
    throw new Error(`Invalid script name: ${normalized}`);
  }
  if (!ALLOWED_SCRIPTS.has(normalized)) {
    throw new Error(`Blocked non-whitelisted script: ${normalized}`);
  }
  return normalized;
}

function buildStatusForScript(script) {
  return script === 'verify' ? 'verifying' : 'running';
}

function buildStartMessage(script) {
  return script === 'verify' ? 'verify を開始しました' : `${script} を開始しました`;
}

function buildSuccessMessage(script) {
  return script === 'verify' ? 'verify が成功しました' : `${script} が成功しました`;
}

function buildFailedMessage(script) {
  return script === 'verify' ? 'verify が失敗しました' : `${script} が失敗しました`;
}

function appendActivity({ script, agent, project, task, message, status, logPath }) {
  return appendShellAgentActivityEvent({
    shellAgentActivityLogPath: logPath,
    agent: agent || 'Shell',
    project: project || DEFAULT_PROJECT,
    status,
    task: task || script,
    message,
  });
}

function runWhitelistedScript(options) {
  const script = validateScriptName(options.script);
  const agent = compactText(options.agent, 80) || 'Shell';
  const project = compactText(options.project, 120) || DEFAULT_PROJECT;
  const task = compactText(options.task, 120) || script;
  const logPath = normalizeText(options.logPath);
  const startStatus = buildStatusForScript(script);

  appendActivity({
    script,
    agent,
    project,
    task,
    message: buildStartMessage(script),
    status: startStatus,
    logPath,
  });

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', '--silent', script], {
    cwd: ROOT,
    env: logPath
      ? { ...process.env, KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: logPath }
      : process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    appendActivity({
      script,
      agent,
      project,
      task,
      message: buildFailedMessage(script),
      status: 'failed',
      logPath,
    });
    return {
      ok: false,
      status: typeof result.status === 'number' ? result.status : 1,
      signal: result.signal || '',
      script,
    };
  }

  appendActivity({
    script,
    agent,
    project,
    task,
    message: buildSuccessMessage(script),
    status: 'success',
    logPath,
  });
  return {
    ok: true,
    status: 0,
    script,
  };
}

function runCli(argv) {
  const parsed = parseRunnerArgs(argv);
  if (parsed.help) {
    printUsage();
    return { ok: true, help: true };
  }
  if (Array.isArray(parsed._extras) && parsed._extras.length > 0) {
    throw new Error(`Unsupported arguments: ${parsed._extras.join(' ')}`);
  }
  return runWhitelistedScript(parsed);
}

module.exports = {
  ALLOWED_SCRIPTS,
  CLI_USAGE,
  buildFailedMessage,
  buildStartMessage,
  buildStatusForScript,
  buildSuccessMessage,
  parseRunnerArgs,
  runCli,
  runWhitelistedScript,
  validateScriptName,
};

if (require.main === module) {
  try {
    const [, , ...argv] = process.argv;
    const result = runCli(argv);
    process.exitCode = result && result.ok ? 0 : (typeof result.status === 'number' ? result.status : 1);
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    console.error(CLI_USAGE);
    process.exitCode = 1;
  }
}
