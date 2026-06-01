# KOSAME Dev Orchestra v12.0.0 Release Record

## Version
12.0.0

## Title
First Real Docs Task Packet

## Release Date
2026-06-01

## Summary
README 更新のような低リスク docs タスクを、Full Orchestra 用の「実タスク packet」として生成する。
実ファイル編集はしない。作るのは実行前の packet まで。

代表タスク: KOSAME Dev Orchestra README に v10.0.0 Full Orchestra Agent Runtime /
v11.0.0 First Practical Orchestra Task Runner の説明を追加するための作業パケットを作る。

## New Files
- `tools/first-real-docs-task-packet-pack.js` (v12.0.0)
- `smoke/dev-agent-first-real-docs-task-packet-pack-smoke.js`
- `fixtures/first-real-docs-task-packet.sample.json`
- `docs/ai-dev-team/first-real-docs-task-packet-v12.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v12.0.0-release-record.md`

## New Scripts
- `smoke:first-real-docs-task-packet-pack`
- `pm-agent:first-real-docs-task-packet`

## Key Design
- `targetFiles` は README.md など低リスク docs に限定
- `allowedEditPlan` / `deniedEditPlan` を明示
- `providerPromptPackets` で 5 プロバイダー分のプロンプト生成
  - geminiPacket: 構成案・見出し案 (canEditRepo: false)
  - grokPacket: 弱点指摘・読み手の詰まり確認 (canEditRepo: false)
  - claudePacket: 実装候補 (このpackでは編集しない)
  - kosamePacket: 統合・安全ゲート
  - humanApprovalPacket: commit / push / tag / deploy ゲート
- `verificationPlan` で smoke / verify / git status チェック
- `approvalPacket` で全ゲート human YES 必須
- `rollbackNote` でロールバック手順記載

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealFileEdit: true / noRealApiExecution: true
- Secret / 顧客情報 / 保険証券 / 健診情報は扱わない

## Verification
- node --check tools/first-real-docs-task-packet-pack.js: PASS
- npm run smoke:first-real-docs-task-packet-pack: PASS
- npm run verify: PASS (接続済み)
