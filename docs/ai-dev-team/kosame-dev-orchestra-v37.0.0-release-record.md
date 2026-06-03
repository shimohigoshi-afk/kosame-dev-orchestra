# KOSAME Dev Orchestra v37.0.0 Release Record

## バージョン
v37.0.0

## リリース日
2026-06-03

## タイトル
First Real Product Repo Launch Handoff

## 概要
初回実プロダクトrepo作業をClaude Codeへ渡すための最終 handoff packet を生成するpackを追加した。
実repoへは投げない。implementationPrompt (Claude Codeへ貼れる形式) の生成のみ。

## 追加ファイル
- `tools/first-real-product-repo-launch-handoff-pack.js`
- `smoke/dev-agent-first-real-product-repo-launch-handoff-smoke.js`
- `fixtures/first-real-product-repo-launch-handoff.sample.json`
- `docs/ai-dev-team/first-real-product-repo-launch-handoff-v37.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v37.0.0-release-record.md`

## 主要機能
- launchHandoffId 生成
- claudeRole / kosameRole / humanRole 役割定義
- implementationPrompt: Claude Codeへ直接貼れる安全プロンプト
  - 許可/禁止ファイルゾーン明示
  - git commit/push/tag/deploy 禁止明記
  - Secret/.env/顧客情報読取 禁止明記
  - handoffレポートフォーマット指定
- stopConditions (5条)
- commitCandidateStopRule (5ルール)
- rollbackInstruction
- launchHandoffReady / blockerItems

## launchHandoffReady 条件
- isKnownProduct: true
- finalGatePassed: true

## 安全ルール
- dryRun: true / humanApprovalRequired: true
- noRealRepoEdit / noRealGitCommit / noRealGitPush / noRealDeploy / noSecretRead: true

## 前バージョン
v36.0.0 — First Real Product Repo Task Final Gate

## 次バージョン候補
v38.0.0 — First Real Product Repo Result Acceptance Gate
