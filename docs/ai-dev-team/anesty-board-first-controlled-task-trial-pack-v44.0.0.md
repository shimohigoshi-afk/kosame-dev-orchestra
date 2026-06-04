# ANESTY Board First Controlled Task Trial Pack v44.0.0

## 概要
ANESTY Board 初回 controlled task の trial ready 判定を生成するpack。
低リスク docs / smoke / runbook 系のみ trialReady = true とする。
bot.js / BOARD_CANON.js / deploy / Secret / .env / API key が絡む場合は必ず trialReady = false とする。

## trialReady 判定ロジック

```
evalTrialReady(opts):
  botLogicInvolved  = forbiddenFilesTouched に bot.js / BOARD_CANON.js が含まれる
  secretInvolved    = forbiddenFilesTouched に .env / secret / API key が含まれる
  deployInvolved    = opts.deployInvolved === true

  if (botLogicInvolved || secretInvolved || deployInvolved) → return false
  return true
```

| 条件 | trialReady |
|---|---|
| docs のみ変更 | **true** |
| bot.js touched | false |
| BOARD_CANON.js touched | false |
| .env touched | false |
| secret / API key touched | false |
| deploy involved | false |

## selectedTask (デフォルト)
- taskId: task_v87_success_docs
- taskTitle: v87.0.8 成功記録 docs 追加
- targetFiles: docs/ai-dev-team/*.md / docs/smoke-records/*.md

## launchReadiness 確認項目
- promptGenerated ✅
- safetyBoundaryDefined ✅
- allowedScopeDefined ✅
- forbiddenScopeDefined ✅
- verificationPlanDefined ✅
- acceptanceCriteriaDefined ✅
- humanApprovalContractDefined ✅

## acceptanceCriteria (全6 / 全required)
1. npm run verify PASS
2. 変更ファイルが docs/** のみ
3. bot.js / BOARD_CANON.js / .env 変更なし
4. git add / commit / push / tag 未実行
5. Secret / .env / API key 未読取
6. deploy / docker build / gcloud deploy 未実行

## resultReviewPlan
1. Claude の完了報告を Kosame/GPT がレビューする
2. 変更ファイル一覧・git status を確認する
3. 安全境界違反がないかチェックする
4. 問題なければ じゅんやさんへ最終 YES を求める
5. じゅんやさん YES → git add / commit / push を実行する

## trialReady = true の場合の nextAction
1. じゅんやさん / Kosame/GPT の最終承認を得る
2. Claude Code へ claudePromptToLaunch を投入する
3. Claude の完了報告を待つ
4. Kosame/GPT がレビュー → じゅんやさん YES → git add / commit / push

## trialReady = false の場合の nextAction
- blockerItems を解消してから再度 trialReady 判定を行う
- bot.js / BOARD_CANON.js / deploy / Secret が絡む場合は task 選定をやり直す

## 関連ツール
- `tools/anesty-board-first-controlled-task-trial-pack.js` (v44.0.0)
- `smoke/dev-agent-anesty-board-first-controlled-task-trial-pack-smoke.js`
- `fixtures/anesty-board-first-controlled-task-trial-pack.sample.json`
