'use strict';

const TOOL_META = {
  version: '43.0.0',
  title: 'ANESTY Board Controlled Task Prompt Pack',
  slug: 'anesty-board-controlled-task-prompt-pack'
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

const ALLOWED_FILES = [
  'docs/ai-dev-team/*.md',
  'docs/smoke-records/*.md',
  'docs/runbook/*.md',
  'docs/pm/*.md',
  'smoke/README.md'
];

const FORBIDDEN_FILES = [
  'bot.js',
  'BOARD_CANON.js',
  '.env',
  '.env.*',
  'secrets/**',
  'credentials/**',
  '.github/workflows/**',
  'node_modules/**',
  '*.log',
  'package-lock.json (編集禁止)'
];

const ALLOWED_COMMANDS = [
  'node --check <file>',
  'npm run verify',
  'git status --short',
  'git diff --stat',
  'git log --oneline -5',
  'ls / cat / head / tail (read-only inspection)',
  'find . -name "*.md" (read-only search)'
];

const FORBIDDEN_COMMANDS = [
  'git add',
  'git commit',
  'git push',
  'git tag',
  'git reset --hard',
  'git clean -f',
  'git checkout -- .',
  'rm -rf',
  'npm run deploy',
  'docker build',
  'gcloud deploy',
  'gcloud run deploy',
  'cat .env',
  'cat secrets/**',
  'printenv (全環境変数出力)'
];

const PREFLIGHT_COMMANDS = [
  'git status --short',
  'git log --oneline -5',
  'node --version',
  'npm --version'
];

const IMPLEMENTATION_PROMPT = `あなたは ANESTY Board プロジェクトの実装担当 Claude です。

【役割】
- docs / smoke-records / runbook / README 系のみを対象に、許可ファイルを編集・追加する
- KOSAME Dev Orchestra の安全境界・ヒューマン承認契約に従って作業する

【今回のタスク】
v87.0.8 Gemini-first routing smoke テスト成功記録を docs に追加する

【作業対象ファイル (許可)】
- docs/ai-dev-team/ 以下の .md ファイル
- docs/smoke-records/ 以下の .md ファイル (ディレクトリが存在しない場合は作成可)

【絶対に触ってはいけないファイル】
- bot.js
- BOARD_CANON.js
- .env / .env.* / secrets/** / credentials/**
- .github/workflows/**
- node_modules/**

【絶対に実行してはいけないコマンド】
- git add / git commit / git push / git tag
- git reset --hard / git clean -f / git checkout -- .
- rm -rf
- npm run deploy / docker build / gcloud deploy / gcloud run deploy
- cat .env / cat secrets/** / printenv

【作業手順】
1. git status --short で現在の状態を確認する
2. git log --oneline -5 で最新 commit を確認する
3. docs/ ディレクトリ構造を確認する (ls docs/)
4. docs/ai-dev-team/ または docs/smoke-records/ に以下の内容を記載した .md ファイルを作成する:
   - テスト実施日 / バージョン / commit hash / tag
   - 実施したチェック一覧と結果 (smoke:dev-agent-routing PASS / smoke:cloudrun PASS / npm run verify PASS / HOME backup PASS)
   - 安全境界の確認 (何に触れなかったか)
   - 次のアクション
5. npm run verify を実行して既存テストが壊れていないことを確認する
6. git status --short で変更ファイルを確認する
7. commit 候補として停止する (git add / commit は実行しない)

【完了報告フォーマット】
- 追加・変更ファイル一覧
- npm run verify 結果
- git status --short 結果
- commit 候補に進めるか (YES/NO)
- 残リスク

【重要】
git add / git commit / git push / git tag は絶対に実行しないでください。
commit 候補で停止してください。じゅんやさんの YES があるまで git 操作は禁止です。`;

const VERIFICATION_COMMANDS = [
  'npm run verify',
  'git status --short',
  'git diff --stat'
];

const REPORT_FORMAT = {
  addedFiles:           '追加・変更ファイル一覧',
  npmVerifyResult:      'npm run verify 結果 (PASS/FAIL)',
  gitStatusResult:      'git status --short 結果',
  commitCandidateReady: 'commit 候補に進めるか (YES/NO)',
  remainingRisk:        '残リスク一覧'
};

const ROLLBACK_INSTRUCTION = [
  '追加した docs .md ファイルを削除するだけで revert 完了',
  'git checkout -- docs/ で docs/ 以下の変更をすべて取り消し可能',
  '本体ロジックには触れていないため、revert リスクは最小'
];

function buildControlledTaskPromptPack(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const anestyControlledPromptPackId = `anesty-controlled-prompt-pack-${now}`;

  const blockerItems = opts.blockerItems || [];
  const promptReady = blockerItems.length === 0;

  const packet = {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    noRealGitCommit:       true,
    noRealDeploy:          true,
    noSecretRead:          true,

    anestyControlledPromptPackId,

    targetProduct: opts.targetProduct || 'anesty_board',
    targetRepo:    opts.targetRepo    || '/home/shimohigoshi/anesty-board',

    taskTitle:  opts.taskTitle  || 'v87.0.8 成功記録 docs 追加',
    taskGoal:   opts.taskGoal   || 'ANESTY Board repo の docs に v87.0.8 Gemini-first routing smoke テスト成功記録を追加する',

    claudeRole: 'docs / smoke-records / runbook / README 系ファイルの編集・追加のみ担当',
    kosameRole: 'PM・安全ゲート・統合判断 / 各ステージ承認 / エスカレーション判断',
    humanRole:  'git add / commit / push / tag の最終 YES 担当',

    allowedFiles:    ALLOWED_FILES,
    forbiddenFiles:  FORBIDDEN_FILES,
    allowedCommands: ALLOWED_COMMANDS,
    forbiddenCommands: FORBIDDEN_COMMANDS,
    preflightCommands: PREFLIGHT_COMMANDS,

    implementationPrompt: IMPLEMENTATION_PROMPT,

    verificationCommands: VERIFICATION_COMMANDS,
    reportFormat:         REPORT_FORMAT,
    rollbackInstruction:  ROLLBACK_INSTRUCTION,

    commitCandidateStopRule: 'npm run verify PASS 後、git status --short を確認して停止する。git add / commit / push は実行しない。じゅんやさんの YES を待つ。',

    humanApprovalRequired: true,
    promptReady,
    blockerItems,

    recommendedNextAction: opts.recommendedNextAction || [
      'v44: ANESTY Board First Controlled Task Trial Pack — 初回 controlled task の trial ready 判定を生成する',
      'その後: じゅんやさん YES のもとで実際にこの prompt を ANESTY Board の Claude Code へ投入する'
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
  ALLOWED_FILES,
  FORBIDDEN_FILES,
  ALLOWED_COMMANDS,
  FORBIDDEN_COMMANDS,
  IMPLEMENTATION_PROMPT,
  buildControlledTaskPromptPack
};

if (require.main === module) {
  const packet = buildControlledTaskPromptPack({});
  console.log(JSON.stringify(packet, null, 2));
}
