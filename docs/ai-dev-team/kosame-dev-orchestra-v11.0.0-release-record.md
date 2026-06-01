# KOSAME Dev Orchestra v11.0.0 Release Record

## Version
11.0.0

## Title
First Practical Orchestra Task Runner

## Release Date
2026-06-01

## Summary
v10.5.0 Runtime Probe / Usage Console を使って、
実際の小さな低リスクタスクを Full Orchestra に流すための dry-run task runner を実装した。

代表タスク: KOSAME Dev Orchestra README に v10.0.0 Full Orchestra Agent Runtime の説明を追加するための
作業パケットを生成する (dry-run のみ。実ファイル編集・実 API 実行なし)。

## New Files
- `tools/first-practical-orchestra-task-runner-pack.js` (v11.0.0)
- `smoke/dev-agent-first-practical-orchestra-task-runner-pack-smoke.js`
- `fixtures/first-practical-orchestra-task-runner.sample.json`
- `docs/ai-dev-team/first-practical-orchestra-task-runner-v11.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v11.0.0-release-record.md`

## New Scripts
- `smoke:first-practical-orchestra-task-runner-pack`
- `pm-agent:first-practical-orchestra-task-runner`

## Key Design
- `full-orchestra-runtime-probe-console-pack.js` を require して `buildProbe` を呼び出す
- v10.5.0 probe console 経由で v10.0.0 runtimePacket を保持
- `practicalTaskPacket` でタスク詳細を構造化
- `providerPromptPackets` で 5 プロバイダー分のプロンプトを生成
  - geminiPacket: 仕様整理・docs観点・構成案 (canEditRepo: false)
  - grokPacket: 弱点指摘・YES地獄防止・実用性チェック (canEditRepo: false)
  - claudePacket: 実装担当。allowedFiles / deniedFiles / verifyCommands / doneCriteria 付き
  - kosamePacket: 統合・安全ゲート・最終判断
  - humanApprovalPacket: commit / push / tag / deploy ゲート (じゅんやさん final YES only)
- `verificationPlan`: smoke / verify / git status チェック含む
- `approvalPacket`: 全ゲート human YES 必須
- `rollbackNote`: rollback 手順記載

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- 実ファイル編集禁止 (noRealFileEdit: true)
- 実 API 実行禁止 (noRealApiExecution: true)
- commit / push / tag / deploy / deploy はすべて human approval 必須
- Gemini / Grok は repo shared edit 不可
- Claude のみ repo 編集候補 (v11.0.0 runner 自体では編集せず指示 packet 生成まで)
- Secret / .env / API key / 顧客情報は外部プロバイダー不可

## blockedDangerousActions
git push / git tag / deploy / gcloud deploy / docker build / secret / .env / api key / customer data / destructive action / rm -rf

## package.json version
11.0.0

## Verification
- node --check tools/first-practical-orchestra-task-runner-pack.js: PASS
- npm run smoke:first-practical-orchestra-task-runner-pack: PASS
- npm run verify: PASS (接続済み)
