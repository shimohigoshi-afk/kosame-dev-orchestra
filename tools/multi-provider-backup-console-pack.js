'use strict';

const TOOL_META = {
  version: '5.5.0',
  title: 'Multi-Provider Backup Console',
  slug: 'multi-provider-backup-console-pack'
};

const BACKUP_MATRIX = {
  claude:   { tier: 1, backups: ['grok', 'deepseek'], finalBackup: 'kosame' },
  gemini:   { tier: 1, backups: ['grok', 'kimi'],     finalBackup: 'kosame' },
  grok:     { tier: 2, backups: ['claude', 'gemini'], finalBackup: 'kosame' },
  deepseek: { tier: 2, backups: ['claude'],           finalBackup: 'kosame' },
  kimi:     { tier: 2, backups: ['gemini'],           finalBackup: 'kosame' },
  kosame:   { tier: 0, backups: ['human'],            finalBackup: 'human'  }
};

const CONSOLE_POLICY = {
  maxBackupAttempts: 2,
  alwaysHumanApprovalRequired: true,
  blockOnDataLevelC: true
};

function getBackupConsole(provider) {
  return BACKUP_MATRIX[provider] || null;
}

function selectBackup(provider, unavailable = [], dataLevel = 'A') {
  if (dataLevel === 'C' && provider !== 'kosame' && provider !== 'human') {
    return { provider: 'kosame', reason: 'data level C — routed to kosame only', humanApprovalRequired: true };
  }
  const matrix = getBackupConsole(provider);
  if (!matrix) {
    return { provider: 'kosame', reason: 'unknown provider', humanApprovalRequired: true };
  }
  for (const backup of matrix.backups) {
    if (!unavailable.includes(backup)) {
      return { provider: backup, reason: `backup for ${provider}`, humanApprovalRequired: true };
    }
  }
  return { provider: matrix.finalBackup, reason: 'all backups exhausted', humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const primary = input.primary || 'gemini';
  const unavailable = input.unavailable || [];
  const dataLevel = input.dataLevel || 'A';
  const selected = selectBackup(primary, unavailable, dataLevel);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    backupMatrix: BACKUP_MATRIX,
    consolePolicy: CONSOLE_POLICY,
    selected
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    primary: process.env.KOSAME_PRIMARY || 'gemini',
    unavailable: (process.env.KOSAME_UNAVAILABLE || '').split(',').filter(Boolean),
    dataLevel: process.env.KOSAME_DATA_LEVEL || 'A'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BACKUP_MATRIX,
  CONSOLE_POLICY,
  getBackupConsole,
  selectBackup,
  buildPacket
};
