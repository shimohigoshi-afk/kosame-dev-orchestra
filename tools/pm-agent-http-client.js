"use strict";

// KOSAME Cloud Run PM Agent — local HTTP client (v0.2.2)
// - Node standard http/https modules only. No external dependencies.
// - No fetch. No dotenv. No Secret Manager. No deploy.
// - Can be used against local server or Cloud Run URL (when available).
// Run: node tools/pm-agent-http-client.js [baseUrl]

const http = require("http");
const https = require("https");

const DEFAULT_BASE_URL = "http://127.0.0.1:8080";

// Minimal inline demo task — no external import needed.
const DEMO_TASK = {
  id: "DEMO-client-001",
  title: "Local client demo task",
  kind: "implementation",
  riskLevel: "low",
  targetRepo: "kosame-dev-orchestra",
  context: "Local client demo — no external API called, no Secret read",
};

function _parseBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const defaultPort = url.protocol === "https:" ? 443 : 80;
  const port = url.port ? parseInt(url.port, 10) : defaultPort;
  return { protocol: url.protocol, hostname: url.hostname, port };
}

/**
 * requestJson({ method, baseUrl, path, body })
 * Returns Promise<{ status, body }>
 */
function requestJson(options) {
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const { protocol, hostname, port } = _parseBaseUrl(baseUrl);
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getHealth(baseUrl) {
  return requestJson({ method: "GET", baseUrl: baseUrl || DEFAULT_BASE_URL, path: "/health" });
}

function getInfo(baseUrl) {
  return requestJson({ method: "GET", baseUrl: baseUrl || DEFAULT_BASE_URL, path: "/info" });
}

function postDryRunTask(baseUrl, taskPacket) {
  return requestJson({
    method: "POST",
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    path: "/dry-run-task",
    body: taskPacket,
  });
}

async function runLocalClientDemo(baseUrl) {
  const resolvedUrl = baseUrl || DEFAULT_BASE_URL;
  console.log(`===== PM Agent HTTP Client Demo =====`);
  console.log(`target: ${resolvedUrl}`);
  console.log("note: dry-run only — no external API called, no Secret read");
  console.log("");

  const health = await getHealth(resolvedUrl);
  console.log("GET /health:", JSON.stringify(health, null, 2));

  const info = await getInfo(resolvedUrl);
  console.log("GET /info:", JSON.stringify(info, null, 2));

  const dryRun = await postDryRunTask(resolvedUrl, DEMO_TASK);
  console.log("POST /dry-run-task (demo):", JSON.stringify(dryRun, null, 2));

  console.log("===== end =====");
  return { health, info, dryRun };
}

if (require.main === module) {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  runLocalClientDemo(baseUrl).catch((e) => {
    console.error("client error:", e.message);
    process.exit(1);
  });
}

module.exports = { requestJson, getHealth, getInfo, postDryRunTask, runLocalClientDemo };
