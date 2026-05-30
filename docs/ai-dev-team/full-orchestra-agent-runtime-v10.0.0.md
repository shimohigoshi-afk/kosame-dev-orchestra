# Full Orchestra Agent Runtime v10.0.0

## 概要

KOSAME Dev Orchestraのフルオーケストラ対応dry-run Runtime。
タスク投入から最終承認パケット生成まで一周できる。
実API実行・実ファイル自動マージは一切しない。

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
| geminiResult | Geminiの結果テキスト (任意) |
| grokResult | Grokの結果テキスト (任意) |
| claudeResult | Claudeの実装結果 (任意) |
| providerStatus | 各providerの稼働状態 (任意) |

## 出力

| フィールド | 説明 |
|-----------|------|
| orchestraId | ユニークID |
| planningPacket | v8.0.0 Planning Layer出力 |
| parallelWorkPacket | v8.5.0 Parallel Work Pack出力 |
| mergedReviewPacket | v9.0.0 Orchestra Result Merger出力 |
| repairRetryPacket | v9.5.0 Repair Retry Board出力 |
| loopPacket | v7.5.0 Practical Dev Factory Loop出力 |
| finalRuntimePacket | サイクル完了サマリ |
| finalApprovalPacket | commit/push/tag/deploy gates |
| blockedDangerousActions | ブロック対象アクション |
| recommendedNextAction | 次アクション推奨 |
| dryRun | true (常に) |
| humanApprovalRequired | true (常に) |

## 絶対安全原則

1. dryRun: true — 常に、例外なし
2. humanApprovalRequired: true — 常に
3. Level C data → 外部provider完全ブロック
4. APIキー/Secret/.env → 読まない・渡さない
5. commit/push/tag/deploy → finalApprovalPacketのみ、実行しない
6. repoを触るのはClaudeのみ
7. じゅんやさんは最終YESのみ。作業員に戻さない。
8. DeepSeek/Kimi → 低機密・匿名化済みのみ
