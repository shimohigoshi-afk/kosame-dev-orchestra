# KOSAME Dev Orchestra v44.0.0 Release Record

## バージョン
v44.0.0

## リリース日
2026-06-04

## タイトル
ANESTY Board First Controlled Task Trial Pack

## 概要
ANESTY Board 初回 controlled task の trial ready 判定を生成するpackを追加した。
低リスク docs / smoke / runbook 系のみ trialReady = true とし、
bot.js / BOARD_CANON.js / deploy / Secret / .env / API key が絡む場合は必ず trialReady = false とする。

## 追加ファイル
- `tools/anesty-board-first-controlled-task-trial-pack.js`
- `smoke/dev-agent-anesty-board-first-controlled-task-trial-pack-smoke.js`
- `fixtures/anesty-board-first-controlled-task-trial-pack.sample.json`
- `docs/ai-dev-team/anesty-board-first-controlled-task-trial-pack-v44.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v44.0.0-release-record.md`

## 主要機能
- anestyFirstControlledTrialId 生成
- selectedTask / trialObjective / launchReadiness
- safetyBoundary (botLogicBlocked / secretBlocked / deployBlocked 等)
- allowedScope / forbiddenScope
- claudePromptToLaunch (安全ルール完全内包)
- expectedChangedFiles / verificationPlan
- acceptanceCriteria (6条件 / 全required)
- resultReviewPlan / humanApprovalContract
- evalTrialReady() — bot.js / .env / deploy が絡むと false を返す
- trialReady / blockerItems / nextAction

## trialReady 判定ロジック
- trialReady = true: 低リスク docs/smoke/runbook 系のみ
- trialReady = false: 以下いずれかが該当
  - bot.js / BOARD_CANON.js が forbiddenFilesTouched に含まれる
  - .env / secret / API key が forbiddenFilesTouched に含まれる
  - deployInvolved = true

## acceptanceCriteria (全6)
1. npm run verify PASS
2. 変更ファイルが docs/** のみ
3. bot.js / BOARD_CANON.js / .env 変更なし
4. git add / commit / push / tag 未実行
5. Secret / .env / API key 未読取
6. deploy / docker build / gcloud deploy 未実行

## 安全ルール
- dryRun: true / humanApprovalRequired: true
- evalTrialReady() による自動判定
- trialReady = false の場合はブロッカー解消まで投入不可

## 前バージョン
v43.0.0 — ANESTY Board Controlled Task Prompt Pack

## 次フェーズ
じゅんやさん / Kosame/GPT の最終承認後、ANESTY Board Claude Code へ controlled prompt を投入
