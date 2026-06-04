'use strict';

const TOOL_META = {
  version: '42.0.0',
  title: 'ANESTY Board Next Task Selection Console Pack',
  slug: 'anesty-board-next-task-selection-console-pack'
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

const CANDIDATE_TASKS = [
  {
    taskId:             'task_docs_pm_ops',
    taskTitle:          'docs/pm 運用整理',
    description:        'docs/pm ディレクトリの既存ドキュメントを整理・索引化する',
    targetFiles:        ['docs/pm/**/*.md'],
    forbiddenFiles:     ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**'],
    implementationRisk: 'very_low',
    safetyRisk:         'very_low',
    businessImpact:     'low',
    recommended:        false,
    holdReason:         null
  },
  {
    taskId:             'task_v87_success_docs',
    taskTitle:          'v87.0.8 成功記録 docs 追加',
    description:        'smoke テスト成功記録を docs/ai-dev-team または docs/smoke-records に追加する',
    targetFiles:        ['docs/ai-dev-team/*.md', 'docs/smoke-records/*.md'],
    forbiddenFiles:     ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**'],
    implementationRisk: 'very_low',
    safetyRisk:         'very_low',
    businessImpact:     'low',
    recommended:        true,
    holdReason:         null
  },
  {
    taskId:             'task_smoke_routing_readme',
    taskTitle:          'smoke-dev-agent-routing の README 化',
    description:        'ANESTY Board の dev-agent-routing smoke テストの目的・手順・結果を README.md に記載する',
    targetFiles:        ['smoke/README.md', 'docs/smoke-records/*.md'],
    forbiddenFiles:     ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**'],
    implementationRisk: 'very_low',
    safetyRisk:         'very_low',
    businessImpact:     'medium',
    recommended:        false,
    holdReason:         null
  },
  {
    taskId:             'task_cloudrun_preflight_docs',
    taskTitle:          'Cloud Run preflight docs 補強',
    description:        'Cloud Run の preflight チェックリストと運用手順を docs に追加する',
    targetFiles:        ['docs/cloudrun/*.md', 'docs/runbook/*.md'],
    forbiddenFiles:     ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**', '.github/workflows/**'],
    implementationRisk: 'low',
    safetyRisk:         'very_low',
    businessImpact:     'medium',
    recommended:        false,
    holdReason:         null
  },
  {
    taskId:             'task_runbook_no_bot',
    taskTitle:          'Discord 本体ロジックに触らない範囲の runbook 整備',
    description:        'bot.js / BOARD_CANON.js に触れずに運用 runbook を docs/runbook 以下に整備する',
    targetFiles:        ['docs/runbook/*.md'],
    forbiddenFiles:     ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**'],
    implementationRisk: 'very_low',
    safetyRisk:         'very_low',
    businessImpact:     'medium',
    recommended:        false,
    holdReason:         null
  }
];

const FORBIDDEN_SCOPE = [
  'bot.js — Discord 本体ロジック',
  'BOARD_CANON.js — ボード正規化ロジック',
  '.env / secrets / .env.* / credentials — Secret 類',
  'API key / Secret Manager 値の読取',
  '.github/workflows — CI/CD 設定',
  'deploy / docker build / gcloud deploy',
  'git add / git commit / git push / git tag',
  '顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録',
  'rm -rf / git reset --hard / git clean -f'
];

function buildNextTaskSelectionConsole(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const anestyNextTaskSelectionId = `anesty-next-task-selection-${now}`;

  const recommendedTask = CANDIDATE_TASKS.find(t => t.recommended) || CANDIDATE_TASKS[0];

  const missingInputs = opts.missingInputs || [];

  const packet = {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    noRealGitCommit:       true,
    noRealDeploy:          true,
    noSecretRead:          true,

    anestyNextTaskSelectionId,

    targetProduct:         opts.targetProduct        || 'anesty_board',
    targetRepoCandidate:   opts.targetRepoCandidate  || '/home/shimohigoshi/anesty-board',

    candidateTasks:        CANDIDATE_TASKS,

    recommendedTask: {
      taskId:        recommendedTask.taskId,
      taskTitle:     recommendedTask.taskTitle,
      description:   recommendedTask.description,
      targetFiles:   recommendedTask.targetFiles,
      forbiddenFiles: recommendedTask.forbiddenFiles
    },

    selectionReason: [
      'v87.0.8 成功記録 docs 追加は、既に実施済みの smoke テスト結果を文書化するだけであり、コードへの変更がない',
      '対象ファイルは docs/ai-dev-team または docs/smoke-records 以下の .md ファイルのみ',
      'bot.js / BOARD_CANON.js / .env / secrets には一切触れない',
      '低リスク初回タスクとして最適 — 失敗しても revert は docs ファイルを削除するだけ'
    ],

    businessImpact:     recommendedTask.businessImpact,
    implementationRisk: recommendedTask.implementationRisk,
    safetyRisk:         recommendedTask.safetyRisk,

    allowedScope: [
      'docs/**/*.md',
      'smoke/README.md',
      'docs/smoke-records/*.md',
      'docs/ai-dev-team/*.md',
      'docs/runbook/*.md',
      'docs/pm/*.md'
    ],

    forbiddenScope: FORBIDDEN_SCOPE,

    requiredInputs: [
      'ANESTY Board repo の最新 HEAD commit hash',
      'ANESTY Board repo のディレクトリ構造 (docs/ 以下)',
      'v87.0.8 smoke テスト結果の詳細ログ'
    ],

    missingInputs,

    humanApprovalRequired: true,

    recommendedNextAction: opts.recommendedNextAction || [
      'v43: ANESTY Board Controlled Task Prompt Pack — Claude Code へ投げる controlled prompt を生成する',
      'v44: ANESTY Board First Controlled Task Trial Pack — 初回 controlled task の trial ready 判定を生成する',
      'その後: じゅんやさん YES のもと ANESTY Board への実タスク投入を開始する'
    ],

    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    providerRoleMap:        PROVIDER_ROLE_MAP,

    generatedAt: new Date(now).toISOString()
  };

  return packet;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PROVIDER_ROLE_MAP,
  CANDIDATE_TASKS,
  FORBIDDEN_SCOPE,
  buildNextTaskSelectionConsole
};

if (require.main === module) {
  const packet = buildNextTaskSelectionConsole({});
  console.log(JSON.stringify(packet, null, 2));
}
