# Multi-Agent Parallel Work Pack v8.5.0

## 概要

Gemini/Grok/Claudeへ同時進行でタスクを振るためのPrompt Packet生成ツール。
実際のAPI実行はしない。各AIに貼り付けるためのprompt packetを生成するだけ。

## 入力

| フィールド | 説明 |
|-----------|------|
| planningPacket | v8.0.0 Planning Layerの出力 |
| availableAgents | 使用可能エージェント一覧 |
| parallelMode | full / partial / sequential |
| maxConcurrentAgents | 同時実行最大数 |
| dataLevel | データレベル |
| riskLevel | リスクレベル |

## 出力

| フィールド | 説明 |
|-----------|------|
| parallelWorkId | ユニークID |
| agentTaskPackets | 各AI向けprompt packet一覧 |
| executionOrder | 実行順序 |
| conflictPolicy | 競合ポリシー |
| deniedSharedEdits | 共同編集禁止リスト |
| safetyBoundary | 安全境界 |
| humanApprovalRequired | true (常に) |
| dryRun | true (常に) |

## 並行実行ルール

1. kosame: intake/planning (先行)
2. Gemini+Grok: spec+weakness (並行実行OK)
3. Claude: implementation (Gemini/Grok完了後)
4. Human: final approval (最後)

## repo編集権限

- Claude: 許可 (唯一repoを触れるエージェント)
- Gemini: 禁止 (text output only)
- Grok: 禁止 (text output only)
- kosame: 禁止 (claudeへルーティング)
