# Task Runner Usage Console v11.5.0

## Purpose
v11.0.0 First Practical Orchestra Task Runner を呼び出し、
低リスク実タスク投入時の出力（providerPromptPackets / verificationPlan / approvalPacket / rollbackNote）を
確認できる dry-run usage console。

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
| usageMode | string | usage モード (dry-run) |

## Output
| Field | Type | Description |
|-------|------|-------------|
| usageConsoleId | string | コンソールID |
| runnerFunctionUsed | string | 使用した関数名 ("buildRunner") |
| inputSummary | object | 入力サマリー |
| runnerPacketPresence | object | runner 出力の存在確認 |
| providerPacketSummary | object | provider packet の存在確認 |
| verificationSummary | object | 検証計画サマリー |
| approvalGateSummary | object | 承認ゲートサマリー |
| blockedDangerousActions | string[] | ブロックされた危険アクション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| noRealApiExecution | boolean | 常に true |
| noRealFileEdit | boolean | 常に true |
| usagePassed | boolean | 使用コンソール成功フラグ |
| runnerPacket | object | v11.0.0 buildRunner の返却値 |

## Usage
```bash
npm run pm-agent:task-runner-usage-console
npm run smoke:task-runner-usage-console-pack
```
