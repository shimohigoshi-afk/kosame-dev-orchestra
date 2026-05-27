/**
 * VP Human Approval Gate v3.5.0
 *
 * Extracts items that require じゅんやさんYES from decision reports.
 * Generates a prioritized approval request list.
 */

const APPROVAL_REQUIRED_OPERATIONS = ['git push', 'git tag', 'deploy', 'cloud_run', 'secret', 'billing'];

function extractApprovalItems(decisionReports = {}) {
  const items = [];
  const { commit, push, release, custom = [] } = decisionReports;

  if (push && push.recommendation === 'YES' && push.gate_required) {
    items.push({
      operation: 'push',
      recommendation: 'YES',
      reason: push.reason || 'push候補',
      gateReason: push.gate_reason,
      commands: [push.junya_operation || `git push origin ${push.branch || 'main'}`],
      priority: 'high'
    });
  }

  if (release && release.recommendation === 'YES' && release.gate_required) {
    items.push({
      operation: 'release',
      recommendation: 'YES',
      reason: release.reason || 'release候補',
      gateReason: release.gate_reason,
      commands: release.tagCommands || [],
      priority: 'high'
    });
  }

  for (const item of custom) {
    if (item && item.requiresHumanApproval) {
      items.push({ ...item, priority: 'normal' });
    }
  }

  const hasItems = items.length > 0;

  return {
    gate: 'vp-human-approval-gate',
    hasItems,
    itemCount: items.length,
    items,
    summary: hasItems
      ? `じゅんやさんYESが必要な操作が ${items.length}件あります。`
      : 'じゅんやさんYESが必要な操作はありません。',
    approvalNote: 'これらの操作はじゅんやさんの最終YESなしに実行してはいけません。',
    version: '3.5.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

function checkRequiresApproval(operation = '') {
  const lower = operation.toLowerCase();
  return APPROVAL_REQUIRED_OPERATIONS.some(op => lower.includes(op));
}

module.exports = { extractApprovalItems, checkRequiresApproval, APPROVAL_REQUIRED_OPERATIONS };

if (require.main === module) {
  const result = extractApprovalItems({
    push: { recommendation: 'YES', gate_required: true, gate_reason: 'push requires approval', branch: 'main', reason: 'verify PASS / clean tree' },
    release: { recommendation: 'NO', gate_required: true, tagCommands: [] }
  });
  console.log(JSON.stringify(result, null, 2));
}
