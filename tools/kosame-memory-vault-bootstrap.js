#!/usr/bin/env node
'use strict';

const {
  resolveTaskVaultDir,
  bootstrapTaskVault,
} = require('./kosame-task-vault');

function bootstrapMemoryVault(taskVaultDir = resolveTaskVaultDir(), input = {}) {
  return bootstrapTaskVault(taskVaultDir, input);
}

if (require.main === module) {
  const result = bootstrapMemoryVault();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  bootstrapMemoryVault,
};
