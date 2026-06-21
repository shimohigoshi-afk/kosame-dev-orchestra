"use strict";

// Smoke test for No-User-Work contract v113.3.13
// Statically verifies kosame-kill-switch.js contains no patterns that force user manual work:
//   1. copy-paste requests
//   2. YES/Y/y input gates
//   3. paste-back-result requests
//   4. wait_for_user / human_wait outside Safety Stop context
// Does NOT execute any provider. Does NOT read secrets. Does NOT deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`); failed++; }

// ── Forbidden pattern sets ────────────────────────────────────────────────────

const COPY_PASTE_PATTERNS = [
  "コピペ", "コピー&ペースト", "コピー＆ペースト",
  "貼り付けてください", "コピーして貼り付け",
  "copy and paste", "please paste", "paste this", "paste the following",
];

const YES_INPUT_PATTERNS = [
  "YESと入力", "yesと入力", "「YES」と入力", "「はい」と入力",
  "type YES", "enter YES", "type Y to", "press Y to",
  "y/n", "Y/N", "はい/いいえ",
];

const PASTE_BACK_PATTERNS = [
  "貼り戻し", "結果を貼り付け", "出力を貼り付け", "結果を貼って",
  "paste back", "paste the result", "paste the output", "paste it back",
];

const WAIT_TRIGGERS = ["wait_for_user", "human_wait"];
const SAFETY_STOP_MARKERS = ["SafetyStop", "safety_stop", "safetyStop", "Safety Stop", "SAFETY_STOP", "isSafetyStop"];
const WAIT_CONTEXT_WINDOW = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), "utf8"); }
  catch (e) { return null; }
}

function checkExists(label, relPath) {
  if (fs.existsSync(path.join(ROOT, relPath))) { ok(`${label}: exists`); return true; }
  fail(`${label}: exists`, `not found at ${relPath}`); return false;
}

function checkNoneOf(fileLabel, relPath, patterns, category) {
  const content = readFile(relPath);
  if (content === null) { fail(`${fileLabel} [${category}]: file readable`); return; }
  for (const pattern of patterns) {
    const label = `${fileLabel} [${category}] no "${pattern}"`;
    if (content.includes(pattern)) fail(label, "forbidden pattern found");
    else ok(label);
  }
}

function checkWaitContextual(fileLabel, relPath) {
  const content = readFile(relPath);
  if (content === null) { fail(`${fileLabel} [wait-gate]: file readable`); return; }
  const lines = content.split("\n");
  let foundAny = false;
  for (let i = 0; i < lines.length; i++) {
    for (const trigger of WAIT_TRIGGERS) {
      if (!lines[i].includes(trigger)) continue;
      foundAny = true;
      const start = Math.max(0, i - WAIT_CONTEXT_WINDOW);
      const end   = Math.min(lines.length - 1, i + WAIT_CONTEXT_WINDOW);
      const ctx   = lines.slice(start, end + 1).join("\n");
      const inStop = SAFETY_STOP_MARKERS.some(m => ctx.includes(m));
      const label = `${fileLabel} [wait-gate] "${trigger}" at line ${i + 1} in Safety Stop context`;
      if (inStop) ok(label);
      else fail(label, `"${trigger}" outside Safety Stop context`);
    }
  }
  if (!foundAny) ok(`${fileLabel} [wait-gate]: no wait_for_user / human_wait present`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("===== v113-3-13-no-user-work smoke =====");
  console.log("Target: tools/kosame-kill-switch.js");
  console.log("");

  const TARGET = { label: "kosame-kill-switch", relPath: "tools/kosame-kill-switch.js" };

  console.log("--- file existence ---");
  const exists = checkExists(TARGET.label, TARGET.relPath);

  if (exists) {
    console.log("--- copy-paste pattern checks ---");
    checkNoneOf(TARGET.label, TARGET.relPath, COPY_PASTE_PATTERNS, "copy-paste");

    console.log("--- yes-input pattern checks ---");
    checkNoneOf(TARGET.label, TARGET.relPath, YES_INPUT_PATTERNS, "yes-input");

    console.log("--- paste-back pattern checks ---");
    checkNoneOf(TARGET.label, TARGET.relPath, PASTE_BACK_PATTERNS, "paste-back");

    console.log("--- wait-for-user / human_wait checks ---");
    checkWaitContextual(TARGET.label, TARGET.relPath);
  }

  // package.json script checks
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts["smoke:no-user-work"]) ok('package.json scripts."smoke:no-user-work": exists');
    else fail('package.json scripts."smoke:no-user-work": exists');
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:no-user-work")) ok("verify includes smoke:no-user-work");
    else fail("verify includes smoke:no-user-work");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
