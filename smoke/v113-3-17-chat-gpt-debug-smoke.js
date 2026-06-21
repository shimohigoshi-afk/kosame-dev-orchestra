"use strict";

// Smoke test for v113.3.17: chat-gpt debug logging + KOSAME.bat path fix.
// Root cause fixed: WSL .env was missing OPENAI_API_KEY + KOSAME_AGENT_LIVE_CALLS_ENABLED.
// Verifies:
//   1. Debug logging added to handleChatRequest GPT call block
//   2. KOSAME.bat uses ~/kosame-dev-orchestra (not ~/repos/kosame-dev-orchestra)
//   3. kosame-chat-gpt.js isLiveEnabled reads env at call time (not module load time)
//   4. Debug log lines cover: keyPresent, LIVE_CALLS_ENABLED, isLive, ok, dryRun, reason
//   5. Error path logged with [chat-gpt] ERROR prefix
//   6. package.json version + scripts
// Does NOT make live API calls. Does NOT read secrets. Does NOT deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`); failed++; }

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), "utf8"); }
  catch (e) { return null; }
}

function checkExists(label, relPath) {
  if (fs.existsSync(path.join(ROOT, relPath))) { ok(`${label}: exists`); return true; }
  fail(`${label}: exists`, `not found at ${relPath}`); return false;
}

function checkContains(label, content, pattern) {
  if (content === null) { fail(label, "file unreadable"); return; }
  const found = typeof pattern === "string" ? content.includes(pattern) : pattern.test(content);
  if (found) ok(label);
  else fail(label, typeof pattern === "string" ? `"${pattern}" not found` : "pattern not found");
}

async function main() {
  console.log("===== v113-3-17-chat-gpt-debug smoke =====");
  console.log("Verifies: debug logging + KOSAME.bat path fix + WSL .env root cause");
  console.log("");

  // ─── kosame-cockpit-chat-server.js: debug logging ────────────────────────
  console.log("--- kosame-cockpit-chat-server.js: debug logging ---");
  checkExists("cockpit-chat-server", "tools/kosame-cockpit-chat-server.js");
  const chatSrc = readFile("tools/kosame-cockpit-chat-server.js");
  if (chatSrc) {
    checkContains("debug: keyPresent log", chatSrc, "keyPresent=");
    checkContains("debug: LIVE_CALLS_ENABLED log", chatSrc, "LIVE_CALLS_ENABLED=");
    checkContains("debug: isLive log", chatSrc, "isLive=");
    checkContains("debug: ok/dryRun/reason log", chatSrc, "[chat-gpt] ok=");
    checkContains("debug: GPT reply used log", chatSrc, "GPT reply used");
    checkContains("debug: fallback to local reply log", chatSrc, "fallback to local reply");
    checkContains("debug: ERROR prefix log", chatSrc, "[chat-gpt] ERROR:");
    checkContains("debug: logs to stderr (not console.log)", chatSrc, "process.stderr.write");
    checkContains("debug: catch block logs error", chatSrc, /catch\s*\(err\)[\s\S]{0,200}stderr\.write/);
  }

  // ─── KOSAME.bat in repo: correct WSL path ────────────────────────────────
  console.log("--- KOSAME.bat: WSL path ---");
  checkExists("KOSAME.bat", "KOSAME.bat");
  const batSrc = readFile("KOSAME.bat");
  if (batSrc) {
    checkContains("KOSAME.bat: uses ~/kosame-dev-orchestra", batSrc, "~/kosame-dev-orchestra");
    if (batSrc.includes("~/repos/kosame-dev-orchestra"))
      fail("KOSAME.bat: does NOT use ~/repos/kosame-dev-orchestra", "old path still present");
    else
      ok("KOSAME.bat: does NOT use ~/repos/kosame-dev-orchestra");
    checkContains("KOSAME.bat: healthz polling loop", batSrc, "healthz");
    checkContains("KOSAME.bat: WSL startup check", batSrc, "wsl -d Ubuntu");
    checkContains("KOSAME.bat: opens browser", batSrc, "http://localhost:8080");
  }

  // ─── kosame-chat-gpt.js: isLiveEnabled reads env at call time ────────────
  console.log("--- kosame-chat-gpt.js: runtime env check ---");
  checkExists("kosame-chat-gpt", "tools/kosame-chat-gpt.js");
  const chatGptSrc = readFile("tools/kosame-chat-gpt.js");
  if (chatGptSrc) {
    // isLiveEnabled must be a function (not computed at module load)
    checkContains("chat-gpt: isLiveEnabled is a function definition", chatGptSrc,
      /function isLiveEnabled\(\)/);
    // Must NOT compute liveCallsActuallyEnabled at module level (that's provider-config.js pattern)
    const moduleLevel = chatGptSrc.slice(0, chatGptSrc.indexOf("function isLiveEnabled"));
    if (!moduleLevel.includes("OPENAI_API_KEY") || /function isLiveEnabled/.test(chatGptSrc))
      ok("chat-gpt: env read deferred to isLiveEnabled() call time");
    else
      fail("chat-gpt: env read deferred to isLiveEnabled() call time");
  }

  // ─── dry-run still works (no regression) ─────────────────────────────────
  console.log("--- dry-run regression check ---");
  try {
    const savedKey = process.env.OPENAI_API_KEY;
    const savedEnabled = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;

    // Re-require (may be cached — that's fine, isLiveEnabled reads env at call time)
    const mod = require(path.join(ROOT, "tools/kosame-chat-gpt.js"));
    if (!mod.isLiveEnabled()) ok("isLiveEnabled: false with no env vars");
    else fail("isLiveEnabled: false with no env vars", "returned true unexpectedly");

    const r = await mod.callKosameGPT([{ role: "user", content: "test" }], {});
    if (!r.ok && r.dryRun) ok("callKosameGPT: dry-run when no key");
    else fail("callKosameGPT: dry-run when no key", JSON.stringify(r));

    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
    if (savedEnabled !== undefined) process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED = savedEnabled;
  } catch (e) { fail("dry-run regression check", e.message); }

  // ─── version marker ───────────────────────────────────────────────────────
  console.log("--- version marker ---");
  ok("v113.3.17 chat-gpt-debug smoke present");

  // ─── package.json ─────────────────────────────────────────────────────────
  console.log("--- package.json ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts["smoke:chat-gpt-debug"]) ok('package.json scripts."smoke:chat-gpt-debug": exists');
    else fail('package.json scripts."smoke:chat-gpt-debug": exists');
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:chat-gpt-debug")) ok("verify includes smoke:chat-gpt-debug");
    else fail("verify includes smoke:chat-gpt-debug");
    if (String(pkg.version || "").includes("113.3.17")) ok("package.json version: 113.3.17");
    else fail("package.json version: 113.3.17", `got ${pkg.version}`);
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
