/**
 * Smoke test for Operator Smoke Registry Pack v1.2.5
 */

const { buildSmokeRegistry, SMOKE_REGISTRY_SCHEMA_VERSION } = require('../tools/operator-smoke-registry-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Smoke Registry Pack v1.2.5');

  const registry = buildSmokeRegistry();
  if (registry.schemaVersion !== SMOKE_REGISTRY_SCHEMA_VERSION) throw new Error('Schema version mismatch');
  if (registry.schemaVersion !== '1.2.5') throw new Error('Version mismatch');
  if (!Array.isArray(registry.entries)) throw new Error('Entries not an array');
  if (registry.entries.length === 0) throw new Error('Registry is empty');
  if (!registry.dryRun) throw new Error('dryRun flag missing');

  const custom = buildSmokeRegistry([{ id: 'test', script: 'smoke:test', status: 'passed' }]);
  if (custom.entries[0].id !== 'test') throw new Error('Custom entry not applied');

  console.log('Smoke test PASSED');
  return {
    version: '1.2.5',
    purpose: 'Operator Smoke Registry Pack Smoke Test',
    status: 'passed',
    dryRun: true
  };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
