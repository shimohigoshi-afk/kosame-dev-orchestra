"use strict";

// KOSAME Kill Switch v113.3.12
// Blocks direct prompt execution from unauthorized sources.
// Blocked prompts are logged only — NOT executed, NOT treated as Safety Stop.
// Returns REDIRECT_MESSAGE to caller when blocked.

const ALLOWED_SOURCES = [
  "orchestra-handoff",       // Orchestra経由のHandoff
  "kosame-chat-dispatch",    // KOSAME CHATからの正規dispatch
  "runtime-contract",        // Runtime Contractを通過したもの
];

const BLOCKED_SOURCES = [
  "kosame-bat-raw-cli",      // KOSAME.bat直接起動のraw CLI
  "interactive-claude",      // 対話Claude窓からの直接指示
  "auto-responder-bypass",   // Auto-Responder外からのprompt
  "unauthenticated-startup", // Startup時の未認証prompt
];

const REDIRECT_MESSAGE = "Orchestra経由で指示してください";

const _log = [];

function check(context) {
  const source = (context && typeof context.source === "string") ? context.source : "unknown";
  const timestamp = new Date().toISOString();

  if (ALLOWED_SOURCES.includes(source)) {
    return {
      allowed: true,
      source,
      timestamp,
      message: null,
    };
  }

  const reason = BLOCKED_SOURCES.includes(source)
    ? `blocked source: ${source}`
    : `unknown/unauthorized source: ${source}`;

  const entry = {
    blocked: true,
    source,
    timestamp,
    reason,
    safetyStop: false,
  };
  _log.push(entry);

  const logger = context && typeof context.logger === "function"
    ? context.logger
    : (tag, msg) => console.log(tag, msg);
  logger("[KILL-SWITCH]", JSON.stringify(entry));

  return {
    allowed: false,
    source,
    timestamp,
    safetyStop: false,
    message: REDIRECT_MESSAGE,
    logEntry: entry,
  };
}

function getLog() {
  return [..._log];
}

function clearLog() {
  _log.length = 0;
}

function getAllowedSources() {
  return [...ALLOWED_SOURCES];
}

function getBlockedSources() {
  return [...BLOCKED_SOURCES];
}

if (require.main === module) {
  console.log("===== kosame-kill-switch v113.3.12 =====");
  console.log("allowedSources:", ALLOWED_SOURCES);
  console.log("blockedSources:", BLOCKED_SOURCES);
  console.log("");

  const demo = [
    { source: "orchestra-handoff" },
    { source: "kosame-chat-dispatch" },
    { source: "runtime-contract" },
    { source: "kosame-bat-raw-cli" },
    { source: "interactive-claude" },
    { source: "auto-responder-bypass" },
    { source: "unauthenticated-startup" },
    { source: "unknown" },
  ];

  for (const ctx of demo) {
    const result = check(ctx);
    const tag = result.allowed ? "ALLOW" : "BLOCK";
    const extra = result.message ? ` → "${result.message}"` : "";
    console.log(`  [${tag}] source="${ctx.source}"${extra}`);
  }

  console.log("");
  console.log("log entries:", getLog().length);
  console.log("===== end =====");
}

module.exports = {
  check,
  getLog,
  clearLog,
  getAllowedSources,
  getBlockedSources,
  REDIRECT_MESSAGE,
};
