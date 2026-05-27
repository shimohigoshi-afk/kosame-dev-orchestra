'use strict';

const TOOL_META = {
  version: '6.1.0',
  title: 'Real Status Importer Plus',
  slug: 'real-status-importer-plus-pack'
};

const IMPORTABLE_SOURCES = ['git_status', 'package_version', 'gh_run_list', 'provider_status', 'verify_status'];

const PROVIDER_STATUS_DEFAULTS = {
  kosame:     'up',
  claude:     'unknown',
  gemini:     'unknown',
  grok:       'unknown',
  deepseek:   'unknown',
  kimi:       'unknown',
  cloudShell: 'up',
  human:      'up'
};

function importGitStatus(raw = '') {
  const lines = raw.split('\n').filter(Boolean);
  const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).map(l => l.slice(3).trim());
  const untracked = lines.filter(l => l.startsWith('??')).map(l => l.slice(3).trim());
  const staged = lines.filter(l => /^[ADRMC]/.test(l)).map(l => l.slice(3).trim());
  return {
    source: 'git_status',
    clean: lines.length === 0,
    modified,
    untracked,
    staged,
    totalChanges: lines.length
  };
}

function importPackageVersion(version = '') {
  const parts = String(version).split('.').map(Number);
  return {
    source: 'package_version',
    version,
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function importGhRunList(runs = []) {
  const passing = runs.filter(r => r.conclusion === 'success').length;
  const failing = runs.filter(r => r.conclusion === 'failure').length;
  const pending = runs.filter(r => !r.conclusion).length;
  return {
    source: 'gh_run_list',
    total: runs.length,
    passing,
    failing,
    pending,
    latestStatus: runs[0] ? runs[0].conclusion || 'pending' : 'none'
  };
}

function importProviderStatus(statuses = {}) {
  const merged = Object.assign({}, PROVIDER_STATUS_DEFAULTS, statuses);
  const downProviders = Object.entries(merged).filter(([, v]) => v === 'down').map(([k]) => k);
  return {
    source: 'provider_status',
    statuses: merged,
    downProviders,
    allUp: downProviders.length === 0
  };
}

function importVerifyStatus(result = {}) {
  return {
    source: 'verify_status',
    passed: result.passed === true,
    failedSmokes: Array.isArray(result.failedSmokes) ? result.failedSmokes : [],
    totalSmokes: typeof result.totalSmokes === 'number' ? result.totalSmokes : 0,
    lastRun: result.lastRun || null
  };
}

function buildSnapshot(input = {}) {
  return {
    gitStatus:       importGitStatus(input.gitStatusRaw || ''),
    packageVersion:  importPackageVersion(input.packageVersion || '0.0.0'),
    ghRunList:       importGhRunList(input.ghRuns || []),
    providerStatus:  importProviderStatus(input.providerStatuses || {}),
    verifyStatus:    importVerifyStatus(input.verifyResult || {})
  };
}

function buildPacket(input = {}) {
  const snapshot = buildSnapshot(input);
  const readyForDispatch =
    snapshot.gitStatus.clean &&
    snapshot.verifyStatus.passed &&
    snapshot.ghRunList.failing === 0;

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    importableSources: IMPORTABLE_SOURCES,
    snapshot,
    readyForDispatch,
    recommendedNextAction: readyForDispatch
      ? 'Status is clean — safe to proceed with Dev Factory dispatch'
      : 'Resolve outstanding issues before dispatching'
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    packageVersion: process.env.KOSAME_PACKAGE_VERSION || '6.1.0',
    providerStatuses: { claude: 'up', gemini: 'up' },
    verifyResult: { passed: true, totalSmokes: 10, failedSmokes: [] }
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  IMPORTABLE_SOURCES,
  PROVIDER_STATUS_DEFAULTS,
  importGitStatus,
  importPackageVersion,
  importGhRunList,
  importProviderStatus,
  importVerifyStatus,
  buildSnapshot,
  buildPacket
};
