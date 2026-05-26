"use strict";

// KOSAME Cloud Run PM Agent — Post-Deploy Smoke (v0.2.3)
// - Node standard http/https only. No fetch. No dotenv. No Secret Manager.
// - Accepts a baseUrl (local or Cloud Run URL) and runs smoke checks.
// - In v0.2.3: only used against local server. Cloud Run URL requires Human Approval.

const http = require("http");
const https = require("https");
const path = require("path");

const DEFAULT_BASE_URL = "http://127.0.0.1:8080";

const DEMO_TASK = {
  id: "SMOKE-post-deploy-001",
  title: "Post-deploy smoke task",
  kind: "implementation",
  riskLevel: "low",
  targetRepo: "kosame-dev-orchestra",
  context: "Post-deploy smoke — no external API called, no Secret read",
};

const CRITICAL_TASK = {
  id: "SMOKE-post-deploy-002",
  title: "Critical deploy smoke task",
  kind: "deploy",
  riskLevel: "critical",
  targetRepo: "kosame-dev-orchestra",
  context: "Post-deploy smoke — critical deploy fixture — must be blocked",
};

function validateServiceUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== "string") {
    return { valid: false, error: "baseUrl must be a non-empty string" };
  }
  try {
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { valid: false, error: `Unsupported protocol: ${url.protocol}` };
    }
    return { valid: true, url };
  } catch (e) {
    return { valid: false, error: `Invalid URL: ${e.message}` };
  }
}

function _requestJson(options) {
  const { protocol, hostname, port } = _parseBaseUrl(options.baseUrl);
  const mod = protocol === "https:" ? https : http;
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : "";
  const reqOptions = {
    hostname,
    port,
    path: options.path || "/",
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
    },
  };
  return new Promise((resolve, reject) => {
    const req = mod.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function _parseBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const defaultPort = url.protocol === "https:" ? 443 : 80;
  const port = url.port ? parseInt(url.port, 10) : defaultPort;
  return { protocol: url.protocol, hostname: url.hostname, port };
}

async function runPostDeploySmoke(baseUrl) {
  const resolvedUrl = baseUrl || DEFAULT_BASE_URL;
  const validation = validateServiceUrl(resolvedUrl);
  if (!validation.valid) {
    return {
      success: false,
      dryRun: true,
      baseUrl: resolvedUrl,
      error: validation.error,
      checks: [],
    };
  }

  const checks = [];
  let allPassed = true;

  function pass(name) { checks.push({ name, passed: true }); }
  function fail(name, detail) { checks.push({ name, passed: false, detail }); allPassed = false; }

  // GET /health
  try {
    const r = await _requestJson({ method: "GET", baseUrl: resolvedUrl, path: "/health" });
    if (r.status === 200) pass("GET /health → 200");
    else fail("GET /health → 200", `got ${r.status}`);
    if (r.body && r.body.status === "ok") pass("GET /health body.status === ok");
    else fail("GET /health body.status === ok", JSON.stringify(r.body));
  } catch (e) {
    fail("GET /health → reachable", e.message);
  }

  // GET /info
  try {
    const r = await _requestJson({ method: "GET", baseUrl: resolvedUrl, path: "/info" });
    if (r.status === 200) pass("GET /info → 200");
    else fail("GET /info → 200", `got ${r.status}`);
    if (r.body && r.body.dryRunOnly === true) pass("GET /info body.dryRunOnly === true");
    else fail("GET /info body.dryRunOnly === true", JSON.stringify(r.body));
  } catch (e) {
    fail("GET /info → reachable", e.message);
  }

  // POST /dry-run-task: implementation
  try {
    const r = await _requestJson({ method: "POST", baseUrl: resolvedUrl, path: "/dry-run-task", body: DEMO_TASK });
    if (r.status === 200) pass("POST /dry-run-task (implementation) → 200");
    else fail("POST /dry-run-task (implementation) → 200", `got ${r.status}`);
    if (r.body && r.body.success === true) pass("POST /dry-run-task (implementation) success: true");
    else fail("POST /dry-run-task (implementation) success: true", JSON.stringify(r.body));
    const owner = r.body && r.body.decision && r.body.decision.recommendedOwner;
    if (owner === "claude_code") pass("POST /dry-run-task (implementation) → claude_code");
    else fail("POST /dry-run-task (implementation) → claude_code", `got: ${owner}`);
  } catch (e) {
    fail("POST /dry-run-task (implementation) → reachable", e.message);
  }

  // POST /dry-run-task: critical (must be blocked)
  try {
    const r = await _requestJson({ method: "POST", baseUrl: resolvedUrl, path: "/dry-run-task", body: CRITICAL_TASK });
    if (r.status === 200) pass("POST /dry-run-task (critical) → 200");
    else fail("POST /dry-run-task (critical) → 200", `got ${r.status}`);
    const blocked = r.body && r.body.decision && r.body.decision.blocked;
    if (blocked === true) pass("POST /dry-run-task (critical) → blocked: true");
    else fail("POST /dry-run-task (critical) → blocked: true", `got: ${blocked}`);
  } catch (e) {
    fail("POST /dry-run-task (critical) → reachable", e.message);
  }

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return {
    success: allPassed,
    dryRun: true,
    baseUrl: resolvedUrl,
    checks,
    summary: { total: checks.length, passed, failed },
  };
}

if (require.main === module) {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  console.log(`===== PM Agent Post-Deploy Smoke =====`);
  console.log(`target: ${baseUrl}`);
  console.log("note: dry-run only — no external API called, no Secret read");
  console.log("");
  runPostDeploySmoke(baseUrl)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((e) => {
      console.error("smoke fatal error:", e.message);
      process.exit(1);
    });
}

module.exports = { runPostDeploySmoke, validateServiceUrl };
