# KOSAME Cloud Run PM Agent — v0.2.0 Foundation

## 概要

KOSAME Cloud Run PM Agent は、AI 開発チームのタスクを受け付け・ルーティング・安全ゲートチェックを行う PM エージェント。

v0.2.0 は **foundation-only**。Cloud Run への deploy はしない。外部 API を呼ばない。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `pm-agent.js` | PM Agent 本体（routing decision, agent info） |
| `task-packet-schema.js` | Task Packet 最小スキーマ・バリデーション・サンプル |
| `pm-agent-dry-run.js` | dry-run CLI ツール |

---

## Task Packet Schema

Task Packet は PM Agent へのタスク入力単位。

必須フィールド:

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | 一意タスク識別子（例: TASK-001） |
| `title` | string | タスク短タイトル |
| `kind` | string | タスク種別（routing 判断に使用） |
| `riskLevel` | string | リスク分類（low / medium / high / critical） |

任意フィールド: `targetRepo`, `allowedFiles`, `forbiddenFiles`, `context`, `acceptanceCriteria`, `verificationCommands`, `humanApprovalRequiredFor`

`kind` の許可値:

```
docs, summary, bulk_reading, classification
implementation, test, smoke, refactor
product_decision, final_review, safety_gate
deploy, secret, billing, production_mutation
```

---

## Routing Policy（dry-run）

| task kind | 推奨担当 | Human Approval 必要 |
|---|---|---|
| docs / summary / bulk_reading / classification | gemini | 不要 |
| implementation / test / smoke / refactor | claude_code | 不要 |
| product_decision / final_review / safety_gate | kosame_pm | 不要 |
| deploy / secret / billing / production_mutation | human | **必要・blocked** |
| riskLevel: critical（kind 問わず） | human | **必要・blocked** |

---

## 実行方法

```bash
# dry-run を実行（外部 API 呼び出しなし）
node apps/pm-agent/pm-agent-dry-run.js
```

---

## 検証方法

```bash
node --check apps/pm-agent/pm-agent.js
node --check apps/pm-agent/task-packet-schema.js
node --check apps/pm-agent/pm-agent-dry-run.js
npm run smoke:cloud-run-pm-agent-foundation
npm run verify
```

---

## 禁止事項

- Cloud Run への deploy はしない（v0.2.0 は foundation-only）
- 外部 API を呼ばない（fetch なし）
- APIキー値・Secret 値を読まない
- `.env` / GitHub Secrets / Secret Manager を参照しない
- `--live` フラグ付き実行はしない
- ANESTY Board 本体に触らない

---

## v0.2.0 時点のステータス

**foundation-only**: 設計・ルーティング判断・dry-run のみ。Cloud Run 実行・live call はなし。

次ステップ候補（v0.2.1 以降）:
- Cloud Run への deploy 設計
- n8n / GitHub Actions との接続設計
- Task Packet の実運用フロー設計
