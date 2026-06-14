#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { collectLiveCockpitSnapshot } = require('./kosame-live-cockpit-snapshot');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function createLiveCockpitServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8080);
  const host = options.host || '0.0.0.0';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/snapshot') {
      const snapshot = collectLiveCockpitSnapshot({
        activeRepoPath: options.activeRepoPath,
        devRepoPath: options.devRepoPath,
        salesRepoPath: options.salesRepoPath,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    try {
      const html = readHtml();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`KOSAME Live Cockpit HTML not found: ${error.message}`);
    }
  });

  return { server, port, host };
}

function main() {
  const { server, port, host } = createLiveCockpitServer();
  server.listen(port, host, () => {
    console.log(`KOSAME Live Cockpit Readonly Monitor listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createLiveCockpitServer,
};

