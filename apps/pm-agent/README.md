# KOSAME Cloud Run PM Agent — v0.2.1 HTTP dry-run intake

## 概要

KOSAME Cloud Run PM Agent は、AI 開発チームのタスクを受け付け・ルーティング・安全ゲートチェックを行う PM エージェント。

v0.2.1 は **HTTP dry-run intake** を実装。Cloud Run に載せる直前構造。**deployはしない。外部 API を呼ばない。**

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
npm run smoke:cloud-run-pm-agent-foundation
npm run smoke:http-dry-run-intake
npm run verify
```

---

## 禁止事項

- Cloud Run への deploy はしない（v0.2.1 は HTTP 構造のみ）
- 外部 API を呼ばない（fetch なし）
- APIキー値・Secret 値を読まない
- `.env` / GitHub Secrets / Secret Manager を参照しない
- `--live` フラグ付き実行はしない
- `gcloud deploy` / `execSync` を使わない
- ANESTY Board 本体に触らない

---

## v0.3.0 Deploy Execution & Runtime Ops Pack

v0.3.0 で deploy 実行前の全準備が完了。v0.4.0 でじゅんやさんが Cloud Shell から deploy 実行。

```bash
# v0.3.0 最終確認
npm run pm-agent:deploy-readiness-final-check  # readyForHumanDeploy: true

# v0.4.0 deploy コマンドパック確認（実行はじゅんやさん）
node tools/pm-agent-first-deploy-command-pack.js

# 全 smoke
npm run verify
```

| ツール | 役割 |
|---|---|
| `tools/pm-agent-deploy-approval-packet.js` | deploy 承認パケット（humanApprovalRequired: true） |
| `tools/pm-agent-deploy-readiness-final-check.js` | 最終 readiness チェック（readyForHumanDeploy） |
| `tools/pm-agent-runtime-ops-packet.js` | runtime 運用・incident response パケット |
| `tools/pm-agent-webhook-contract-generator.js` | n8n 接続コントラクト生成 |
| `tools/pm-agent-first-deploy-command-pack.js` | v0.4.0 初回 deploy コマンドパック（文字列のみ） |
| `tools/pm-agent-first-deploy-result-template.js` | deploy 結果記録テンプレート（v0.4.1 用） |

---

## Cloud Run Launch Pack（v0.2.3）

v0.2.3 で Cloud Run deploy 直前の全コンポーネントを整備済み。v0.3.0 で Runtime Ops Pack を追加し、v0.4.0 Human Approval 後にじゅんやさんが deploy 実行。

| ファイル | 役割 |
|---|---|
| `Dockerfile` | Cloud Run 用コンテナイメージ定義 |
| `.dockerignore` | Secret・.env を exclude |
| `cloud-run/pm-agent-service.template.yaml` | Cloud Run service 定義テンプレート |
| `tools/pm-agent-cloud-run-preflight.js` | deploy 前安全性チェック |
| `tools/pm-agent-deploy-command-generator.js` | gcloud コマンド文字列生成（実行しない） |
| `tools/pm-agent-post-deploy-smoke.js` | deploy 後 HTTP smoke 検証 |

```bash
# v0.2.3 Launch Pack 検証
npm run pm-agent:cloud-run-preflight    # preflight チェック → launchReady: true
npm run pm-agent:deploy-commands        # deploy コマンド文字列生成（実行しない）
npm run smoke:cloud-run-launch-pack-max # Launch Pack 全体 smoke
```

---

## v0.2.1 時点のステータス

**HTTP dry-run intake**: HTTP サーバー実装済み。ローカル動作確認済み。Cloud Run deploy はなし。

v0.2.3 で Cloud Run Launch Pack MAX を整備完了。次ステップ: v0.3.0 Human Approval → deploy 実行。
