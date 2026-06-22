'use strict';

const ALLOWED_EXECUTION_HOSTS = new Set([
  'kosame-console',
  'kosame-runner',
  'kosame-api-runner',
  'github-actions',
  'safe-spawn',
]);

const BLOCKED_EXECUTION_HOSTS = new Set([
  'manual-terminal',
  'claude-code-ui',
  'codex-code-ui',
  'unknown-interactive',
]);

const OFFICIAL_ROUTE = 'Console → Handoff → Runner';
const MANUAL_CODE_UI_ALLOWED = false;
const CODEX_YES_HELL_GUARD = 'active';
const CODEX_AUTO_APPROVE_MODE = 'active';
const SAFETY_STOP_GUARD = 'active';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function classifyExecutionSource(input = {}) {
  const explicitSource = normalizeLower(
    input.executionSource
    || input.execution_source
    || input.source
    || '',
  );
  const text = explicitSource || normalizeLower(input.label || '');

  if (/claude.*code.*ui|claude[-\s]?code[-\s]?ui|claude[-\s]?ui/.test(text)) return 'claude-code-ui';
  if (/codex.*code.*ui|codex[-\s]?code[-\s]?ui|codex[-\s]?ui/.test(text)) return 'codex-code-ui';
  if (/session.*feedback|feedback.*prompt|how is claude doing this session/.test(text)) return 'session-feedback-prompt';
  if (/handoff.*bridge|api\/handoff|handoff inbox|handoff/.test(text)) return 'handoff-bridge';
  if (/spec[-\s]?to[-\s]?tasks|設計書|仕様書|spec\b/.test(text)) return 'spec-to-tasks';
  if (/attachment|添付|upload|file attach/.test(text)) return 'attachment-pipeline';
  if (/\bnpm\b|\bgit\b/.test(text)) return 'npm/git';
  if (/github actions|github[-\s]?actions|gha/.test(text)) return 'github-actions';
  if (/safe[-\s]?spawn/.test(text)) return 'safe-spawn';
  if (/kosame[-\s]?console|console|live cockpit/.test(text)) return 'kosame-console';
  if (/kosame[-\s]?runner|runner queue|dispatch watcher|watcher/.test(text)) return 'kosame-runner';
  if (/api[-\s]?runner|runner dispatch|api runner/.test(text)) return 'kosame-api-runner';
  if (/manual[-\s]?terminal|terminal|tty|shell/.test(text)) return 'manual-terminal';
  return text ? 'unknown-interactive' : 'unknown-interactive';
}

function classifyExecutionHost(input = {}) {
  const executionSource = classifyExecutionSource(input);
  const requestedHost = normalizeLower(
    input.executionHost
    || input.execution_host
    || input.host
    || process.env.KOSAME_EXECUTION_HOST
    || '',
  );
  const runtimeInteractive = !!(input.interactive || process.stdin.isTTY || process.stdout.isTTY);
  const explicitSafeSpawn = !!input.safeSpawn || !!input.safeSpawnActive || requestedHost === 'safe-spawn' || executionSource === 'safe-spawn';
  const explicitConsole = !!input.console || requestedHost === 'kosame-console' || executionSource === 'kosame-console';
  const explicitRunner = !!input.runner || requestedHost === 'kosame-runner' || executionSource === 'kosame-runner';
  const explicitApiRunner = !!input.apiRunner || requestedHost === 'kosame-api-runner' || executionSource === 'kosame-api-runner';

  let executionHost = requestedHost;
  if (!executionHost) {
    if (process.env.GITHUB_ACTIONS === 'true' || executionSource === 'github-actions') {
      executionHost = 'github-actions';
    } else if (explicitConsole) {
      executionHost = 'kosame-console';
    } else if (explicitRunner) {
      executionHost = 'kosame-runner';
    } else if (explicitApiRunner) {
      executionHost = 'kosame-api-runner';
    } else if (explicitSafeSpawn) {
      executionHost = 'safe-spawn';
    } else if (runtimeInteractive) {
      executionHost = 'manual-terminal';
    } else {
      executionHost = 'unknown-interactive';
    }
  }

  if (/claude.*code.*ui|claude[-\s]?code[-\s]?ui|claude[-\s]?ui/.test(executionHost)) executionHost = 'claude-code-ui';
  if (/codex.*code.*ui|codex[-\s]?code[-\s]?ui|codex[-\s]?ui/.test(executionHost)) executionHost = 'codex-code-ui';
  if (/manual[-\s]?terminal|terminal|tty/.test(executionHost) && !ALLOWED_EXECUTION_HOSTS.has(executionHost)) executionHost = 'manual-terminal';
  if (/github[-\s]?actions|gha/.test(executionHost)) executionHost = 'github-actions';
  if (/safe[-\s]?spawn/.test(executionHost)) executionHost = 'safe-spawn';
  if (/kosame[-\s]?console/.test(executionHost)) executionHost = 'kosame-console';
  if (/kosame[-\s]?runner|dispatch watcher|runner queue/.test(executionHost)) executionHost = 'kosame-runner';
  if (/api[-\s]?runner/.test(executionHost)) executionHost = 'kosame-api-runner';

  const executionHostAllowed = ALLOWED_EXECUTION_HOSTS.has(executionHost);
  const interactiveHostBlocked = BLOCKED_EXECUTION_HOSTS.has(executionHost);
  const blockedReason = interactiveHostBlocked
    ? `blocked_interactive_host:${executionHost}`
    : executionHostAllowed
      ? ''
      : `unknown_interactive_host:${executionHost || 'unknown-interactive'}`;

  return {
    executionHost,
    executionHostAllowed,
    interactiveHostBlocked,
    interactivePromptBlocked: interactiveHostBlocked,
    blockedReason,
    executionSource,
    executionSourceAllowed: true,
    executionSourceBlocked: /claude-code-ui|codex-code-ui|manual-terminal|unknown-interactive/.test(executionSource),
    manualCodeUiAllowed: MANUAL_CODE_UI_ALLOWED,
    noYesGateRuntime: executionHostAllowed && !interactiveHostBlocked,
    safeSpawnActive: executionHost === 'safe-spawn' || explicitSafeSpawn,
    officialRoute: OFFICIAL_ROUTE,
    codexYesHellGuard: CODEX_YES_HELL_GUARD,
    codexAutoApproveMode: CODEX_AUTO_APPROVE_MODE,
    userYesRequired: false,
    safetyStopGuard: SAFETY_STOP_GUARD,
    runtimeInteractive,
    source: normalizeText(input.source || ''),
  };
}

function assertExecutionHostAllowed(input = {}) {
  const host = classifyExecutionHost(input);
  if (!host.executionHostAllowed || host.interactiveHostBlocked) {
    throw new Error(host.blockedReason || `blocked_interactive_host:${host.executionHost}`);
  }
  return host;
}

function createBlockedExecutionHostResult(input = {}) {
  const host = classifyExecutionHost(input);
  return {
    ok: false,
    blocked: true,
    blockedReason: host.blockedReason || 'blocked_interactive_host',
    executionHost: host.executionHost,
    executionHostAllowed: host.executionHostAllowed,
    interactiveHostBlocked: host.interactiveHostBlocked,
    interactivePromptBlocked: host.interactivePromptBlocked,
    noYesGateRuntime: host.noYesGateRuntime,
    safeSpawnActive: host.safeSpawnActive,
    manualCodeUiAllowed: host.manualCodeUiAllowed,
    officialRoute: host.officialRoute,
    codexYesHellGuard: host.codexYesHellGuard,
    codexAutoApproveMode: host.codexAutoApproveMode,
    userYesRequired: host.userYesRequired,
    safetyStopGuard: host.safetyStopGuard,
    executionSource: host.executionSource,
    executionSourceAllowed: host.executionSourceAllowed,
    executionSourceBlocked: host.executionSourceBlocked,
    userInputRequired: false,
  };
}

function summarizeExecutionHostGuard(input = {}) {
  const host = classifyExecutionHost(input);
  return [
    `executionHost=${host.executionHost}`,
    `executionHostAllowed=${host.executionHostAllowed ? 'true' : 'false'}`,
    `interactiveHostBlocked=${host.interactiveHostBlocked ? 'true' : 'false'}`,
    `interactivePromptBlocked=${host.interactivePromptBlocked ? 'true' : 'false'}`,
    `executionSource=${host.executionSource}`,
    `noYesGateRuntime=${host.noYesGateRuntime ? 'true' : 'false'}`,
    `safeSpawnActive=${host.safeSpawnActive ? 'true' : 'false'}`,
    `manualCodeUiAllowed=${host.manualCodeUiAllowed ? 'true' : 'false'}`,
    `officialRoute=${host.officialRoute}`,
    `codexYesHellGuard=${host.codexYesHellGuard}`,
    `codexAutoApproveMode=${host.codexAutoApproveMode}`,
    `userYesRequired=${host.userYesRequired ? 'true' : 'false'}`,
    `safetyStopGuard=${host.safetyStopGuard}`,
  ].join(' / ');
}

module.exports = {
  ALLOWED_EXECUTION_HOSTS,
  BLOCKED_EXECUTION_HOSTS,
  OFFICIAL_ROUTE,
  MANUAL_CODE_UI_ALLOWED,
  CODEX_YES_HELL_GUARD,
  CODEX_AUTO_APPROVE_MODE,
  SAFETY_STOP_GUARD,
  classifyExecutionSource,
  classifyExecutionHost,
  assertExecutionHostAllowed,
  createBlockedExecutionHostResult,
  summarizeExecutionHostGuard,
};
