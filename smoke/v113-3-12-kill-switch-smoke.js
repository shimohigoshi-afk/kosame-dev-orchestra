"use strict";

// Smoke test for KOSAME Kill Switch v113.3.12
// Verifies kill-switch blocks unauthorized sources and allows authorized ones.
// Does NOT execute actual prompts. Does NOT call external APIs. Does NOT deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`); failed++; }

function checkFile(label, relPath) {
  if (fs.existsSync(path.join(ROOT, relPath))) { ok(`${label}: exists`); return true; }
  fail(`${label}: exists`, `not found at ${relPath}`); return false;
}

function checkContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    if (fs.readFileSync(path.join(ROOT, relPath), "utf8").includes(keyword)) ok(label);
    else fail(label);
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

function checkNotContains(fileLabel, relPath, keyword) {
  const label = `${fileLabel} does NOT contain "${keyword}"`;
  try {
    if (!fs.readFileSync(path.join(ROOT, relPath), "utf8").includes(keyword)) ok(label);
    else fail(label, "found forbidden pattern");
  } catch (e) { fail(label, `cannot read: ${e.message}`); }
}

async function main() {
  console.log("===== v113-3-12-kill-switch smoke =====");

  // --- file existence ---
  console.log("--- file existence checks ---");
  checkFile("tools/kosame-kill-switch.js", "tools/kosame-kill-switch.js");

  // --- module require ---
  console.log("--- module export checks ---");
  let mod;
  try {
    mod = require(path.join(ROOT, "tools/kosame-kill-switch.js"));
    ok("require kosame-kill-switch.js");
  } catch (e) { fail("require kosame-kill-switch.js", e.message); }

  if (mod) {
    for (const fn of ["check", "getLog", "clearLog", "getAllowedSources", "getBlockedSources"]) {
      if (typeof mod[fn] === "function") ok(`mod.${fn}: exported`);
      else fail(`mod.${fn}: exported`);
    }
    if (typeof mod.REDIRECT_MESSAGE === "string" && mod.REDIRECT_MESSAGE.includes("Orchestra")) {
      ok('mod.REDIRECT_MESSAGE: contains "Orchestra"');
    } else {
      fail('mod.REDIRECT_MESSAGE: contains "Orchestra"', `got "${mod.REDIRECT_MESSAGE}"`);
    }

    // --- allowed sources ---
    console.log("--- allowed source checks ---");
    mod.clearLog();
    for (const src of ["orchestra-handoff", "kosame-chat-dispatch", "runtime-contract"]) {
      try {
        const result = mod.check({ source: src });
        if (result.allowed === true) ok(`check({source:"${src}"}) allowed: true`);
        else fail(`check({source:"${src}"}) allowed: true`, `got ${result.allowed}`);
        if (result.message === null || result.message === undefined) ok(`check({source:"${src}"}) message: null`);
        else fail(`check({source:"${src}"}) message: null`, `got "${result.message}"`);
        if (typeof result.timestamp === "string" && result.timestamp.length > 0) ok(`check({source:"${src}"}) timestamp: string`);
        else fail(`check({source:"${src}"}) timestamp: string`);
      } catch (e) { fail(`check({source:"${src}"}): no throw`, e.message); }
    }
    if (mod.getLog().length === 0) ok("getLog(): no entries logged for allowed sources");
    else fail("getLog(): no entries logged for allowed sources", `got ${mod.getLog().length} entries`);

    // --- blocked sources ---
    console.log("--- blocked source checks ---");
    mod.clearLog();
    const blockedSources = [
      "kosame-bat-raw-cli",
      "interactive-claude",
      "auto-responder-bypass",
      "unauthenticated-startup",
      "unknown",
    ];
    for (const src of blockedSources) {
      try {
        const result = mod.check({ source: src });
        if (result.allowed === false) ok(`check({source:"${src}"}) allowed: false`);
        else fail(`check({source:"${src}"}) allowed: false`, `got ${result.allowed}`);
        if (result.message === mod.REDIRECT_MESSAGE) ok(`check({source:"${src}"}) message: REDIRECT_MESSAGE`);
        else fail(`check({source:"${src}"}) message: REDIRECT_MESSAGE`, `got "${result.message}"`);
        if (result.safetyStop === false) ok(`check({source:"${src}"}) safetyStop: false`);
        else fail(`check({source:"${src}"}) safetyStop: false`, `got ${result.safetyStop}`);
        if (result.logEntry && typeof result.logEntry === "object") ok(`check({source:"${src}"}) logEntry: object`);
        else fail(`check({source:"${src}"}) logEntry: object`);
      } catch (e) { fail(`check({source:"${src}"}): no throw`, e.message); }
    }

    const logEntries = mod.getLog();
    if (logEntries.length === blockedSources.length) {
      ok(`getLog(): ${blockedSources.length} entries logged for blocked sources`);
    } else {
      fail(`getLog(): ${blockedSources.length} entries logged for blocked sources`, `got ${logEntries.length}`);
    }
    for (const entry of logEntries) {
      if (entry.safetyStop === false) ok(`log entry safetyStop: false (${entry.source})`);
      else fail(`log entry safetyStop: false (${entry.source})`, `got ${entry.safetyStop}`);
      if (typeof entry.timestamp === "string" && entry.timestamp.length > 0) ok(`log entry timestamp: string (${entry.source})`);
      else fail(`log entry timestamp: string (${entry.source})`);
      if (typeof entry.reason === "string" && entry.reason.length > 0) ok(`log entry reason: string (${entry.source})`);
      else fail(`log entry reason: string (${entry.source})`);
    }

    // --- clearLog ---
    console.log("--- clearLog checks ---");
    mod.clearLog();
    if (mod.getLog().length === 0) ok("clearLog(): log is empty after clear");
    else fail("clearLog(): log is empty after clear", `got ${mod.getLog().length} entries`);

    // --- getAllowedSources / getBlockedSources ---
    console.log("--- source list checks ---");
    const allowedList = mod.getAllowedSources();
    if (Array.isArray(allowedList) && allowedList.length >= 3) ok("getAllowedSources(): array with >= 3 entries");
    else fail("getAllowedSources(): array with >= 3 entries", `got ${JSON.stringify(allowedList)}`);
    for (const src of ["orchestra-handoff", "kosame-chat-dispatch", "runtime-contract"]) {
      if (allowedList.includes(src)) ok(`getAllowedSources() includes "${src}"`);
      else fail(`getAllowedSources() includes "${src}"`);
    }

    const blockedList = mod.getBlockedSources();
    if (Array.isArray(blockedList) && blockedList.length >= 4) ok("getBlockedSources(): array with >= 4 entries");
    else fail("getBlockedSources(): array with >= 4 entries", `got ${JSON.stringify(blockedList)}`);
    for (const src of ["kosame-bat-raw-cli", "interactive-claude", "auto-responder-bypass", "unauthenticated-startup"]) {
      if (blockedList.includes(src)) ok(`getBlockedSources() includes "${src}"`);
      else fail(`getBlockedSources() includes "${src}"`);
    }

    // --- immutability: returned arrays are copies ---
    console.log("--- immutability checks ---");
    const a1 = mod.getAllowedSources();
    a1.push("injected");
    const a2 = mod.getAllowedSources();
    if (!a2.includes("injected")) ok("getAllowedSources(): returns defensive copy");
    else fail("getAllowedSources(): returns defensive copy");

    const b1 = mod.getLog();
    mod.check({ source: "interactive-claude" });
    if (b1.length === 0) ok("getLog(): returned snapshot is not mutated by later calls");
    else fail("getLog(): returned snapshot is not mutated by later calls", `got length ${b1.length}`);
    mod.clearLog();
  }

  // --- source safety ---
  console.log("--- source safety checks ---");
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "child_process");
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "execSync");
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "require('dotenv')");
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", 'require("dotenv")');
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "SecretManagerServiceClient");
  checkNotContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "fetch(");
  checkContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "Orchestra経由で指示してください");
  checkContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "safetyStop: false");
  checkContains("kosame-kill-switch", "tools/kosame-kill-switch.js", "v113.3.12");

  // --- package.json scripts ---
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    for (const s of ["tools:kill-switch", "smoke:kill-switch"]) {
      if (scripts[s]) ok(`package.json scripts.${s}: exists`);
      else fail(`package.json scripts.${s}: exists`);
    }
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:kill-switch")) ok("verify includes smoke:kill-switch");
    else fail("verify includes smoke:kill-switch");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
