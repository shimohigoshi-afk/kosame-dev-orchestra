# First End-to-End Dry Run Console v13.0.0

## Purpose
v11.5 / v12.0 / v12.5 を統合し、低リスク docs タスクを Full Orchestra に dry-run で一周させる console。
実 API 実行・実ファイル編集・commit・push・tag・deploy は一切しない。

## Integration Flow
```
[Input] taskGoal / targetFiles
    ↓
[v11.5.0] Task Runner Usage Console (buildUsageConsole)
    ↓ usageConsolePacket
[v12.0.0] First Real Docs Task Packet (buildDocsTaskPacket)
    ↓ docsTaskPacket
[v12.5.0] Claude Execution Prompt Exporter (buildExporter)
    ↓ claudeExecutionPromptPacket
[v13.0.0] finalApprovalPacket + endToEndSummary
```

## Input
| Field | Type | Description |
|-------|------|-------------|
| projectName | string | プロジェクト名 |
| repoPath | string | リポジトリパス |
| taskGoal | string | タスク目標 |
| productLine | string | プロダクトライン |
| taskType | string | タスクタイプ |
| riskLevel | string | リスクレベル |
| dataLevel | string | データレベル |
| targetFiles | string[] | 対象ファイル |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| providerStatus | object | プロバイダー状態 |
| currentStatus | string | 現在の状態 |
| endToEndMode | string | 実行モード (dry-run) |

## Output
| Field | Type | Description |
|-------|------|-------------|
| dryRunConsoleId | string | コンソールID |
| usageConsolePacket | object | v11.5.0 usage console の結果 |
| docsTaskPacket | object | v12.0.0 docs task packet |
| claudeExecutionPromptPacket | object | v12.5.0 prompt exporter の結果 |
| endToEndSummary | object | 統合サマリー |
| providerPromptPackets | object | 5プロバイダー分のプロンプト |
| verificationPlan | object | 検証計画 |
| finalApprovalPacket | object | 最終承認パケット |
| rollbackNote | string | ロールバック手順 |
| blockedDangerousActions | string[] | ブロックされた危険アクション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| endToEndPassed | boolean | end-to-end 成功フラグ |

## Safety Rules
- dryRun: true / humanApprovalRequired: true 常時
- noRealApiExecution: true / noRealFileEdit: true
- Gemini / Grok は repo shared edit 不可
- Secret / .env / API key / 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録は外部プロバイダー不可
- commit / push / tag / deploy / destructive action は Human Approval 必須
- じゅんやさんは final YES のみ

## Usage
```bash
npm run pm-agent:first-end-to-end-dry-run-console
npm run smoke:first-end-to-end-dry-run-console-pack
```
