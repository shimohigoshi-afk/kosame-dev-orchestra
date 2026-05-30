# Full Orchestra Planning Layer v8.0.0

## 概要

フルオーケストラ対応のPlanning Layer。
タスク投入時にGPT/こさめ・Gemini・Claude・Grokの役割分担、作業レーン、安全境界、承認ゲートをplanning packetとして生成する。

## 入力

| フィールド | 説明 |
|-----------|------|
| projectName | プロジェクト名 |
| repoPath | repoパス |
| taskGoal | タスク目標 |
| productLine | プロダクトライン |
| taskType | タスク種別 |
| riskLevel | リスクレベル |
| dataLevel | データレベル (A/B/C) |
| currentStatus | 現在状態 |
| requestedAgents | 使用するAIエージェント一覧 |

## 出力

| フィールド | 説明 |
|-----------|------|
| planningId | ユニークID |
| normalizedGoal | 正規化されたゴール |
| agentRoles | 各エージェントの役割定義 |
| workLanes | 作業レーン（誰が何を担当するか） |
| safetyBoundary | 安全境界（Level C等） |
| approvalGates | 承認ゲート一覧 |
| blockedDangerousActions | ブロック対象アクション |
| recommendedNextAction | 次のアクション推奨 |
| dryRun | true (常に) |
| humanApprovalRequired | true (常に) |

## 安全原則

- dryRun: true — 実API実行なし
- Level C data → 外部provider完全ブロック
- repoEdit権限 → Claudeのみ
- じゅんやさんは最終YESのみ
