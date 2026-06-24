#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const launcherPath = path.join(__dirname, 'kosame-claude-auto-launch.js');
const res = spawnSync(process.execPath, [launcherPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
});

process.exit(res.status ?? (res.signal ? 1 : 0));
