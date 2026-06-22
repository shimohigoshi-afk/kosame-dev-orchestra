#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runDirectSpawnAudit } = require('./kosame-direct-spawn-audit');

const ROOT = path.resolve(__dirname, '..');

function readPackageScripts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.scripts || {};
}

function runStartupAudit(options = {}) {
  const scripts = readPackageScripts();
  const batPath = path.join(ROOT, 'KOSAME.bat');
  const batText = fs.existsSync(batPath) ? fs.readFileSync(batPath, 'utf8') : '';
  const directSpawn = runDirectSpawnAudit(options);
  const violations = [];
  if (!fs.existsSync(batPath)) violations.push({ file: 'KOSAME.bat', reason: 'missing startup launcher' });
  if (!/cockpit:server/.test(batText)) violations.push({ file: 'KOSAME.bat', reason: 'missing cockpit server launch' });
  if (!/runner:watch|codex:watch/.test(batText)) violations.push({ file: 'KOSAME.bat', reason: 'missing watcher launch' });
  if (!/browse|browser|start\s+http|open/i.test(batText)) violations.push({ file: 'KOSAME.bat', reason: 'missing browser launch hint' });
  if (/Claude Code対話窓|Codex Code対話窓/.test(batText)) violations.push({ file: 'KOSAME.bat', reason: 'interactive code UI must not be launched' });
  if (!scripts['cockpit:server']) violations.push({ file: 'package.json', reason: 'missing cockpit:server script' });
  if (!scripts['codex:watch'] && !scripts['runner:watch']) violations.push({ file: 'package.json', reason: 'missing runner watcher script' });
  if (!scripts.verify || !scripts.verify.includes('smoke:v113-2-0')) violations.push({ file: 'package.json', reason: 'verify missing v113.2.0 smoke' });
  if (directSpawn.violations.length) violations.push(...directSpawn.violations);
  return {
    pass: violations.length === 0,
    violations,
    scripts,
    batExists: fs.existsSync(batPath),
    directSpawn,
    repoPath: ROOT,
  };
}

module.exports = {
  runStartupAudit,
};
