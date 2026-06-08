'use strict';

/**
 * KOSAME Dev Orchestra v110.30
 * DeepSeek Local Patch Executor
 *
 * DeepSeek等が返す KOSAME Patch Format を安全にdryRun/適用する。
 * commit/tag/push/deploy/Secret操作は行わない。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL_META = {
  version: '110.30.0',
  slug: 'deepseek-local-patch-executor',
  dryRunDefault: true,
  humanGate: true
};

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.env($|[./])/i,
  /credentials\.json$/i,
  /package-lock\.json$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)node(\/|$)/i,
  /(^|\/)\.kosame(\/|$)/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i
];

const BLOCKED_CONTENT_PATTERNS = [
  /rm\s+-rf/i,
  /gcloud\s+run/i,
  /gcloud\s+secrets?/i,
  /git\s+push/i,
  /git\s+add\s+-A/i,
  /git\s+commit/i,
  /deploy/i,
  /DISCORD_BOT_TOKEN\s*=/i,
  /API_KEY\s*=/i,
  /SECRET/i
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    write: false,
    input: '',
    inputFile: '',
    smoke: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--write') args.write = true;
    else if (a === '--dry-run') args.write = false;
    else if (a === '--input') args.input = argv[++i] || '';
    else if (a.startsWith('--input=')) args.input = a.slice('--input='.length);
    else if (a === '--input-file') args.inputFile = argv[++i] || '';
    else if (a.startsWith('--input-file=')) args.inputFile = a.slice('--input-file='.length);
    else if (a === '--smoke') args.smoke = argv[++i] || '';
    else if (a.startsWith('--smoke=')) args.smoke = a.slice('--smoke='.length);
  }

  return args;
}

function readInput(args) {
  if (args.input) return args.input;
  if (args.inputFile) return fs.readFileSync(args.inputFile, 'utf8');
  if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8');
  return '';
}

function normalizeTarget(filePath) {
  const clean = String(filePath || '').trim();
  if (!clean) throw new Error('empty target path');
  if (path.isAbsolute(clean)) throw new Error(`absolute path rejected: ${clean}`);
  const normalized = path.normalize(clean).replace(/\\/g, '/');
  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    throw new Error(`path traversal rejected: ${clean}`);
  }
  return normalized;
}

function isBlockedPath(filePath) {
  const target = normalizeTarget(filePath);
  return BLOCKED_PATH_PATTERNS.some((re) => re.test(target));
}

function hasBlockedContent(content) {
  return BLOCKED_CONTENT_PATTERNS.some((re) => re.test(content));
}

function parseKosamePatch(text) {
  const input = String(text || '');
  const re = /\[FILE\]\s+([^\n]+)\n```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g;
  const patches = [];
  let m;

  while ((m = re.exec(input)) !== null) {
    const target = normalizeTarget(m[1]);
    const content = m[2].replace(/\n$/, '');
    patches.push({ target, content });
  }

  if (!patches.length) {
    throw new Error('no [FILE] patch blocks found');
  }

  return patches;
}

function validatePatches(patches) {
  const results = [];
  for (const p of patches) {
    const blockedPath = isBlockedPath(p.target);
    const blockedContent = hasBlockedContent(p.content);
    const allowed = !blockedPath && !blockedContent;

    results.push({
      target: p.target,
      allowed,
      blockedPath,
      blockedContent,
      bytes: Buffer.byteLength(p.content, 'utf8'),
      nodeCheck: p.target.endsWith('.js')
    });
  }
  return results;
}

function applyPatches(patches, opts = {}) {
  const write = Boolean(opts.write);
  const validations = validatePatches(patches);
  const blocked = validations.filter((v) => !v.allowed);

  if (blocked.length) {
    return {
      ok: false,
      dryRun: !write,
      human_gate: true,
      reason: 'blocked patch target or content',
      validations
    };
  }

  const applied = [];

  if (write) {
    for (const p of patches) {
      const full = path.resolve(process.cwd(), p.target);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, p.content + '\n');
      applied.push(p.target);
    }
  }

  const nodeChecks = [];
  for (const v of validations) {
    if (v.nodeCheck && write) {
      const res = spawnSync(process.execPath, ['--check', v.target], {
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      nodeChecks.push({
        target: v.target,
        status: res.status,
        ok: res.status === 0,
        stderr: res.stderr || ''
      });
    } else if (v.nodeCheck) {
      nodeChecks.push({
        target: v.target,
        status: null,
        ok: true,
        dryRun: true
      });
    }
  }

  return {
    ok: nodeChecks.every((c) => c.ok),
    dryRun: !write,
    human_gate: true,
    applied,
    validations,
    nodeChecks,
    blockedActionsDenied: true,
    realGitActionsExecuted: false,
    realDeployActionsExecuted: false
  };
}

function runSmokeCommand(command) {
  if (!command) return null;
  if (/git\s+|gcloud\s+|deploy|rm\s+-rf/i.test(command)) {
    return { ok: false, rejected: true, command };
  }
  const parts = command.split(/\s+/).filter(Boolean);
  const res = spawnSync(parts[0], parts.slice(1), { encoding: 'utf8', cwd: process.cwd() });
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    command
  };
}

function main() {
  const args = parseArgs();
  const input = readInput(args);
  const patches = parseKosamePatch(input);
  const result = applyPatches(patches, { write: args.write });

  if (args.smoke && result.ok && args.write) {
    result.smoke = runSmokeCommand(args.smoke);
    result.ok = result.ok && result.smoke.ok;
  }

  console.log(JSON.stringify({
    tool: TOOL_META,
    result
  }, null, 2));

  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  TOOL_META,
  parseArgs,
  normalizeTarget,
  isBlockedPath,
  hasBlockedContent,
  parseKosamePatch,
  validatePatches,
  applyPatches,
  runSmokeCommand
};
