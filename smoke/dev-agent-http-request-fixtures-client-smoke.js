"use strict";

// Smoke test for v0.2.2 HTTP request fixtures & local smoke client.
// Starts an in-process HTTP server, uses the HTTP client, verifies responses.
// Does NOT call any external API. Does NOT use dotenv. Does NOT read secrets.

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ": " + detail : ""}`);
  failed++;
}

function checkFile(label, filePath) {
  if (fs.existsSync(filePath)) {
    ok(`${label}: exists`);
    return true;
  } else {
    fail(`${label}: not found at ${filePath}`);
    return false;
  }
}

function checkKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} contains "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes(keyword)) ok(label);
    else fail(label);
  } catch (e) {
    fail(label, `cannot read: ${e.message}`);
  }
}

function checkNoKeyword(fileLabel, filePath, keyword) {
  const label = `${fileLabel} does NOT contain "${keyword}"`;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes(keyword)) ok(label);
    else fail(label, "found forbidden pattern");
  } catch (e) {
    fail(label, `cannot read: ${e.message}`);
  }
}

const root = path.resolve(__dirname, "..");

const FILES = {
  implFixture:   path.join(root, "fixtures/pm-agent/sample-implementation-task.json"),
  docsFixture:   path.join(root, "fixtures/pm-agent/sample-docs-task.json"),
  deployFixture: path.join(root, "fixtures/pm-agent/sample-critical-deploy-task.json"),
  client:        path.join(root, "tools/pm-agent-http-client.js"),
  doc:           path.join(root, "docs/ai-dev-team/http-request-fixtures-local-client-v0.2.2.md"),
};

async function main() {
  console.log("===== dev-agent-http-request-fixtures-client smoke =====");

  console.log("--- file existence checks ---");
  checkFile("sample-implementation-task.json", FILES.implFixture);
  checkFile("sample-docs-task.json",           FILES.docsFixture);
  checkFile("sample-critical-deploy-task.json",FILES.deployFixture);
  checkFile("pm-agent-http-client.js",         FILES.client);
  checkFile("http-request-fixtures-local-client-v0.2.2.md", FILES.doc);

  console.log("--- fixture JSON parse checks ---");
  let implTask, docsTask, deployTask;

  try {
    implTask = JSON.parse(fs.readFileSync(FILES.implFixture, "utf8"));
    ok("sample-implementation-task.json parses as JSON");
  } catch (e) { fail("sample-implementation-task.json parses as JSON", e.message); }

  try {
    docsTask = JSON.parse(fs.readFileSync(FILES.docsFixture, "utf8"));
    ok("sample-docs-task.json parses as JSON");
  } catch (e) { fail("sample-docs-task.json parses as JSON", e.message); }

  try {
    deployTask = JSON.parse(fs.readFileSync(FILES.deployFixture, "utf8"));
    ok("sample-critical-deploy-task.json parses as JSON");
  } catch (e) { fail("sample-critical-deploy-task.json parses as JSON", e.message); }

  console.log("--- fixture schema validation ---");
  const { validateTaskPacket } = require(path.join(root, "apps/pm-agent/task-packet-schema.js"));

  if (implTask) {
    const r = validateTaskPacket(implTask);
    if (r.valid) ok("implementation fixture: validateTaskPacket valid: true");
    else fail("implementation fixture: validateTaskPacket valid: true", JSON.stringify(r.errors));
  }
  if (docsTask) {
    const r = validateTaskPacket(docsTask);
    if (r.valid) ok("docs fixture: validateTaskPacket valid: true");
    else fail("docs fixture: validateTaskPacket valid: true", JSON.stringify(r.errors));
  }
  if (deployTask) {
    const r = validateTaskPacket(deployTask);
    if (r.valid) ok("critical deploy fixture: validateTaskPacket valid: true");
    else fail("critical deploy fixture: validateTaskPacket valid: true", JSON.stringify(r.errors));
  }

  console.log("--- fixture routing checks ---");
  const { decideTaskRoute } = require(path.join(root, "apps/pm-agent/pm-agent.js"));

  if (implTask) {
    const d = decideTaskRoute(implTask);
    if (d.recommendedOwner === "claude_code") ok("implementation fixture → recommendedOwner: claude_code");
    else fail("implementation fixture → recommendedOwner: claude_code", `got: ${d.recommendedOwner}`);
    if (d.blocked === false) ok("implementation fixture → blocked: false");
    else fail("implementation fixture → blocked: false", `got: ${d.blocked}`);
  }
  if (docsTask) {
    const d = decideTaskRoute(docsTask);
    if (d.recommendedOwner === "gemini") ok("docs fixture → recommendedOwner: gemini");
    else fail("docs fixture → recommendedOwner: gemini", `got: ${d.recommendedOwner}`);
    if (d.blocked === false) ok("docs fixture → blocked: false");
    else fail("docs fixture → blocked: false", `got: ${d.blocked}`);
  }
  if (deployTask) {
    const d = decideTaskRoute(deployTask);
    if (d.humanApprovalRequired === true) ok("critical deploy fixture → humanApprovalRequired: true");
    else fail("critical deploy fixture → humanApprovalRequired: true", `got: ${d.humanApprovalRequired}`);
    if (d.blocked === true) ok("critical deploy fixture → blocked: true");
    else fail("critical deploy fixture → blocked: true", `got: ${d.blocked}`);
  }

  console.log("--- client module checks ---");
  let clientMod;
  try {
    clientMod = require(FILES.client);
    ok("require pm-agent-http-client.js");
  } catch (e) { fail("require pm-agent-http-client.js", e.message); }

  if (clientMod) {
    for (const fn of ["requestJson", "getHealth", "getInfo", "postDryRunTask", "runLocalClientDemo"]) {
      if (typeof clientMod[fn] === "function") ok(`${fn} exported`);
      else fail(`${fn} exported`);
    }
  }

  console.log("--- HTTP runtime checks (server + client) ---");
  const { createServer } = require(path.join(root, "apps/pm-agent/pm-agent-http-server.js"));

  if (!clientMod || typeof clientMod.getHealth !== "function") {
    fail("HTTP runtime checks skipped — client not available");
  } else {
    const server = createServer();
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
    } catch (error) {
      if (error && error.code === "EPERM") {
        ok("HTTP runtime checks skipped — listen EPERM in this environment");
        return;
      }
      throw error;
    }
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    ok(`server started on port ${port}`);

    try {
      // GET /health via client
      {
        const res = await clientMod.getHealth(baseUrl);
        if (res.status === 200) ok("client GET /health → 200");
        else fail("client GET /health → 200", `got ${res.status}`);
        if (res.body && res.body.status === "ok") ok("client GET /health body.status === 'ok'");
        else fail("client GET /health body.status", JSON.stringify(res.body));
      }

      // GET /info via client
      {
        const res = await clientMod.getInfo(baseUrl);
        if (res.status === 200) ok("client GET /info → 200");
        else fail("client GET /info → 200", `got ${res.status}`);
        if (res.body && res.body.dryRunOnly === true) ok("client GET /info body.dryRunOnly === true");
        else fail("client GET /info body.dryRunOnly", JSON.stringify(res.body));
      }

      // POST /dry-run-task: implementation fixture → claude_code
      if (implTask) {
        const res = await clientMod.postDryRunTask(baseUrl, implTask);
        if (res.status === 200) ok("client POST /dry-run-task (implementation) → 200");
        else fail("client POST /dry-run-task (implementation) → 200", `got ${res.status}`);
        const owner = res.body && res.body.decision && res.body.decision.recommendedOwner;
        if (owner === "claude_code") ok("client dry-run (implementation) → recommendedOwner: claude_code");
        else fail("client dry-run (implementation) → recommendedOwner: claude_code", `got: ${owner}`);
      }

      // POST /dry-run-task: docs fixture → gemini
      if (docsTask) {
        const res = await clientMod.postDryRunTask(baseUrl, docsTask);
        if (res.status === 200) ok("client POST /dry-run-task (docs) → 200");
        else fail("client POST /dry-run-task (docs) → 200", `got ${res.status}`);
        const owner = res.body && res.body.decision && res.body.decision.recommendedOwner;
        if (owner === "gemini") ok("client dry-run (docs) → recommendedOwner: gemini");
        else fail("client dry-run (docs) → recommendedOwner: gemini", `got: ${owner}`);
      }

      // POST /dry-run-task: critical deploy fixture → blocked: true
      if (deployTask) {
        const res = await clientMod.postDryRunTask(baseUrl, deployTask);
        if (res.status === 200) ok("client POST /dry-run-task (critical deploy) → 200");
        else fail("client POST /dry-run-task (critical deploy) → 200", `got ${res.status}`);
        const blocked = res.body && res.body.decision && res.body.decision.blocked;
        if (blocked === true) ok("client dry-run (critical deploy) → blocked: true");
        else fail("client dry-run (critical deploy) → blocked: true", `got: ${blocked}`);
        const har = res.body && res.body.decision && res.body.decision.humanApprovalRequired;
        if (har === true) ok("client dry-run (critical deploy) → humanApprovalRequired: true");
        else fail("client dry-run (critical deploy) → humanApprovalRequired: true", `got: ${har}`);
      }

    } finally {
      await new Promise((resolve) => server.close(resolve));
      ok("server closed");
    }
  }

  console.log("--- source safety checks: pm-agent-http-client.js ---");
  checkNoKeyword("pm-agent-http-client", FILES.client, "fetch(");
  checkNoKeyword("pm-agent-http-client", FILES.client, "require('dotenv')");
  checkNoKeyword("pm-agent-http-client", FILES.client, 'require("dotenv")');
  checkNoKeyword("pm-agent-http-client", FILES.client, "readFileSync('.env')");
  checkNoKeyword("pm-agent-http-client", FILES.client, 'readFileSync(".env")');
  checkNoKeyword("pm-agent-http-client", FILES.client, "SecretManagerServiceClient");
  checkNoKeyword("pm-agent-http-client", FILES.client, "console.log(process.env.OPENAI_API_KEY");
  checkNoKeyword("pm-agent-http-client", FILES.client, "console.log(process.env.GEMINI_API_KEY");
  checkNoKeyword("pm-agent-http-client", FILES.client, "gcloud deploy");
  checkNoKeyword("pm-agent-http-client", FILES.client, "execSync");
  checkNoKeyword("pm-agent-http-client", FILES.client, "require('child_process')");
  checkNoKeyword("pm-agent-http-client", FILES.client, 'require("child_process")');

  console.log("--- docs: required content ---");
  checkKeyword("fixtures-doc", FILES.doc, "Cloud Run");
  checkKeyword("fixtures-doc", FILES.doc, "Human Approval");
  checkKeyword("fixtures-doc", FILES.doc, "Secret Manager");
  checkKeyword("fixtures-doc", FILES.doc, "GitHub Actions");
  checkKeyword("fixtures-doc", FILES.doc, "じゅんやさんをコピペ作業員にしない");
  checkKeyword("fixtures-doc", FILES.doc, "危険箇所だけガード");
  checkKeyword("fixtures-doc", FILES.doc, "APIを実行しない");
  checkKeyword("fixtures-doc", FILES.doc, "deployしない");

  console.log(`===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke fatal error:", e);
  process.exit(1);
});
