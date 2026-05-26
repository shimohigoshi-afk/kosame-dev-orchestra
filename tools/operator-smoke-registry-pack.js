/**
 * Operator Smoke Registry Pack v1.2.5
 *
 * Maintains the registry of all smoke tests and their current pass/fail status.
 */

const SMOKE_REGISTRY_SCHEMA_VERSION = '1.2.5';

function buildSmokeRegistry(entries = []) {
  const defaults = [
    { id: 'permission-policy', script: 'smoke:permission-policy', status: 'unknown' },
    { id: 'docs', script: 'smoke:docs', status: 'unknown' },
    { id: 'operator-unified-cli', script: 'smoke:operator-unified-cli', status: 'unknown' },
    { id: 'operator-console-bundle', script: 'smoke:operator-console-bundle', status: 'unknown' },
    { id: 'operator-completion-checklist', script: 'smoke:operator-completion-checklist', status: 'unknown' },
    { id: 'operator-safety-contract', script: 'smoke:operator-safety-contract', status: 'unknown' },
    { id: 'operator-self-review', script: 'smoke:operator-self-review', status: 'unknown' },
    { id: 'operator-handoff-complete', script: 'smoke:operator-handoff-complete', status: 'unknown' },
    { id: 'operator-local-console-complete', script: 'smoke:operator-local-console-complete', status: 'unknown' },
    { id: 'operator-console-complete-release', script: 'smoke:operator-console-complete-release', status: 'unknown' },
    { id: 'kosame-local-operator-complete', script: 'smoke:kosame-local-operator-complete', status: 'unknown' }
  ];

  const merged = entries.length > 0 ? entries : defaults;

  return {
    schemaVersion: SMOKE_REGISTRY_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    totalRegistered: merged.length,
    entries: merged,
    policy: 'All entries must pass before release',
    dryRun: true
  };
}

module.exports = { buildSmokeRegistry, SMOKE_REGISTRY_SCHEMA_VERSION };

if (require.main === module) {
  const result = buildSmokeRegistry();
  console.log(JSON.stringify(result, null, 2));
}
