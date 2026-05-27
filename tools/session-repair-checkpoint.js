/**
 * Session Repair Checkpoint v2.4.0
 *
 * Routes verify/Actions failures to Claude repair mode.
 */

function createRepairCheckpoint(params = {}) {
  const {
    session_id,
    trigger = 'verify_failure',
    verify_error_detail = '',
    actions_error_detail = '',
    failed_smoke_tests = [],
    failed_files = [],
    repair_agent = 'claude',
    repair_scope = 'minimal',
    repair_instructions = []
  } = params;

  const defaultInstructions = [
    'node --check を実行して構文エラーを特定してください',
    '失敗したsmokeテストを個別実行して原因を特定してください',
    '最小修正のみ行ってください（大規模リファクタ禁止）',
    '修正後に npm run verify を再実行してください',
    '全PASS後にこさめへ報告してください'
  ];

  return {
    checkpoint_type: 'session_repair_checkpoint',
    session_id,
    trigger,
    failure_context: {
      verify_error_detail,
      actions_error_detail,
      failed_smoke_tests,
      failed_files
    },
    repair_plan: {
      agent: repair_agent,
      scope: repair_scope,
      instructions: [...defaultInstructions, ...repair_instructions]
    },
    safety_constraints: [
      '大規模リファクタ禁止',
      '既存の通過しているsmokeを壊さない',
      'git push / deploy / rm -rf 禁止'
    ],
    completion_criteria: {
      node_check: 'pass',
      verify: 'pass',
      no_regressions: true
    },
    version: '2.4.0',
    triggered_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createRepairCheckpoint };

if (require.main === module) {
  const chk = createRepairCheckpoint({
    session_id: 'session-v2.4.0-001',
    trigger: 'verify_failure',
    verify_error_detail: 'smoke/dev-agent-foo-smoke.js: assertion failed',
    failed_smoke_tests: ['smoke/dev-agent-foo-smoke.js'],
    repair_scope: 'minimal'
  });
  console.log(JSON.stringify(chk, null, 2));
}
