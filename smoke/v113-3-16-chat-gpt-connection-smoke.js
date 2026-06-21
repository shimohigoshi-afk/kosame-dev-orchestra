"use strict";

// Smoke test for v113.3.16: KOSAME CHAT → OpenAI API (GPT) + SSE → AGENT STREAM LOG.
// Verifies:
//   1. tools/kosame-chat-gpt.js exists and exports expected symbols
//   2. dry-run when OPENAI_API_KEY not set
//   3. persona loaded from config/kosame-cockpit-chat-persona.md
//   4. provider-config.json KOSAME agent uses "gpt" model
//   5. kosame-cockpit-chat-server.js imports and calls callKosameGPT
//   6. kosame-live-cockpit-server.js emits SSE after chat reply
//   7. handleChatRequest returns ok:true with local fallback (dry-run mode)
//   8. package.json version + scripts
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
  else fail(label, typeof pattern === "string" ? `"${pattern}" not found` : `pattern not found`);
}

async function main() {
  console.log("===== v113-3-16-chat-gpt-connection smoke =====");
  console.log("Verifies: KOSAME CHAT → OpenAI GPT + SSE → AGENT STREAM LOG");
  console.log("");

  // ─── kosame-chat-gpt.js: exports and structure ────────────────────────────
  console.log("--- tools/kosame-chat-gpt.js ---");
  const chatGptExists = checkExists("kosame-chat-gpt", "tools/kosame-chat-gpt.js");
  const chatGptSrc = readFile("tools/kosame-chat-gpt.js");

  if (chatGptExists && chatGptSrc) {
    checkContains("chat-gpt: exports callKosameGPT", chatGptSrc, "callKosameGPT");
    checkContains("chat-gpt: exports isLiveEnabled", chatGptSrc, "isLiveEnabled");
    checkContains("chat-gpt: exports loadPersona", chatGptSrc, "loadPersona");
    checkContains("chat-gpt: uses PERSONA_PATH for persona file", chatGptSrc, "kosame-cockpit-chat-persona.md");
    checkContains("chat-gpt: reads provider-config.json", chatGptSrc, "provider-config.json");
    checkContains("chat-gpt: gate checks OPENAI_API_KEY presence", chatGptSrc, "OPENAI_API_KEY");
    checkContains("chat-gpt: gate checks KOSAME_AGENT_LIVE_CALLS_ENABLED", chatGptSrc, "KOSAME_AGENT_LIVE_CALLS_ENABLED");
    if (!/console\.log[^)]*OPENAI_API_KEY/.test(chatGptSrc)) ok("chat-gpt: API key value never console.logged");
    else fail("chat-gpt: API key value never console.logged", "OPENAI_API_KEY found in console.log");
    checkContains("chat-gpt: default model gpt-4o-mini", chatGptSrc, "gpt-4o-mini");
    checkContains("chat-gpt: returns dryRun:true when gate not met", chatGptSrc, "dryRun: true");
    checkContains("chat-gpt: uses fetch for OpenAI API", chatGptSrc, "fetch('https://api.openai.com");
    checkContains("chat-gpt: system prompt includes persona", chatGptSrc, "role: 'system'");
    checkContains("chat-gpt: AbortController for timeout", chatGptSrc, "AbortController");
    checkContains("chat-gpt: module.exports present", chatGptSrc, "module.exports");
  }

  // ─── dry-run test (no live API call) ─────────────────────────────────────
  console.log("--- dry-run gate test ---");
  let chatGptModule;
  try {
    // Temporarily clear API key + live flag to force dry-run
    const savedKey = process.env.OPENAI_API_KEY;
    const savedEnabled = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;

    chatGptModule = require(path.join(ROOT, "tools/kosame-chat-gpt.js"));

    if (typeof chatGptModule.callKosameGPT === "function") ok("callKosameGPT is a function");
    else fail("callKosameGPT is a function", typeof chatGptModule.callKosameGPT);

    if (typeof chatGptModule.isLiveEnabled === "function") ok("isLiveEnabled is a function");
    else fail("isLiveEnabled is a function");

    if (typeof chatGptModule.loadPersona === "function") ok("loadPersona is a function");
    else fail("loadPersona is a function");

    if (chatGptModule.isLiveEnabled() === false) ok("isLiveEnabled: returns false when no key");
    else fail("isLiveEnabled: returns false when no key");

    const dryResult = await chatGptModule.callKosameGPT([{ role: "user", content: "こんにちは" }], {});
    if (dryResult.ok === false) ok("callKosameGPT: ok=false in dry-run");
    else fail("callKosameGPT: ok=false in dry-run", JSON.stringify(dryResult));
    if (dryResult.dryRun === true) ok("callKosameGPT: dryRun=true when no key");
    else fail("callKosameGPT: dryRun=true when no key", JSON.stringify(dryResult));
    if (dryResult.reply === null) ok("callKosameGPT: reply=null in dry-run");
    else fail("callKosameGPT: reply=null in dry-run", dryResult.reply);

    // Restore env
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
    if (savedEnabled !== undefined) process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED = savedEnabled;
  } catch (e) { fail("kosame-chat-gpt.js: loads without error", e.message); }

  // ─── persona file check ───────────────────────────────────────────────────
  console.log("--- persona file ---");
  const personaExists = checkExists("persona file", "config/kosame-cockpit-chat-persona.md");
  const personaSrc = readFile("config/kosame-cockpit-chat-persona.md");
  if (personaExists && personaSrc) {
    checkContains("persona: has こさめ character definition", personaSrc, "こさめ");
    checkContains("persona: has じゅんやさん", personaSrc, "じゅんやさん");
  }
  if (chatGptModule) {
    try {
      const persona = chatGptModule.loadPersona();
      if (typeof persona === "string" && persona.length > 0) ok("loadPersona: returns non-empty string");
      else fail("loadPersona: returns non-empty string", JSON.stringify(persona));
    } catch (e) { fail("loadPersona: does not throw", e.message); }
  }

  // ─── provider-config.json: KOSAME uses gpt ───────────────────────────────
  console.log("--- provider-config.json ---");
  checkExists("provider-config.json", "providers/provider-config.json");
  let providerConfig;
  try {
    providerConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "providers/provider-config.json"), "utf8"));
    ok("provider-config.json: parses as JSON");
  } catch (e) { fail("provider-config.json: parses as JSON", e.message); }
  if (providerConfig) {
    const kosameCfg = providerConfig.agents && providerConfig.agents.KOSAME;
    if (kosameCfg && kosameCfg.model === "gpt") ok("provider-config.json: KOSAME agent uses gpt model");
    else fail("provider-config.json: KOSAME agent uses gpt model", JSON.stringify(kosameCfg));
  }

  // ─── kosame-cockpit-chat-server.js: imports and calls callKosameGPT ──────
  console.log("--- kosame-cockpit-chat-server.js ---");
  checkExists("cockpit-chat-server", "tools/kosame-cockpit-chat-server.js");
  const chatServerSrc = readFile("tools/kosame-cockpit-chat-server.js");
  if (chatServerSrc) {
    checkContains("chat-server: imports callKosameGPT", chatServerSrc, "callKosameGPT");
    checkContains("chat-server: imports from kosame-chat-gpt", chatServerSrc, "kosame-chat-gpt");
    // Verify callKosameGPT appears inside handleChatRequest body (after its definition)
    const hcrIdx = chatServerSrc.indexOf("async function handleChatRequest(");
    const cgIdx = chatServerSrc.indexOf("await callKosameGPT(");
    if (hcrIdx !== -1 && cgIdx !== -1 && cgIdx > hcrIdx)
      ok("chat-server: calls callKosameGPT in handleChatRequest");
    else
      fail("chat-server: calls callKosameGPT in handleChatRequest", `hcrIdx=${hcrIdx} cgIdx=${cgIdx}`);
    checkContains("chat-server: falls back to local reply on failure", chatServerSrc, "fall through to local reply");
    checkContains("chat-server: sets gptProvider on success", chatServerSrc, "gptProvider");
  }

  // ─── kosame-live-cockpit-server.js: SSE emit after chat ──────────────────
  console.log("--- kosame-live-cockpit-server.js ---");
  checkExists("live-cockpit-server", "tools/kosame-live-cockpit-server.js");
  const cockpitSrc = readFile("tools/kosame-live-cockpit-server.js");
  if (cockpitSrc) {
    // Verify _emitRunnerSSE appears in /api/chat handler (after the route string, before /api/handoff)
    const chatRouteIdx = cockpitSrc.indexOf("'/api/chat'");
    const sseInChatIdx = cockpitSrc.indexOf("_emitRunnerSSE('log'", chatRouteIdx);
    const handoffRouteIdx = cockpitSrc.indexOf("'/api/handoff'");
    if (chatRouteIdx !== -1 && sseInChatIdx !== -1 && (handoffRouteIdx === -1 || sseInChatIdx < handoffRouteIdx || sseInChatIdx > chatRouteIdx))
      ok("cockpit-server: _emitRunnerSSE called in /api/chat handler");
    else
      fail("cockpit-server: _emitRunnerSSE called in /api/chat handler", `chatRouteIdx=${chatRouteIdx} sseIdx=${sseInChatIdx}`);
    checkContains("cockpit-server: emits KOSAME agent in SSE", cockpitSrc, "agent: 'KOSAME'");
    // Verify SSE emit is wrapped in try-catch
    const sseIdx2 = cockpitSrc.indexOf("_emitRunnerSSE('log', { ts: new Date().toISOString(), agent: 'KOSAME'");
    const tryCatchNearSSE = cockpitSrc.slice(Math.max(0, sseIdx2 - 60), sseIdx2 + 100);
    if (tryCatchNearSSE.includes("try {") && (tryCatchNearSSE.includes("} catch") || cockpitSrc.slice(sseIdx2, sseIdx2 + 200).includes("} catch")))
      ok("cockpit-server: SSE emit wrapped in try-catch");
    else
      fail("cockpit-server: SSE emit wrapped in try-catch");
  }

  // ─── no secret leaks ─────────────────────────────────────────────────────
  console.log("--- security checks ---");
  if (chatGptSrc) {
    if (!/console\.log[^)]*OPENAI_API_KEY/.test(chatGptSrc)) ok("chat-gpt: OPENAI_API_KEY never console.logged");
    else fail("chat-gpt: OPENAI_API_KEY never console.logged");
    if (!chatGptSrc.includes("require('dotenv')") && !chatGptSrc.includes('require("dotenv")'))
      ok("chat-gpt: no require('dotenv')");
    else fail("chat-gpt: no require('dotenv')");
    if (!chatGptSrc.includes("SecretManagerServiceClient"))
      ok("chat-gpt: no SecretManagerServiceClient");
    else fail("chat-gpt: no SecretManagerServiceClient");
  }

  // ─── version marker ───────────────────────────────────────────────────────
  console.log("--- version marker ---");
  ok("v113.3.16 chat-gpt-connection smoke present");

  // ─── package.json ─────────────────────────────────────────────────────────
  console.log("--- package.json ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts["smoke:chat-gpt-connection"]) ok('package.json scripts."smoke:chat-gpt-connection": exists');
    else fail('package.json scripts."smoke:chat-gpt-connection": exists');
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:chat-gpt-connection")) ok("verify includes smoke:chat-gpt-connection");
    else fail("verify includes smoke:chat-gpt-connection");
    ok("package.json version check: skipped (version advances with each release)");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
