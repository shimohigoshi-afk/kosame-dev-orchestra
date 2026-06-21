"use strict";

// Smoke test for v113.3.14 bug verification.
// Verifies B4: unknown task kind is now blocked (humanApprovalRequired: true).
// Does NOT execute HTTP requests against a live server.
// Does NOT read secrets. Does NOT deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`); failed++; }

async function main() {
  console.log("===== v113-3-14-bug-verification smoke =====");
  console.log("Verifies B4: unknown kind → blocked: true, humanApprovalRequired: true");
  console.log("");

  // ─── B4: unknown kind now blocked ────────────────────────────────────────────
  console.log("--- B4: pm-agent.js unknown kind Safety Stop ---");
  try {
    const pmAgent = require(path.join(ROOT, "apps/pm-agent/pm-agent.js"));

    const unknownKinds = ["hoge", "fuga", "unrecognised_kind", ""];
    for (const kind of unknownKinds) {
      const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
      if (d.blocked === true) ok(`B4: unknown kind "${kind}" → blocked: true`);
      else fail(`B4: unknown kind "${kind}" → blocked: true`, `got ${d.blocked}`);
      if (d.humanApprovalRequired === true) ok(`B4: unknown kind "${kind}" → humanApprovalRequired: true`);
      else fail(`B4: unknown kind "${kind}" → humanApprovalRequired: true`, `got ${d.humanApprovalRequired}`);
      if (d.dryRun === true) ok(`B4: unknown kind "${kind}" → dryRun: true`);
      else fail(`B4: unknown kind "${kind}" → dryRun: true`, `got ${d.dryRun}`);
    }

    // Known safe kinds must remain unblocked
    const safeKinds = ["implementation", "docs", "test", "smoke"];
    for (const kind of safeKinds) {
      const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
      if (d.blocked === false) ok(`B4: known kind "${kind}" still unblocked`);
      else fail(`B4: known kind "${kind}" still unblocked`, `got blocked=${d.blocked} (regression)`);
    }

    // Dangerous kinds must remain blocked
    const dangerKinds = ["deploy", "secret", "billing", "production_mutation"];
    for (const kind of dangerKinds) {
      const d = pmAgent.decideTaskRoute({ id: "T", title: "t", kind, riskLevel: "low" });
      if (d.blocked === true && d.humanApprovalRequired === true) ok(`B4: dangerous kind "${kind}" still blocked`);
      else fail(`B4: dangerous kind "${kind}" still blocked`, JSON.stringify(d));
    }
  } catch (e) { fail("B4: pm-agent.js runtime", e.message); }

  // ─── version marker ──────────────────────────────────────────────────────────
  console.log("--- version marker ---");
  ok("v113.3.14 bug-verification smoke present");

  // ─── package.json scripts ────────────────────────────────────────────────────
  console.log("--- package.json script checks ---");
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    ok("package.json: parses as JSON");
  } catch (e) { fail("package.json: parses as JSON", e.message); }

  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts["smoke:bug-verification"]) ok('package.json scripts."smoke:bug-verification": exists');
    else fail('package.json scripts."smoke:bug-verification": exists');
    const verify = scripts["verify"] || "";
    if (verify.includes("smoke:bug-verification")) ok("verify includes smoke:bug-verification");
    else fail("verify includes smoke:bug-verification");
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("smoke fatal error:", e); process.exit(1); });
