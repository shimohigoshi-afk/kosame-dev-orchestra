# Multi-Agent Task Packet v0.4.4

KOSAME Dev Orchestra におけるマルチエージェント間でのタスク受け渡し形式。

---

## 概要

Gemini, Claude Code, PM Agent 等、複数のエージェントが協調して動くための共通タスク形式を定義する。
これにより、あるエージェントの出力を別のエージェントの入力としてスムーズに配線できる。

---

## 共通スキーマ (JSON)

```json
{
  "packetId": "pkt-20240522-001",
  "version": "v0.4.4",
  "sourceAgent": "pm-agent",
  "targetAgent": "gemini-agent",
  "taskType": "code-review",
  "payload": {
    "title": "...",
    "description": "...",
    "contextFiles": ["path/to/file1", "path/to/file2"],
    "instructions": "...",
    "constraints": ["..."]
  },
  "metadata": {
    "priority": "medium",
    "deadline": "2024-05-22T18:00:00Z",
    "parentTaskId": "task-123"
  }
}
```

---

## ターゲット別パケット定義

| ターゲット | パケット名 | 主要な役割 |
|---|---|---|
| Gemini | `GeminiPacket` | 要約、GCP 観点レビュー、下読み |
| Claude Code | `ClaudeFixPacket` | 実装、バグ修正、リファクタリング |
| PM Agent | `PMPacket` | 設計、進捗管理、承認ゲート判断 |

---

## 運用ルール

1. **一意性の確保**: `packetId` はプロジェクト内で重複しない形式とする。
2. **Context の最小化**: 転送効率とトークン節約のため、必要最小限の `contextFiles` のみを指定する。
3. **エラーハンドリング**: パケットの受け渡しに失敗した場合は、`sourceAgent` にエラー情報を差し戻す。

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.4.4 | 初版作成。マルチエージェント連携の基礎となる共通形式を定義。 |
