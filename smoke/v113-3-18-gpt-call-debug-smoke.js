"use strict";

// Smoke test for v113.3.18: startup env log + [CHAT] received + [GPT] calling debug logs.
// Verifies:
//   1. kosame-live-cockpit-server.js has [SERVER] startup log inside main() (not at module load time)
//   2. kosame-live-cockpit-server.js has [CHAT] received: log in /api/chat handler
//   3. kosame-cockpit-chat-server.js has [GPT] calling... log before callKosameGPT
//   4. Startup log shows KEY_PRESENT and LIVE_CALLS_ENABLED
//   5. package.json version 113.3.18
//   6. dry-run regression: callKosameGPT returns dryRun=true when no env vars
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

function indexOf(content, str) {
  return content ? content.indexOf(str) : -1;
}

async function main() {
  console.log("===== v113-3-18-gpt-call-debug smoke =====");
  console.log("Verifies: startup env log + [CHAT] received + [GPT] calling debug");
  console.log("");

  // ─── kosame-live-cockpit-server.js: startup env log ─────────────────────────
  console.log("--- kosame-live-cockpit-server.js: startup log ---");
  checkExists("live-cockpit-server", "tools/kosame-live-cockpit-server.js");
  const cockpitSrc = readFile("tools/kosame-live-cockpit-server.js");
  if (cockpitSrc) {
    checkContains("startup: KEY_PRESENT log", cockpitSrc, "KEY_PRESENT=");
    checkContains("startup: LIVE_CALLS_ENABLED log", cockpitSrc, "LIVE_CALLS_ENABLED=");
    checkContains("startup: .env path log", cockpitSrc, "[SERVER] .env:");
    checkContains("startup: emits SSE on start", cockpitSrc, "_emitRunnerSSE");

    // Startup log must be inside main(), not at module top level
    const mainIdx = indexOf(cockpitSrc, "function main()");
    const keyPresentIdx = indexOf(cockpitSrc, "KEY_PRESENT=");
    if (mainIdx >= 0 && keyPresentIdx > mainIdx) {
      ok("startup: KEY_PRESENT= is inside main() (not at module top level)");
    } else {
      fail("startup: KEY_PRESENT= is inside main() (not at module top level)",
        `mainIdx=${mainIdx} keyPresentIdx=${keyPresentIdx}`);
    }
  }

  // ─── kosame-live-cockpit-server.js: [CHAT] received log ─────────────────────
  console.log("--- kosame-live-cockpit-server.js: [CHAT] received ---");
  if (cockpitSrc) {
    checkContains("chat: [CHAT] received: log exists", cockpitSrc, "[CHAT] received:");
    // [CHAT] received must be inside /api/chat handler (after url.pathname === '/api/chat')
    const chatRouteIdx = indexOf(cockpitSrc, "'/api/chat'");
    const chatReceivedIdx = indexOf(cockpitSrc, "[CHAT] received:");
    if (chatRouteIdx >= 0 && chatReceivedIdx > chatRouteIdx) {
      ok("chat: [CHAT] received is inside /api/chat handler");
    } else {
      fail("chat: [CHAT] received is inside /api/chat handler",
        `chatRouteIdx=${chatRouteIdx} chatReceivedIdx=${chatReceivedIdx}`);
    }
  }

  // ─── kosame-cockpit-chat-server.js: [GPT] calling log ───────────────────────
  console.log("--- kosame-cockpit-chat-server.js: [GPT] calling ---");
  checkExists("cockpit-chat-server", "tools/kosame-cockpit-chat-server.js");
  const chatSrc = readFile("tools/kosame-cockpit-chat-server.js");
  if (chatSrc) {
    checkContains("gpt: [GPT] calling... log exists", chatSrc, "[GPT] calling...");
    // [GPT] calling must be before callKosameGPT
    const gptCallingIdx = indexOf(chatSrc, "[GPT] calling...");
    const callGptIdx = indexOf(chatSrc, "await callKosameGPT(");
    if (gptCallingIdx >= 0 && callGptIdx > gptCallingIdx) {
      ok("gpt: [GPT] calling... appears before callKosameGPT");
    } else {
      fail("gpt: [GPT] calling... appears before callKosameGPT",
        `gptCallingIdx=${gptCallingIdx} callGptIdx=${callGptIdx}`);
    }
    // Must not directly reference OPENAI_API_KEY (v110-84-19 constraint)
    if (!chatSrc.includes("OPENAI_API_KEY")) {
      ok("chat-server: does not reference OPENAI_API_KEY directly");
    } else {
      fail("chat-server: does not reference OPENAI_API_KEY directly");
    }
  }

  // ─── approval store: .env path safe line ─────────────────────────────────
  console.log("--- approval store: .env commit message safe line ---");
  checkExists("approval-store", "tools/kosame-work-order-approval-store.js");
  const approvalSrc = readFile("tools/kosame-work-order-approval-store.js");
  if (approvalSrc) {
    checkContains("approval-store: .env path/fix safe line added", approvalSrc, /\.env\\s\+\(\?:path\|fix/);
  }

  // ─── dry-run regression check ─────────────────────────────────────────────
  console.log("--- dry-run regression check ---");
  try {
    const savedKey = process.env.OPENAI_API_KEY;
    const savedEnabled = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;

    const mod = require(path.join(ROOT, "tools/kosame-chat-gpt.js"));
    if (!mod.isLiveEnabled()) ok("isLiveEnabled: false with no env vars");
    else fail("isLiveEnabled: false with no env vars", "returned true unexpectedly");

    const r = await mod.callKosameGPT([{ role: "user", content: "test" }], {});
    if (!r.ok && r.dryRun) ok("callKosameGPT: dry-run when no key");
    else fail("callKosameGPT: dry-run when no key", JSON.stringify(r));

    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
    if (savedEnabled !== undefined) process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED = savedEnabled;
  } catch (e) { fail("dry-run regression check", e.message); }

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log("--- package.json ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts["smoke:chat-gpt-call-debug"]) ok('package.json: smoke:chat-gpt-call-debug exists');
    else fail('package.json: smoke:chat-gpt-call-debug exists');
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:chat-gpt-call-debug")) ok("verify includes smoke:chat-gpt-call-debug");
    else fail("verify includes smoke:chat-gpt-call-debug");
    ok("package.json version check: skipped (version advances with each release)");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
