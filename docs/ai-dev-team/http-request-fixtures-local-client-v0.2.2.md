# v0.2.2 HTTP Request Fixtures & Local Smoke Client

## 概要

v0.2.2 は、PM Agent HTTP サーバーのローカル検証セットを整備するバージョン。

**今回は deployしない。外部 API を実行しない。Secret を読まない。**

Cloud Run deploy 前後で同じ検証資産を使い回せる設計にする。

---

## v0.2.2 の目的

- Cloud Run deploy 前後で共通して使える HTTP request fixtures を作る
- local smoke client (`tools/pm-agent-http-client.js`) で HTTP サーバーを手軽に叩けるようにする
- fixture × client × server の 3 点セットを確立し、deploy 準備を加速する
- 危険箇所だけガードして爆速で進める方針で検証基盤を一気に整備する

---

## HTTP Request Fixtures の役割

`fixtures/pm-agent/` に 3 種類の Task Packet JSON を置く。

### sample-implementation-task.json

- kind: `"implementation"` / riskLevel: `"low"`
- dry-run routing → `recommendedOwner: "claude_code"` / blocked: false
- allowedFiles: `apps/pm-agent/`, `smoke/`, `tools/`, `fixtures/`
- forbiddenFiles: `.env`, `node_modules/**`, `~/anesty-board/**`
- 実装タスクの標準サンプル

### sample-docs-task.json

- kind: `"docs"` / riskLevel: `"low"`
- dry-run routing → `recommendedOwner: "gemini"` / blocked: false
- allowedFiles: `docs/ai-dev-team/`, `README.md` 類
- 大量処理・下読み・要約・ドキュメント系タスクの標準サンプル

### sample-critical-deploy-task.json

- kind: `"deploy"` / riskLevel: `"critical"`
- dry-run routing → `humanApprovalRequired: true` / blocked: true
- 実 deploy は絶対にしない — このファイルは gate チェック用の placeholder
- Secret 値・実環境名の値は含まない

---

## Local Smoke Client の役割

`tools/pm-agent-http-client.js` は、Node 標準 `http`/`https` のみで実装した軽量 HTTP クライアント。

エクスポート関数:

| 関数 | 説明 |
|---|---|
| `requestJson(options)` | 汎用 JSON リクエスト |
| `getHealth(baseUrl)` | GET /health |
| `getInfo(baseUrl)` | GET /info |
| `postDryRunTask(baseUrl, taskPacket)` | POST /dry-run-task |
| `runLocalClientDemo(baseUrl)` | 3 エンドポイントを順に叩くデモ |

デフォルト baseUrl: `http://127.0.0.1:8080`

---

## Deploy 前後で同じ検証を使い回す思想

| フェーズ | 検証方法 |
|---|---|
| ローカル開発 | `node apps/pm-agent/pm-agent-http-server.js` を起動し、client で叩く |
| Cloud Run deploy 後（v0.2.3 以降） | baseUrl を Cloud Run URL に切り替えて同じ client を使う |
| GitHub Actions CI | smoke test がサーバーを起動し、client 経由で自動検証 |

```bash
# ローカル検証
node apps/pm-agent/pm-agent-http-server.js &
node tools/pm-agent-http-client.js http://127.0.0.1:8080

# Cloud Run URL で検証（v0.2.3 以降 — Human Approval 後）
node tools/pm-agent-http-client.js https://pm-agent-xxx.run.app
```

---

## じゅんやさんをコピペ作業員にしない

- fixtures があれば、じゅんやさんは `curl -d @fixtures/pm-agent/sample-implementation-task.json` で検証できる
- client があれば、手動 JSON 組み立ては不要
- smoke test が CI で自動実行されるので、手動確認は承認判断のみでよい

---

## 危険箇所だけガードして爆速で進める

ガードする箇所:
- Secret 値・APIキー値の読み取り・出力
- 本番環境への変更
- deploy（Cloud Run / Railway）
- git push / git tag（Human Approval 必要）
- `child_process` による gcloud / deploy コマンドの実行

それ以外:
- fixture JSON の作成: 全速前進
- local client の実装: 全速前進
- smoke テストの実装: 全速前進

---

## 今回の制約

- **deployしない**: v0.2.2 は fixture & client 整備のみ。Cloud Run deploy は v0.2.3 以降
- **APIを実行しない**: fetch なし。外部 API なし
- **Secretを読まない**: `.env` / Secret Manager / GitHub Secrets 不使用
- **git push / git tag しない**: Human Approval 必要

---

## Human Approval が必要な境界

| 操作 | 理由 |
|---|---|
| `git commit` / `git push` | コード変更の最終責任 |
| Cloud Run への deploy | 本番環境変更 |
| Secret Manager の値の閲覧・変更 | 秘密情報保護 |
| client を Cloud Run URL に向けた実行 | 外部 HTTP アクセス |
| `riskLevel: critical` のタスク実行 | 高リスク操作全般 |

---

## GitHub Actions との連携想定

v0.2.2 以降、GitHub Actions が smoke test でサーバーを自動起動し、client 経由で検証する:

```yaml
# 想定フロー（現在の smoke:http-request-fixtures-client で既に実装済み）
- name: run fixtures & client smoke
  run: npm run smoke:http-request-fixtures-client
```

---

## v0.2.3 以降の候補

- Cloud Run への PM Agent deploy（Human Approval のもと `gcloud run deploy`）
- Cloud Run URL を baseUrl として client から検証
- n8n ワークフローが fixture を POST して routing decision を取得する設計
- Secret Manager からの API キー取得設計（Human Approval のもと）
