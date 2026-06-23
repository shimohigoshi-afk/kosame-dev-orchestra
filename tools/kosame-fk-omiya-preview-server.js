#!/usr/bin/env node
'use strict';

// FK Omiya Console — Public Preview Server
// Serves ONLY public/fk-omiya-console.html and static assets under public/.
// No secrets, no .env, no internal tools are ever served.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

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

function serveFile(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
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
  });
}

if (require.main === module) {
  main();
}

module.exports = { createPreviewServer };
