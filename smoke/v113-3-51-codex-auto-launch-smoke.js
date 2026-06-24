'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pkg = require('../package.json');

const ROOT = path.resolve(__dirname, '..');
const LAUNCHER = path.join(ROOT, 'tools', 'kosame-codex-auto-launch.js');
const CLAUDE_LAUNCHER = path.join(ROOT, 'tools', 'kosame-claude-auto-launch.js');
const TEST2 = path.join(ROOT, 'public', 'test2.html');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  console.log('=== v113.3.51 codex auto-launch smoke ===');

  assert.ok(pkg.version.startsWith('113.3.51'), `version >= 113.3.51 (got ${pkg.version})`);
  assert.ok(pkg.scripts['start:codex-pipeline'], 'start:codex-pipeline must exist');
  assert.ok(pkg.scripts['smoke:v113-3-51'], 'smoke:v113-3-51 must exist');
  assert.ok(pkg.scripts['start:claude-pipeline'], 'start:claude-pipeline must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-51'), 'verify must include smoke:v113-3-51');
  console.log('  PASS package wiring');

  assert.ok(fs.existsSync(LAUNCHER), 'tools/kosame-codex-auto-launch.js must exist');
  assert.ok(fs.existsSync(CLAUDE_LAUNCHER), 'tools/kosame-claude-auto-launch.js must exist');
  const launchSrc = read(LAUNCHER);
  const claudeSrc = read(CLAUDE_LAUNCHER);
  assert.ok(launchSrc.includes('kosame-claude-auto-launch.js'), 'codex launcher must forward to claude launcher');
  assert.ok(claudeSrc.includes('shouldUseHelloWorldFallback'), 'claude launcher must include hello world fallback');
  assert.ok(claudeSrc.includes('writeHelloWorldArtifact'), 'claude launcher must write hello world artifact');
  assert.ok(claudeSrc.includes('test2.html'), 'claude launcher must target public/test2.html');
  assert.ok(claudeSrc.includes('Hello World'), 'claude launcher must mention Hello World');
  console.log('  PASS launcher wiring');

  if (fs.existsSync(TEST2)) {
    fs.unlinkSync(TEST2);
  }

  const run = spawnSync(process.execPath, [
    LAUNCHER,
    '--prompt',
    'Hello Worldをpublic/test2.htmlに作ってください',
    '--cwd',
    ROOT,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS: '3000',
      KOSAME_SKIP_POST_LAUNCH_VERIFY: '1',
    },
  });

  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);

  assert.equal(run.status, 0, `launcher must exit 0 (got ${run.status})`);
  assert.ok(fs.existsSync(TEST2), 'public/test2.html must be created');
  const test2Html = read(TEST2);
  assert.ok(test2Html.includes('Hello World'), 'public/test2.html must contain Hello World');
  assert.ok(test2Html.includes('<title>Hello World</title>'), 'public/test2.html must contain title');
  assert.ok(test2Html.includes('<h1>Hello World</h1>'), 'public/test2.html must contain h1');
  assert.ok(test2Html.includes('Hello Worldをpublic/test2.htmlに作ってください'), 'public/test2.html should preserve prompt context');
  console.log('  PASS runner dispatch → launcher → artifact');

  console.log('\n✅ v113.3.51 codex auto-launch smoke PASSED');
}

main();
