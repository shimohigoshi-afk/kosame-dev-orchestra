#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_LOG_PATHS = [
  path.join(os.tmpdir(), 'codex-output.log'),
  path.join(os.tmpdir(), 'codex.log'),
  path.join(os.homedir(), '.codex', 'session.log'),
  path.join(os.homedir(), '.codex', 'output.log'),
];

const CONFIRMATION_PATTERNS = [
  /would you like to make the following edits\??/i,
  /would you like to apply (?:these|the following) changes?\??/i,
  /apply (?:(?:these|the(?:\s+following)?) )?changes?\??/i,
  /do you want to proceed\??/i,
  /would you like to continue\??/i,
  /please confirm/i,
  /confirm (?:the )?changes?\??/i,
  /make (?:the )?following changes?\??/i,
  /how is claude doing this session\??/i,
];

const CHOICE_PATTERN_GLOBAL = /\[(\d+)\]\s+([^\[\n\r]+?)(?=\[|\n|\r|$)/g;
const YN_PATTERN = /\(y\/n\)/i;

const FILE_PATH_PATTERN = /(?:^|\s|:)([~\/]?(?:[\w.-]+\/)*[\w.-]+\.\w{1,12})(?=\s|$|:|,)/gm;

const EDIT_LINE_PATTERN = /^(?:[-•*]\s+.{3,}|\s{2,}(?:edit|modify|create|delete|update|add|remove|rename)\s+.+)$/gim;

const MAX_TAIL_BYTES = 8192;

function readFileTail(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return null;
    const size = Math.min(stat.size, MAX_TAIL_BYTES);
    const buf = Buffer.alloc(size);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, size, stat.size - size);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function extractChoices(text) {
  const choices = [];
  CHOICE_PATTERN_GLOBAL.lastIndex = 0;
  let m;
  while ((m = CHOICE_PATTERN_GLOBAL.exec(text)) !== null) {
    const label = m[2].trim();
    if (label) choices.push({ key: m[1], label });
  }
  if (!choices.length && YN_PATTERN.test(text)) {
    choices.push({ key: 'y', label: 'Yes' }, { key: 'n', label: 'No' });
  }
  return choices;
}

function extractFiles(text) {
  const seen = new Set();
  const files = [];
  FILE_PATH_PATTERN.lastIndex = 0;
  for (const m of text.matchAll(FILE_PATH_PATTERN)) {
    const f = m[1].trim();
    if (f.length >= 4 && !seen.has(f)) {
      seen.add(f);
      files.push(f);
      if (files.length >= 20) break;
    }
  }
  return files;
}

function extractEditSummary(text) {
  const lines = [];
  for (const m of text.matchAll(EDIT_LINE_PATTERN)) {
    const line = m[0].trim();
    if (line && lines.length < 10) lines.push(line);
  }
  return lines;
}

function detectConfirmationInText(text) {
  if (!text || typeof text !== 'string') return null;

  const hasConfirmation = CONFIRMATION_PATTERNS.some(p => p.test(text));
  if (!hasConfirmation) return null;

  const allLines = text.split(/\r?\n/);
  const matchIdx = allLines.findIndex(l => CONFIRMATION_PATTERNS.some(p => p.test(l)));
  const rawContext = allLines
    .slice(Math.max(0, matchIdx - 3), matchIdx + 12)
    .join('\n');

  return {
    detected: true,
    files: extractFiles(text),
    editSummary: extractEditSummary(rawContext),
    choices: extractChoices(rawContext),
    rawContext,
  };
}

function detectConfirmation(options = {}) {
  const logPaths = options.logPaths || DEFAULT_LOG_PATHS;
  const checkedAt = new Date().toISOString();

  for (const logPath of logPaths) {
    const text = readFileTail(logPath);
    if (!text) continue;
    const result = detectConfirmationInText(text);
    if (result) {
      return { ...result, sourceFile: logPath, checkedAt, checkedPaths: logPaths };
    }
  }

  return {
    detected: false,
    files: [],
    editSummary: [],
    choices: [],
    rawContext: '',
    sourceFile: null,
    checkedAt,
    checkedPaths: logPaths,
  };
}

if (require.main === module) {
  const result = detectConfirmation();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  detectConfirmation,
  detectConfirmationInText,
  DEFAULT_LOG_PATHS,
  CONFIRMATION_PATTERNS,
};
