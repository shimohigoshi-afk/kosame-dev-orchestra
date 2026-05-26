# v0.2.1 HTTP Dry-Run Intake

## 概要

v0.2.1 は、Cloud Run へ deploy する直前の HTTP 入口を実装するバージョン。

**今回は deployしない。外部 API を実行しない。Secret を読まない。**

Node 標準の `http` モジュールのみで実装する。外部依存を増やさない。

---

## v0.2.1 の目的

- Task Packet を HTTP 経由で受け付ける入口を作る
- POST /dry-run-task で routing decision を HTTP レスポンスとして返す
- Cloud Run に載せる直前構造として整備する
- 危険箇所だけガードして爆速で進める方針で foundation から HTTP まで一気に到達する

---

## HTTP dry-run intake の役割

- `GET /health`: ヘルスチェック（Cloud Run の readiness probe 想定）
- `GET /info`: PM Agent メタ情報・HTTP インターフェース情報
- `POST /dry-run-task`: Task Packet を受け取り、dry-run routing decision を返す

全エンドポイントは `dryRunOnly: true` — 外部 API を一切呼ばない。

---

## エンドポイント仕様

### GET /health

```json
{
  "status": "ok",
  "service": "KOSAME Cloud Run PM Agent",
  "version": "v0.2.1",
  "mode": "http-dry-run-intake"
}
```

Cloud Run の readiness / liveness probe として使用予定（v0.2.2 以降）。

### GET /info

```json
{
  "name": "KOSAME Cloud Run PM Agent",
  "version": "v0.2.0",
  "status": "foundation-only",
  "plannedRuntime": "Cloud Run",
  "sourceOfTruth": "GitHub",
  "secretStore": "Secret Manager",
  "httpInterface": {
    "endpoints": ["GET /health", "GET /info", "POST /dry-run-task"],
    "bodyFormat": "application/json",
    "maxBodySize": "1MB"
  },
  "deployStatus": "not-deployed",
  "dryRunOnly": true
}
```

### POST /dry-run-task

リクエスト:

```json
{
  "id": "TASK-001",
  "title": "...",
  "kind": "implementation",
  "riskLevel": "low"
}
```

成功レスポンス（200）:

```json
{
  "success": true,
  "dryRun": true,
  "validation": { "valid": true, "errors": [] },
  "decision": {
    "success": true,
    "dryRun": true,
    "recommendedOwner": "claude_code",
    "reason": "...",
    "humanApprovalRequired": false,
    "blocked": false,
    "nextAction": "Assign to claude_code and proceed"
  }
}
```

バリデーション失敗（200）:

```json
{
  "success": false,
  "dryRun": true,
  "validation": { "valid": false, "errors": ["Missing required field: ..."] },
  "decision": null
}
```

JSON パースエラー（400）:

```json
{
  "success": false,
  "dryRun": true,
  "error": "Invalid JSON",
  "detail": "..."
}
```

---

## Task Packet を HTTP で受け付ける理由

- n8n / GitHub Actions / 外部クライアントから Task Packet を POST できる
- Cloud Run に deploy すれば、HTTPS エンドポイントとして外部から安全に叩ける
- PM Agent が HTTP サービスとして独立することで、Claude Code / Gemini / GPT への routing が疎結合になる
- GitHub Actions はワークフローから `curl POST /dry-run-task` で routing decision を取得できる

---

## Cloud Run に載せる直前構造

v0.2.1 の実装は Cloud Run の想定仕様にそのまま対応している:

- `GET /health` → readiness / liveness probe
- `PORT` 環境変数 → Cloud Run がポートを注入する
- JSON レスポンス → Cloud Run の前段 Load Balancer と互換
- `dryRunOnly: true` → live 移行前の安全フラグ（v0.2.2 以降で解除候補）

---

## じゅんやさんをコピペ作業員にしない

- Task Packet を HTTP で受け付けることで、じゅんやさんは「URL を叩くだけ」でルーティング結果を確認できる
- routing decision の確認・承認・差し戻しは HTTP レスポンスを読むだけでよい
- 繰り返しの手動確認・コピペ作業を PM Agent が代替する

---

## 危険箇所だけガードして爆速で進める

ガードする箇所:
- Secret 値・APIキー値の読み取り・出力
- 本番環境への変更
- deploy（Cloud Run / Railway）
- git push / git tag
- 課金 API の実行
- `child_process` による gcloud / deploy コマンドの実行

それ以外:
- HTTP サーバーの実装: 全速前進
- dry-run routing の HTTP 化: 全速前進
- smoke テストの実装: 全速前進

---

## 今回の制約

- **deployしない**: v0.2.1 は HTTP 構造のみ。Cloud Run deploy は v0.2.2 以降
- **APIを実行しない**: fetch なし。外部 API なし
- **Secretを読まない**: `.env` / Secret Manager / GitHub Secrets 不使用
- **printenv / env を実行しない**
- **git push / git tag しない**: Human Approval 必要

---

## Human Approval が必要な境界

| 操作 | 理由 |
|---|---|
| `git commit` / `git push` | コード変更の最終責任 |
| Cloud Run への deploy | 本番環境変更 |
| Secret Manager の値の閲覧・変更 | 秘密情報保護 |
| `--live` フラグによる API 実行 | コスト発生 |
| `riskLevel: critical` のタスク | 高リスク操作全般 |
| HTTP サーバーの外部公開 | セキュリティ境界 |

---

## GitHub Actions との連携想定

```yaml
# 想定フロー（実装は v0.2.2 以降）
- name: dry-run task route
  run: |
    curl -s -X POST http://pm-agent-host/dry-run-task \
      -H "Content-Type: application/json" \
      -d '{"id":"T-1","title":"..","kind":"implementation","riskLevel":"low"}'
```

GitHub Actions が PM Agent に Task Packet を POST し、routing decision を取得する。

---

## v0.2.2 以降の候補

- Cloud Run への PM Agent deploy（`gcloud run deploy`）
- Cloud Run URL を GitHub Actions に注入する設計
- `dryRunOnly: false` への移行準備
- n8n ワークフローとの接続設計
- Secret Manager からの API キー取得設計（Human Approval のもと）
