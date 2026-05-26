# KOSAME Cloud Run PM Agent — v2.0.0 Local Operator Console Complete

## 概要

KOSAME Cloud Run PM Agent は、AI 開発チームのタスクを受け付け・ルーティング・安全ゲートチェックを行う PM エージェント。

v2.0.0 は **Local Operator Console Complete** を完成。**CLI 上で実機運用可能なオペレーター操作盤の全機能が揃いました。**

---

## v1.2.1 - v2.0.0 Local Operator Console Complete Tools（新規追加）

| ツール | 役割 |
|---|---|
| `tools/operator-unified-cli.js` | 全コマンド統合エントリーポイント |
| `tools/operator-console-bundle-pack.js` | コンソール状態バンドル生成 |
| `tools/operator-completion-checklist-pack.js` | 完成チェックリスト |
| `tools/operator-safety-contract-pack.js` | 安全契約・アクション検証 |
| `tools/operator-smoke-registry-pack.js` | Smoke テストレジストリ |
| `tools/operator-self-review-pack.js` | セルフレビュールーブリック |
| `tools/operator-handoff-complete-pack.js` | 最終引き継ぎ文書生成 |
| `tools/operator-claude-emotional-escalation-complete-pack.js` | Claude代行完成記録 |
| `tools/operator-gemini-work-complete-pack.js` | Gemini作業完了記録 |
| `tools/operator-local-console-complete-pack.js` | ローカルコンソール完成宣言 |
| `tools/operator-console-complete-release-pack.js` | リリースパック生成 |
| `tools/kosame-dev-orchestra-local-operator-complete-pack.js` | v2.0.0 完成マイルストーン |

---

## v1.0.1 - v1.2.0 Practical MVP Tools

| ツール | 役割 |
|---|---|
| `tools/operator-cli-command-router.js` | CLI コマンドルーター |
| `tools/operator-state-reader-writer.js` | 状態管理リーダー・ライター |
| `tools/operator-next-action-engine.js` | 次アクション判定エンジン |
| `tools/operator-approval-summary.js` | 承認内容要約生成 |
| `tools/operator-handoff-cli.js` | Handoff 自動生成 CLI |
| `tools/verify-result-recorder-cli.js` | 検証結果記録 CLI |
| `tools/github-actions-recorder-cli.js` | GHA 結果記録 CLI |
| `tools/operator-local-console-cli.js` | 統合ローカルコンソール |
| `tools/operator-dashboard-snapshot.js` | ダッシュボードスナップショット生成 |
| `tools/operator-release-record-pack.js` | リリース完了記録生成 |
| `tools/operator-claude-escalation-pack.js` | Claude 補修依頼パケット生成 |
| `tools/operator-gemini-next-work-pack.js` | Gemini 次期作業パケット生成 |
| `tools/operator-console-practical-mvp-complete-pack.js` | Practical MVP 完成パック |

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `pm-agent.js` | PM Agent 本体（routing decision, agent info） |
| `task-packet-schema.js` | Task Packet 最小スキーマ・バリデーション・サンプル |
| `pm-agent-dry-run.js` | dry-run CLI ツール |
| `pm-agent-http-server.js` | HTTP サーバー（dry-run intake）— deployしない |

### fixtures（v0.2.2）

| ファイル | 役割 | 推奨担当 |
|---|---|---|
| `fixtures/pm-agent/sample-implementation-task.json` | implementation 系 Task Packet | claude_code |
| `fixtures/pm-agent/sample-docs-task.json` | docs / summary 系 Task Packet | gemini |
| `fixtures/pm-agent/sample-critical-deploy-task.json` | deploy / critical（blocked placeholder） | human |

### local HTTP client（v0.2.2）

| ファイル | 役割 |
|---|---|
| `tools/pm-agent-http-client.js` | Node 標準 http/https のみのローカルクライアント |

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

## HTTP エンドポイント（v0.2.1）

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/health` | GET | ヘルスチェック（Cloud Run probe 想定） |
| `/info` | GET | PM Agent メタ情報・HTTP インターフェース情報 |
| `/dry-run-task` | POST | Task Packet を受け取り dry-run routing decision を返す |

全エンドポイントは `dryRunOnly: true` — 外部 API を一切呼ばない。

---

## 実行方法

```bash
# CLI dry-run（外部 API 呼び出しなし）
node apps/pm-agent/pm-agent-dry-run.js

# HTTP サーバー ローカル起動（外部 API 呼び出しなし・deployしない）
node apps/pm-agent/pm-agent-http-server.js
# → http://localhost:8080

# カスタムポートで起動
PORT=3000 node apps/pm-agent/pm-agent-http-server.js

# local HTTP client でサーバーを叩く（別ターミナルでサーバー起動後）
node tools/pm-agent-http-client.js http://127.0.0.1:8080

# fixture を使った dry-run 確認（サーバー不要・CLI のみ）
node -e "
  const {decideTaskRoute} = require('./apps/pm-agent/pm-agent.js');
  const t = JSON.parse(require('fs').readFileSync('fixtures/pm-agent/sample-implementation-task.json'));
  console.log(JSON.stringify(decideTaskRoute(t), null, 2));
"
```

**deploy前後で同じ fixture & client を使い回す思想: baseUrl を Cloud Run URL に切り替えるだけでよい。**

**注意: ローカル起動のみ。Cloud Run への deploy は v0.2.3 以降（Human Approval 必要）。**

---

## 検証方法

```bash
node --check apps/pm-agent/pm-agent.js
node --check apps/pm-agent/task-packet-schema.js
node --check apps/pm-agent/pm-agent-dry-run.js
node --check apps/pm-agent/pm-agent-http-server.js
npm run verify
```

---

## 禁止事項

- Cloud Run への deploy はしない（v0.5.0 は HTTP 構造のみ）
- 外部 API を呼ばない（fetch なし）
- APIキー値・Secret 値を読まない
- `.env` / GitHub Secrets / Secret Manager を参照しない
- `--live` フラグ付き実行はしない
- `gcloud deploy` / `execSync` を使わない
- ANESTY Board 本体に触らない

---

## v0.4.3 - v0.7.0 Governance & Operator Packs

| ツール | 役割 |
|---|---|
| `tools/claude-code-approval-policy-generator.js` | 承認ポリシー・チェックリスト生成 |
| `tools/multi-agent-task-packet-generator.js` | 共通タスクパケット生成 |
| `tools/gemini-agent-prompt-generator.js` | Gemini プロンプト生成 |
| `tools/claude-code-fix-packet-generator.js` | Claude 修正パケット生成 |
| `tools/agent-role-routing-policy-generator.js` | ロールルーティング推奨生成 |
| `tools/verify-failure-triage-packet.js` | 検証失敗トリアージパケット生成 |
| `tools/pm-agent-runtime-monitoring-pack.js` | 運用監視チェックリスト生成 |
| `tools/cost-control-routing-extension-pack.js` | コスト制御・軽量モデルルーティング設定 |
| `tools/release-governance-packet.js` | リリースガバナンス承認パケット生成 |
| `tools/dev-orchestra-operator-console-pack.js` | オペレーターコンソール連携データ生成 |
| `tools/operator-command-packet-generator.js` | オペレーター・コマンドパケット生成 |
| `tools/agent-dispatch-queue-pack.js` | エージェント・ディスパッチキュー管理 |
| `tools/kosame-pm-decision-log-pack.js` | PM 判断ログ（Decision Log）生成 |
| `tools/claude-repair-intake-pack.js` | Claude 補修インテーク生成 |
| `tools/gemini-bulk-work-intake-pack.js` | Gemini 大量生成インテーク生成 |
| `tools/human-approval-minimal-packet.js` | 最小承認パケット生成 |
| `tools/operator-runbook-pack.js` | オペレーター・ランブック管理 |
| `tools/operator-session-record-pack.js` | セッション記録生成 |
| `tools/github-actions-result-review-pack.js` | Actions 結果レビューパケット生成 |
| `tools/local-verify-result-parser-pack.js` | ローカル検証結果パーサー |
| `tools/operator-command-foundation-complete-pack.js` | 基盤土台完成チェック |

---

## v2.0.0 時点のステータス

**Local Operator Console Complete**: v1.2.1 から v2.0.0 まで全パックを整備し、ローカル CLI 操作盤の完成を達成。
次フェーズは v2.1.x Cloud Run UI Entry Phase（じゅんやさんの承認後開始）。
