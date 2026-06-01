# First Real Docs Task Packet v12.0.0

## Purpose
README 更新のような低リスク docs タスクを、Full Orchestra 用の「実タスク packet」として生成する。
実ファイル編集はしない。実行前の packet 生成まで。

## Representative Task (v12.0.0)
KOSAME Dev Orchestra README に v10.0.0 Full Orchestra Agent Runtime /
v11.0.0 First Practical Orchestra Task Runner の説明を追加するための作業パケットを作る。

## Input
| Field | Type | Description |
|-------|------|-------------|
| taskId | string | タスクID |
| projectName | string | プロジェクト名 |
| repoPath | string | リポジトリパス |
| taskGoal | string | タスク目標 |
| productLine | string | プロダクトライン |
| taskType | string | タスクタイプ (docs推奨) |
| riskLevel | string | リスクレベル (low推奨) |
| dataLevel | string | データレベル |
| targetFiles | string[] | 対象ファイル (README.md など) |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| currentStatus | string | 現在の状態 |
| expectedDocSections | string[] | 期待するドキュメントセクション |

## Output
| Field | Type | Description |
|-------|------|-------------|
| docsTaskPacketId | string | packet ID |
| normalizedDocsTask | object | 正規化タスク情報 |
| targetFilePlan | object[] | 対象ファイル計画 |
| allowedEditPlan | object | 編集許可計画 |
| deniedEditPlan | object | 編集禁止計画 |
| providerPromptPackets | object | 5プロバイダー分のプロンプト |
| verificationPlan | object | 検証計画 |
| approvalPacket | object | 承認パケット |
| rollbackNote | string | ロールバック手順 |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| recommendedNextAction | string | 推奨次アクション |

## Safety Rules
- targetFiles は低リスク docs ファイルに限定 (README.md など)
- Secret / 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録は扱わない
- dryRun: true / humanApprovalRequired: true 常時
- noRealFileEdit: true / noRealApiExecution: true
- Gemini / Grok は repo 編集不可
- commit / push / tag / deploy は human approval 必須

## Usage
```bash
npm run pm-agent:first-real-docs-task-packet
npm run smoke:first-real-docs-task-packet-pack
```
