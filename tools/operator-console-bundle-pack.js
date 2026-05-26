/**
 * Operator Console Bundle Pack v1.2.2
 *
 * Bundles the current operator console state into a portable snapshot.
 */

function buildConsoleBundle(overrides = {}) {
  return {
    version: '1.2.2',
    timestamp: new Date().toISOString(),
    bundleType: 'operator-console',
    state: overrides.state || { workflowStatus: 'Idle', riskLevel: 'Low' },
    snapshot: overrides.snapshot || null,
    approvalPending: overrides.approvalPending || [],
    lastVerify: overrides.lastVerify || null,
    lastActions: overrides.lastActions || null,
    dryRun: true
  };
}

module.exports = { buildConsoleBundle };

if (require.main === module) {
  const result = buildConsoleBundle();
  console.log(JSON.stringify(result, null, 2));
}
