"use strict";

// KOSAME Cloud Run PM Agent — HTTP dry-run intake (v0.2.1)
// - Node standard http module only. No external dependencies.
// - No fetch. No dotenv. No Secret Manager. No deploy.
// - All responses are application/json.
// - POST /dry-run-task always runs dryRun: true — no external API calls.

const http = require("http");
const path = require("path");
const { getPmAgentInfo, decideTaskRoute } = require(path.resolve(__dirname, "pm-agent.js"));
const { validateTaskPacket, createSampleTaskPacket } = require(path.resolve(__dirname, "task-packet-schema.js"));

const DEFAULT_PORT = 8080;
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("Request body too large (max 1MB)"));
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function handleRequest(req, res) {
  const url = (req.url || "/").split("?")[0];
  const method = req.method || "GET";

  // GET /health
  if (url === "/health") {
    if (method !== "GET") {
      return sendJson(res, 405, { success: false, error: "Method Not Allowed", allowed: ["GET"] });
    }
    return sendJson(res, 200, {
      status: "ok",
      service: "KOSAME Cloud Run PM Agent",
      version: "v0.2.1",
      mode: "http-dry-run-intake",
    });
  }

  // GET /info
  if (url === "/info") {
    if (method !== "GET") {
      return sendJson(res, 405, { success: false, error: "Method Not Allowed", allowed: ["GET"] });
    }
    const info = getPmAgentInfo();
    return sendJson(res, 200, Object.assign({}, info, {
      httpInterface: {
        endpoints: ["GET /health", "GET /info", "POST /dry-run-task"],
        bodyFormat: "application/json",
        maxBodySize: "1MB",
      },
      deployStatus: "not-deployed",
      dryRunOnly: true,
    }));
  }

  // POST /dry-run-task
  if (url === "/dry-run-task") {
    if (method !== "POST") {
      return sendJson(res, 405, { success: false, error: "Method Not Allowed", allowed: ["POST"] });
    }
    readBody(req)
      .then((rawBody) => {
        let taskPacket;
        try {
          taskPacket = JSON.parse(rawBody);
        } catch (e) {
          return sendJson(res, 400, {
            success: false,
            dryRun: true,
            error: "Invalid JSON",
            detail: e.message,
          });
        }

        const validation = validateTaskPacket(taskPacket);
        if (!validation.valid) {
          return sendJson(res, 200, {
            success: false,
            dryRun: true,
            validation,
            decision: null,
          });
        }

        const decision = decideTaskRoute(taskPacket);
        return sendJson(res, 200, {
          success: true,
          dryRun: true,
          validation,
          decision,
        });
      })
      .catch((e) => {
        sendJson(res, 400, {
          success: false,
          dryRun: true,
          error: e.message,
        });
      });
    return;
  }

  // 404 for all other routes
  return sendJson(res, 404, { success: false, error: "Not Found", path: url });
}

function createServer() {
  return http.createServer(handleRequest);
}

function startServer(port) {
  const resolvedPort =
    port ||
    (Number.isFinite(parseInt(process.env.PORT, 10))
      ? parseInt(process.env.PORT, 10)
      : DEFAULT_PORT);
  const server = createServer();
  server.listen(resolvedPort, () => {
    console.log(`KOSAME Cloud Run PM Agent HTTP server listening on port ${resolvedPort}`);
    console.log("mode: http-dry-run-intake | dryRunOnly: true | no external API | not deployed");
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createServer, startServer, handleRequest };
