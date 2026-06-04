'use strict';

const TOOL_META = {
  version: '44.0.0',
  title: 'ANESTY Board First Controlled Task Trial Pack',
  slug: 'anesty-board-first-controlled-task-trial-pack'
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
  deployBlocked:        'deploy / docker build / gcloud deploy always blocked',
  secretBlocked:        '.env / secrets / credentials / API key read always blocked',
  customerDataBlocked:  'PII / insurance / health / financial data always blocked',
  destructiveBlocked:   'rm -rf / git reset --hard / git clean -f always blocked',
  botLogicBlocked:      'bot.js / BOARD_CANON.js — 本体ロジックへの編集は常にブロック',
  repoScope:            'ANESTY Board repo の docs 系ファイルのみ対象'
};

const CLAUDE_PROMPT_TO_LAUNCH = `あなたは ANESTY Board プロジェクトの実装担当 Claude です。

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

function evalTrialReady(opts) {
  const tasks = opts.selectedTask || {};
  const forbiddenTouched = opts.forbiddenFilesTouched || [];
  const botLogicInvolved = forbiddenTouched.some(f =>
    ['bot.js', 'BOARD_CANON.js'].includes(f)
  );
  const secretInvolved = forbiddenTouched.some(f =>
    f.includes('.env') || f.includes('secret') || f.includes('API key')
  );
  const deployInvolved = opts.deployInvolved === true;

  if (botLogicInvolved || secretInvolved || deployInvolved) {
    return false;
  }
  return true;
}

function buildFirstControlledTaskTrialPack(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const anestyFirstControlledTrialId = `anesty-first-controlled-trial-${now}`;

  const trialReady = opts.trialReady !== undefined ? opts.trialReady : evalTrialReady(opts);
  const blockerItems = opts.blockerItems || (trialReady ? [] : ['trialReady条件未満: bot.js / deploy / Secret 関連が検知された']);

  const packet = {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    noRealGitCommit:       true,
    noRealDeploy:          true,
    noSecretRead:          true,

    anestyFirstControlledTrialId,

    targetProduct: opts.targetProduct || 'anesty_board',
    targetRepo:    opts.targetRepo    || '/home/shimohigoshi/anesty-board',

    selectedTask: opts.selectedTask || {
      taskId:    'task_v87_success_docs',
      taskTitle: 'v87.0.8 成功記録 docs 追加',
      targetFiles: ['docs/ai-dev-team/*.md', 'docs/smoke-records/*.md']
    },

    trialObjective: opts.trialObjective || [
      'ANESTY Board repo に対して初回 controlled task (低リスク docs 追加) を安全に実行する',
      '安全境界・ヒューマン承認契約が実環境で機能することを再確認する',
      'commit 候補まで進め、じゅんやさんの最終 YES を待つ'
    ],

    launchReadiness: opts.launchReadiness || {
      promptGenerated:        true,
      safetyBoundaryDefined:  true,
      allowedScopeDefined:    true,
      forbiddenScopeDefined:  true,
      verificationPlanDefined: true,
      acceptanceCriteriaDefined: true,
      humanApprovalContractDefined: true
    },

    safetyBoundary:        SAFETY_BOUNDARY,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    allowedScope: [
      'docs/ai-dev-team/*.md — 追加のみ',
      'docs/smoke-records/*.md — ディレクトリ作成 + 追加のみ'
    ],

    forbiddenScope: [
      'bot.js — 本体ロジック (触るだけで trialReady = false)',
      'BOARD_CANON.js — ボード正規化ロジック (触るだけで trialReady = false)',
      '.env / secrets / API key — 読取禁止 (触るだけで trialReady = false)',
      '.github/workflows — CI/CD (変更禁止)',
      'deploy / docker build / gcloud deploy (実行禁止)',
      'git add / commit / push / tag (実行禁止)',
      'rm -rf / git reset --hard / git clean -f (実行禁止)',
      '顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録 (読取禁止)'
    ],

    claudePromptToLaunch: CLAUDE_PROMPT_TO_LAUNCH,

    expectedChangedFiles: opts.expectedChangedFiles || [
      'docs/ai-dev-team/anesty-board-v87.0.8-smoke-success-record.md (新規)',
      'docs/smoke-records/ (ディレクトリ新規 + .md ファイル新規、任意)'
    ],

    verificationPlan: opts.verificationPlan || [
      'npm run verify を実行して既存テストが壊れていないことを確認する',
      'git status --short で変更ファイルを確認する',
      '変更ファイルが docs/** のみであることを確認する',
      'bot.js / BOARD_CANON.js / .env に変更がないことを確認する'
    ],

    acceptanceCriteria: opts.acceptanceCriteria || [
      { criterion: 'npm run verify PASS',                              required: true },
      { criterion: '変更ファイルが docs/** のみ',                       required: true },
      { criterion: 'bot.js / BOARD_CANON.js / .env 変更なし',          required: true },
      { criterion: 'git add / commit / push / tag 未実行',             required: true },
      { criterion: 'Secret / .env / API key 未読取',                   required: true },
      { criterion: 'deploy / docker build / gcloud deploy 未実行',     required: true }
    ],

    resultReviewPlan: opts.resultReviewPlan || [
      'Claude の完了報告を Kosame/GPT がレビューする',
      '変更ファイル一覧・git status を確認する',
      '安全境界違反がないかチェックする',
      '問題なければ じゅんやさんへ最終 YES を求める',
      'じゅんやさん YES → git add / commit / push を実行する'
    ],

    humanApprovalContract: {
      junyaYes:   'git add / commit / push / tag の最終 YES',
      kosameGPT:  'Claude の完了報告レビュー / 安全境界チェック / じゅんやさんへのエスカレーション判断',
      escalation: '安全境界違反検知 → 即座に じゅんやさん + こさめ/GPT へエスカレーション'
    },

    trialReady,
    blockerItems,

    nextAction: trialReady
      ? [
          'じゅんやさん / Kosame/GPT の最終承認を得る',
          'Claude Code へ claudePromptToLaunch を投入する',
          'Claude の完了報告を待つ',
          'Kosame/GPT がレビュー → じゅんやさん YES → git add / commit / push'
        ]
      : [
          'blockerItems を解消してから再度 trialReady 判定を行う',
          'bot.js / BOARD_CANON.js / deploy / Secret が絡む場合は task 選定をやり直す'
        ],

    providerRoleMap:  PROVIDER_ROLE_MAP,
    generatedAt:      new Date(now).toISOString()
  };

  return packet;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PROVIDER_ROLE_MAP,
  SAFETY_BOUNDARY,
  CLAUDE_PROMPT_TO_LAUNCH,
  evalTrialReady,
  buildFirstControlledTaskTrialPack
};

if (require.main === module) {
  const packet = buildFirstControlledTaskTrialPack({});
  console.log(JSON.stringify(packet, null, 2));
}
