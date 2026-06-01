# First Practical Orchestra Task Runner v11.0.0

## Purpose
v10.5.0 Runtime Probe / Usage Console を使って、
実際の小さな低リスクタスクを Full Orchestra に dry-run で流すための task runner。

実ファイル編集・実 API 実行・commit・push・tag・deploy はしない。
作るのは「実行前の作業パケット」「AI 別貼り付け指示」「検証計画」「承認パケット」まで。

## Representative Task (v11.0.0)
KOSAME Dev Orchestra README に v10.0.0 Full Orchestra Agent Runtime の説明を追加するための
作業パケットを作る。

## Input
| Field | Type | Description |
|-------|------|-------------|
| taskRunnerId | string | ランナーID (自動生成可) |
| projectName | string | プロジェクト名 |
| repoPath | string | リポジトリパス |
| taskGoal | string | タスク目標 |
| productLine | string | プロダクトライン |
| taskType | string | タスクタイプ (docs推奨) |
| riskLevel | string | リスクレベル (low推奨) |
| dataLevel | string | データレベル (A推奨) |
| currentStatus | string | 現在の状態 |
| targetFiles | string[] | 対象ファイル |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| providerStatus | object | プロバイダー状態 |
| runMode | string | 実行モード (dry-run) |

## Output
| Field | Type | Description |
|-------|------|-------------|
| taskRunnerId | string | ランナーID |
| runtimeProbePacket | object | v10.5.0 probe console の結果 |
| practicalTaskPacket | object | タスク詳細パケット |
| providerPromptPackets | object | 5プロバイダー分のプロンプト |
| verificationPlan | object | 検証計画 |
| approvalPacket | object | 承認パケット |
| rollbackNote | string | ロールバック手順 |
| blockedDangerousActions | string[] | ブロックされた危険アクション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| runnerPassed | boolean | ランナー成功フラグ |

## providerPromptPackets
### geminiPacket
- role: 仕様整理 / docs観点 / 構成案
- canEditRepo: false

### grokPacket
- role: 弱点指摘 / YES地獄防止 / 実用性チェック
- canEditRepo: false

### claudePacket
- role: 実装担当 (v11.0.0 runner では指示 packet 生成まで)
- canEditRepo: true
- allowedFiles / deniedFiles / verifyCommands / doneCriteria 付き

### kosamePacket
- role: 統合 / 安全ゲート / 最終判断
- canEditRepo: false

### humanApprovalPacket
- role: じゅんやさん final YES only
- commitGate / pushGate / tagGate / deployGate (全て allowed: false)

## Safety Rules
- dryRun: true / humanApprovalRequired: true 常時
- noRealFileEdit: true / noRealApiExecution: true
- Gemini / Grok は repo shared edit 不可
- Secret / .env / API key / 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録は外部プロバイダー不可
- commit / push / tag / deploy / destructive action は Human Approval 必須
- じゅんやさんは final YES のみ

## Usage
```bash
npm run pm-agent:first-practical-orchestra-task-runner
npm run smoke:first-practical-orchestra-task-runner-pack
```
