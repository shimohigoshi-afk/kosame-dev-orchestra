# Full Orchestra Runtime Probe / Usage Console v10.5.0

## Purpose
v10.0.0 Full Orchestra Agent Runtime の `buildPacket` を呼び出し、
6つの主要パケットの生成状態を確認するための dry-run console。

## Input
| Field | Type | Description |
|-------|------|-------------|
| projectName | string | プロジェクト名 |
| repoPath | string | リポジトリパス |
| taskGoal | string | タスク目標 |
| productLine | string | プロダクトライン |
| taskType | string | タスクタイプ |
| riskLevel | string | リスクレベル |
| dataLevel | string | データレベル (A/B/C) |
| currentStatus | string | 現在の状態 |
| geminiResult | any | Gemini の結果 (null可) |
| grokResult | any | Grok の結果 (null可) |
| claudeResult | any | Claude の結果 (null可) |
| providerStatus | object | プロバイダー状態 |
| probeMode | string | probe モード (dry-run) |

## Output
| Field | Type | Description |
|-------|------|-------------|
| probeId | string | プローブID |
| runtimeFunctionUsed | string | 使用した関数名 ("buildPacket") |
| inputSummary | object | 入力サマリー |
| packetPresence | object | 各パケットの存在確認 |
| safetySummary | object | 安全性サマリー |
| approvalGateSummary | object | 承認ゲートサマリー |
| blockedDangerousActions | string[] | ブロックされた危険アクション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| probePassed | boolean | プローブ成功フラグ |
| runtimePacket | object | v10.0.0 buildPacket の返却値 |

## packetPresence Keys
- orchestraId
- planningPacket
- parallelWorkPacket
- mergedReviewPacket
- repairRetryPacket
- finalRuntimePacket
- finalApprovalPacket

## Safety Rules
- dryRun: true (常時)
- humanApprovalRequired: true (常時)
- 実 API 実行禁止
- 実ファイル編集禁止
- Secret / .env / API key 読み取り禁止
- Level C データは外部プロバイダー不可 (runtimePacket.levelCBlocked で反映)

## Usage
```bash
npm run pm-agent:full-orchestra-runtime-probe-console
npm run smoke:full-orchestra-runtime-probe-console-pack
```

## Safe Failure
`full-orchestra-agent-runtime-pack.js` が require できない場合、
`safetySummary.buildPacketAvailable: false` / `probePassed: false` で安全に終了する。
