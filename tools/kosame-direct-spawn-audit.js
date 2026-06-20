#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SCAN_FILES = [
  'tools/kosame-codex-dispatch-watcher.js',
  'tools/kosame-auto-responder-gateway.js',
  'tools/kosame-executor-policy-kernel.js',
  'tools/kosame-executor-registry.js',
  'tools/kosame-forbidden-prompt-firewall.js',
  'tools/kosame-prompt-classifier.js',
  'tools/kosame-safety-stop-detector.js',
  'tools/kosame-work-order-result-store.js',
  'tools/kosame-work-order-result-decision.js',
  'tools/kosame-cockpit-chat-server.js',
  'tools/kosame-live-cockpit-server.js',
];

const VIOLATION_PATTERNS = [
  { label: 'spawn', regex: /\b(?:child_process\.)?(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(/ },
  { label: 'shell true', regex: /\bshell\s*:\s*true\b/ },
  { label: 'stdio inherit', regex: /\bstdio\s*:\s*['"]inherit['"]/ },
  { label: 'process.stdin', regex: /\bprocess\.stdin\.(?:on|resume)\b/ },
  { label: 'readline stdin', regex: /readline\.createInterface\s*\([^)]*process\.stdin/ },
  { label: 'inquirer', regex: /\binquirer\b/ },
];

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.kosame-handoff') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function shouldScan(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  return DEFAULT_SCAN_FILES.includes(rel) || rel === 'tools/kosame-direct-spawn-audit.js';
}

function isActualSpawnLine(line) {
  return /\b(?:child_process\.)?(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(/.test(line)
    || /\bshell\s*:\s*true\b/.test(line)
    || /\bstdio\s*:\s*['"]inherit['"]/.test(line)
    || /\bprocess\.stdin\.(?:on|resume)\b/.test(line)
    || /readline\.createInterface\s*\([^)]*process\.stdin/.test(line)
    || /\binquirer\b/.test(line);
}

function lineHasRawExecutor(line) {
  return /\bclaude\b/i.test(line) || /\bcodex\b/i.test(line);
}

function isSafeExecutorLine(line) {
  return /\bclaude\b/i.test(line) && /--dangerously-skip-permissions/.test(line) && /\s-p\b/.test(line);
}

function scanText(rel, text) {
  const violations = [];
  const allowedMatches = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isActualSpawnLine(line)) continue;

    if (lineHasRawExecutor(line) && !isSafeExecutorLine(line)) {
      violations.push({ file: rel, label: 'raw executor', line: index + 1, reason: `unsafe executor line: ${line.trim()}` });
      continue;
    }

    for (const pattern of VIOLATION_PATTERNS) {
      if (!pattern.regex.test(line)) continue;
      if (pattern.label === 'spawn') continue;
      if (pattern.label === 'stdio inherit' && !lineHasRawExecutor(line)) continue;
      if ((pattern.label === 'process.stdin' || pattern.label === 'readline stdin' || pattern.label === 'inquirer') && !lineHasRawExecutor(line)) continue;
      violations.push({ file: rel, label: pattern.label, line: index + 1, reason: `matched ${pattern.label}` });
    }
  }
  return { violations, allowedMatches };
}

function runDirectSpawnAudit(options = {}) {
  const files = (options.files && options.files.length ? options.files : walk(ROOT).filter(shouldScan)).slice(0, 200);
  const violations = [];
  const allowedMatches = [];
  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const text = fs.readFileSync(filePath, 'utf8');
    const result = scanText(rel, text);
    violations.push(...result.violations);
    allowedMatches.push(...result.allowedMatches);
  }
  return {
    pass: violations.length === 0,
    violations,
    allowedMatches,
    blockedPatterns: VIOLATION_PATTERNS.map((item) => item.label),
  };
}

module.exports = {
  runDirectSpawnAudit,
  VIOLATION_PATTERNS,
};
