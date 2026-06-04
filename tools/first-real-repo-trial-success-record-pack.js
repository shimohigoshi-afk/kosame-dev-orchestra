'use strict';

const TOOL_META = {
  version: '41.0.0',
  title: 'First Real Repo Trial Success Record Pack',
  slug: 'first-real-repo-trial-success-record-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy (any form)',
  'docker build',
  'gcloud deploy',
  'git push (automated)',
  'git tag (automated)',
  'git commit (automated)',
  'git add (automated)',
  'secret read',
  'env read',
  'customer data read',
  'destructive delete (rm -rf, git clean -f, git reset --hard)'
];

const PROVIDER_ROLE_MAP = {
  'じゅんやさん (Human)':  ['最終YES担当', 'git/deploy operations実行', 'リスク判断最終権限'],
  'Kosame/GPT':            ['PM・安全ゲート・統合判断', '各ステージ承認', 'エスカレーション判断'],
  'Claude':                ['実装担当', '許可ゾーン内ファイル編集', 'packet/tool/doc生成', 'handoff report生成'],
  'Gemini':                ['Bulk work / draft expansion / fallback'],
  'Grok':                  ['Research / analysis / secondary review'],
  'DeepSeek':              ['Code analysis / alternative suggestions'],
  'Kimi':                  ['Long-context document review'],
  'Cloud Shell':           ['CLI (node/npm/git status read-only)', 'safe inspection commands']
};

const SAFETY_BOUNDARY = {
  dryRunDesign:         'All operations are dry-run by default until explicit Human YES',
  humanApprovalGates:   'じゅんやさん YES required for all git ops / deploy / destructive actions',
  deployBlocked:        'deploy / docker build / gcloud deploy always blocked without Human YES',
  secretBlocked:        '.env / secrets / credentials / API key read always blocked',
  customerDataBlocked:  'PII / insurance / health / financial data always blocked',
  destructiveBlocked:   'rm -rf / git reset --hard / git clean -f always blocked',
  repoScope:            'KOSAME Dev Orchestra repo only — ANESTY Board repo not touched during this record creation'
};

const HUMAN_APPROVAL_CONTRACT = {
  junyaYes:    'Final YES for: git add / commit / push / tag / deploy / any destructive operation',
  kosameGPT:   'PM gate: approve/hold/reject at each stage before escalating to じゅんやさん',
  escalation:  'Any sensitive content detection → immediate escalation to じゅんやさん + こさめ/GPT'
};

function buildTrialSuccessRecord(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const trialSuccessRecordId = `trial-success-record-${now}`;

  const checksPerformed = opts.checksPerformed || [
    { checkId: 'smoke:dev-agent-routing',       result: 'PASS', note: 'dev-agent routing smoke passed' },
    { checkId: 'smoke:cloudrun',                 result: 'PASS', note: 'Cloud Run smoke passed' },
    { checkId: 'npm run verify',                 result: 'PASS', note: 'VERIFY_EXIT=0' },
    { checkId: 'HOME backup',                    result: 'PASS', note: 'HOME backup created successfully' }
  ];

  const verificationResults = opts.verificationResults || {
    smokeDevAgentRouting: 'PASS',
    smokeCloudRun:        'PASS',
    npmRunVerify:         'PASS',
    verifyExit:           0,
    finalStatus:          'clean'
  };

  const successCriteria = opts.successCriteria || [
    { criterion: 'smoke:dev-agent-routing PASS',     met: true },
    { criterion: 'smoke:cloudrun PASS',               met: true },
    { criterion: 'npm run verify PASS (VERIFY_EXIT=0)', met: true },
    { criterion: 'HOME backup created',               met: true },
    { criterion: 'git status clean after checks',     met: true },
    { criterion: 'No secret / .env / PII accessed',  met: true }
  ];

  const trialSucceeded = opts.trialSucceeded !== undefined
    ? opts.trialSucceeded
    : successCriteria.every(c => c.met);

  const packet = {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    noRealGitCommit:       true,
    noRealDeploy:          true,
    noSecretRead:          true,

    trialSuccessRecordId,

    targetProduct:   opts.targetProduct   || 'anesty_board',
    targetRepo:      opts.targetRepo      || 'anesty-board',
    targetRepoPath:  opts.targetRepoPath  || '/home/shimohigoshi/anesty-board',

    testedVersion:   opts.testedVersion   || 'v87.0.8-gemini-first-routing-smoke',
    testedCommit:    opts.testedCommit    || 'd7a3d3e',
    testedTag:       opts.testedTag       || 'v87.0.8-gemini-first-routing-smoke',

    trialPurpose: [
      'KOSAME Dev Orchestra v40.0.0 完成後の初回実repo投入テストとして ANESTY Board を対象に実施',
      'smoke / verify / backup の安全チェックのみを行い、本体ロジックへの編集は行わなかった',
      '安全境界・ヒューマン承認契約が実環境で機能することを確認した'
    ],

    checksPerformed,
    verificationResults,

    backupResult: opts.backupResult || {
      status:   'success',
      location: 'HOME backup',
      note:     'HOME backup created before any checks were run'
    },

    safetyBoundary:        SAFETY_BOUNDARY,
    humanApprovalContract: HUMAN_APPROVAL_CONTRACT,
    providerRoleMap:       PROVIDER_ROLE_MAP,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    successCriteria,
    trialSucceeded,

    lessonsLearned: opts.lessonsLearned || [
      'smoke / verify / backup の安全チェックは ANESTY Board 環境で正常動作することを確認',
      '実repo投入テストは KOSAME Dev Orchestra の安全境界設計が有効であることを示す',
      '初回は docs / smoke / runbook 系の低リスク作業に限定するという方針が適切',
      '本体ロジック (bot.js / BOARD_CANON.js / deploy / Secret) には触れないルールを維持できた'
    ],

    recommendedNextAction: opts.recommendedNextAction || [
      'v42: ANESTY Board Next Task Selection Console — 次の低リスクタスク候補を選定する',
      'v43: ANESTY Board Controlled Task Prompt Pack — Claude Code へ投げる controlled prompt を生成する',
      'v44: ANESTY Board First Controlled Task Trial Pack — 初回 controlled task の trial ready 判定を生成する',
      'その後: じゅんやさん YES のもと ANESTY Board への実タスク投入を開始する'
    ],

    generatedAt: new Date(now).toISOString()
  };

  return packet;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PROVIDER_ROLE_MAP,
  SAFETY_BOUNDARY,
  HUMAN_APPROVAL_CONTRACT,
  buildTrialSuccessRecord
};

if (require.main === module) {
  const packet = buildTrialSuccessRecord({});
  console.log(JSON.stringify(packet, null, 2));
}
