#!/usr/bin/env node
'use strict';

// FK Omiya Console — Public Preview Server
// Serves public/ static assets and /api/* transcribe endpoints.
// No secrets, no .env, no raw internal tools are ever served.
//
// Branch preview (fk-omiya-branch-preview-*.html) is protected by
// HTTP Basic Authentication via FK_PREVIEW_USER / FK_PREVIEW_PASS env vars.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let transcribeHandleRequest, handleDevOsRequest;
try { transcribeHandleRequest = require('./kosame-transcribe-api-server').handleRequest; } catch { transcribeHandleRequest = null; }
try { handleDevOsRequest = require('./kosame-dev-os-router').handleDevOsRequest; } catch { handleDevOsRequest = null; }

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(ROOT, 'public');
const FK_OMIYA_HTML = path.join(PUBLIC_DIR, 'fk-omiya-console.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Block list — these filenames are never served even if inside public/
const BLOCKED_FILENAMES = new Set(['.env', '.env.local', '.env.production', 'secrets.json']);

// Basic Auth credentials for branch preview — read from environment only
const PREVIEW_USER = process.env.FK_PREVIEW_USER || '';
const PREVIEW_PASS = process.env.FK_PREVIEW_PASS || '';
const PREVIEW_AUTH_ENABLED = !!(PREVIEW_USER && PREVIEW_PASS);

// Regex that matches branch-preview filenames: fk-omiya-branch-preview-<date>-<token>.html
const BRANCH_PREVIEW_RE = /^\/fk-omiya-branch-preview-.+\.html$/;

function isSafePublicPath(resolved) {
  const rel = path.relative(PUBLIC_DIR, resolved);
  // Must stay inside public/ (no traversal)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const basename = path.basename(resolved);
  if (BLOCKED_FILENAMES.has(basename)) return false;
  // Reject dot-files
  if (basename.startsWith('.')) return false;
  return true;
}

function requireBasicAuth(req, res) {
  if (!PREVIEW_AUTH_ENABLED) return true;

  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return false;

  const user = decoded.slice(0, colon);
  const pass = decoded.slice(colon + 1);
  return user === PREVIEW_USER && pass === PREVIEW_PASS;
}

function respondUnauthorized(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="FK Omiya Branch Preview"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Authorization required');
}

function serveFile(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };

    // Add X-Robots-Tag for all branch preview HTML files
    if (ext === '.html' && BRANCH_PREVIEW_RE.test('/' + path.basename(filePath))) {
      headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
    }

    res.writeHead(200, headers);
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
}

function createPreviewServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Dev OS Router API routes
    if (pathname.startsWith('/api/dev-os') && handleDevOsRequest) {
      return handleDevOsRequest(req, res);
    }

    // Transcribe API routes
    if (pathname.startsWith('/api/') && transcribeHandleRequest) {
      return transcribeHandleRequest(req, res);
    }

    // Health check for Cloud Run
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, service: 'fk-omiya-preview' }));
      return;
    }

    // Root redirect to the demo page
    if (pathname === '/') {
      res.writeHead(302, { Location: '/fk-omiya-console.html' });
      res.end();
      return;
    }

    // Basic Auth for branch preview paths
    if (BRANCH_PREVIEW_RE.test(pathname)) {
      if (!requireBasicAuth(req, res)) {
        respondUnauthorized(res);
        return;
      }
    }

    // Serve static files from public/ only
    const candidate = path.resolve(PUBLIC_DIR, pathname.replace(/^\//, ''));
    if (isSafePublicPath(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      serveFile(res, candidate);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  return server;
}

function main() {
  const port = Number(process.env.PORT || 8081);
  const host = '0.0.0.0';
  const server = createPreviewServer();
  server.listen(port, host, () => {
    console.log(`[FK-OMIYA-PREVIEW] listening on http://${host}:${port}`);
    console.log(`[FK-OMIYA-PREVIEW] Demo page: http://localhost:${port}/fk-omiya-console.html`);
    console.log(`[FK-OMIYA-PREVIEW] Health: http://localhost:${port}/healthz`);
    console.log(`[FK-OMIYA-PREVIEW] Branch preview Basic Auth: ${PREVIEW_AUTH_ENABLED ? 'enabled' : 'disabled (set FK_PREVIEW_USER & FK_PREVIEW_PASS)'}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { createPreviewServer };
