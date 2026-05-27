/**
 * Kosame Dispatch Command v2.6.0
 *
 * Determines where to route the next task:
 * Claude / Gemini / Cloud Shell / Human Approval.
 */

const DISPATCH_TARGETS = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  HUMAN: 'human_approval',
  HOLD: 'hold'
};

function executeDispatchCommand(dispatchInput = {}) {
  const {
    task_type = 'unknown',
    risk_level = 'Low',
    gemini_available = false,
    verify_status = 'not_run',
    needs_repair = false,
    needs_bulk_gen = false,
    needs_architecture = false,
    dangerous_actions = [],
    session_id = ''
  } = dispatchInput;

  const DANGEROUS_PATTERNS = ['git push', 'git tag', 'deploy', 'cloud_run', 'secret', 'billing'];
  const has_dangerous = dangerous_actions.some(a =>
    DANGEROUS_PATTERNS.some(p => a.toLowerCase().includes(p.replace('_', ' ')))
  );

  let target = DISPATCH_TARGETS.HOLD;
  let reason = '';
  let sub_instructions = [];

  if (risk_level === 'Critical' || has_dangerous) {
    target = DISPATCH_TARGETS.HUMAN;
    reason = `Critical/dangerous action detected — じゅんやさんの最終YES必要。`;
    sub_instructions = ['Prepare approval packet', 'Present to じゅんやさん for YES/NO'];
  } else if (needs_repair || verify_status === 'failed') {
    target = DISPATCH_TARGETS.CLAUDE;
    reason = 'Repair / fix task → Claude係長へ。';
    sub_instructions = ['Load repair-intake-pack', 'Run fix → verify loop'];
  } else if (needs_bulk_gen && gemini_available) {
    target = DISPATCH_TARGETS.GEMINI;
    reason = 'Bulk generation task → Gemini課長へ。';
    sub_instructions = ['Prepare gemini-bulk-task-packet', 'Send bulk prompt'];
  } else if (needs_architecture || task_type === 'architecture') {
    target = DISPATCH_TARGETS.CLAUDE;
    reason = 'Architecture/design task → Claude係長へ。';
    sub_instructions = ['Review existing structure', 'Propose design changes'];
  } else if (needs_bulk_gen && !gemini_available) {
    target = DISPATCH_TARGETS.CLAUDE;
    reason = 'Bulk gen requested but Gemini unavailable → Claude係長フォールバック。';
    sub_instructions = ['Use Claude for bulk gen', 'Monitor token usage'];
  } else if (risk_level === 'High') {
    target = DISPATCH_TARGETS.HUMAN;
    reason = 'High risk action → じゅんやさんの確認推奨。';
    sub_instructions = ['Summarize risk', 'Request approval before proceeding'];
  } else {
    target = DISPATCH_TARGETS.CLAUDE;
    reason = 'Standard task → Claude係長へ。';
    sub_instructions = ['Execute task', 'Run verify after completion'];
  }

  return {
    command: 'kosame dispatch',
    session_id,
    target,
    reason,
    sub_instructions,
    task_type,
    risk_level,
    gemini_available,
    needs_repair,
    needs_bulk_gen,
    has_dangerous,
    dispatch_targets: DISPATCH_TARGETS,
    human_approval_required: target === DISPATCH_TARGETS.HUMAN,
    version: '2.6.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { executeDispatchCommand, DISPATCH_TARGETS };

if (require.main === module) {
  const result = executeDispatchCommand({
    task_type: 'bulk_generation',
    risk_level: 'Low',
    gemini_available: true,
    needs_bulk_gen: true,
    verify_status: 'passed'
  });
  console.log(JSON.stringify(result, null, 2));
}
