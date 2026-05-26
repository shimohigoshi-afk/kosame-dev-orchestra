# Cloud Run Launch Pack MAX — v0.2.3 設計ドキュメント

## v0.2.3 の目的

Cloud Run PM Agent を **安全に deploy できる直前状態** まで持っていく。

deploy そのものは v0.3.0 で Human Approval を得てから実施する。
v0.2.3 は「deploy できる状態を作る」のが仕事。

---

## Cloud Run Launch Pack MAX の役割

v0.2.3 で整備した Launch Pack は、deploy 直前に必要な全要素を一括で揃えるためのセット。

| コンポーネント | 役割 |
|---|---|
| `Dockerfile` | Cloud Run 用コンテナイメージ定義 |
| `.dockerignore` | Secret・.env・git 履歴などを exclude |
| `cloud-run/pm-agent-service.template.yaml` | Cloud Run service 定義テンプレート（placeholder 使用） |
| `cloud-run/README.md` | Cloud Run 設定ファイルの使い方 |
| `tools/pm-agent-cloud-run-preflight.js` | deploy 前のファイル・設定・安全性チェック |
| `tools/pm-agent-deploy-command-generator.js` | gcloud コマンド文字列生成（実行しない） |
| `tools/pm-agent-post-deploy-smoke.js` | deploy 後の HTTP smoke 検証ツール |
| `docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md` | 人間承認パケット |
| `docs/ai-dev-team/cloud-run-release-checklist-v0.2.3.md` | release チェックリスト |
| `.github/workflows/pm-agent-launch-readiness.yml` | GitHub Actions readiness 検証 |

---

## なぜ今 deploy しないか

1. **Secret Manager 未設定** — API キーの Cloud Run 環境への注入方針が未確認
2. **billing 確認未了** — GCP プロジェクトの課金状態・上限設定を人間が確認すべき
3. **Human Approval 原則** — KOSAME Dev Orchestra では deploy は常に人間承認が必要
4. **リスクゼロの状態で GitHub Actions を通してから deploy** が方針

---

## deploy する前に人間承認が必要な理由

| 項目 | 理由 |
|---|---|
| Cloud Run deploy | 本番 GCP リソース生成・課金発生 |
| Secret Manager | API キー値に AI がアクセスしてはいけない |
| billing | 意図しない課金を防ぐ |
| production トラフィック | rollback 判断は人間の責務 |
| git push / git tag | ソースの正本管理は人間が承認 |

---

## Cloud Run deploy 時に必要になる項目

- GCP プロジェクト ID・リージョン確定
- Artifact Registry / Container Registry 有効化
- `docker build` + push（または Cloud Build）
- Service Account 権限設定
- Secret Manager への API キー登録（使用する場合）
- `cloud-run/pm-agent-service.template.yaml` の PLACEHOLDER を全部埋める

---

## Secret Manager を使う方針

- API キーは `.env` や Dockerfile に直書きしない
- Cloud Run サービスの環境変数として Secret Manager 参照 (`secretKeyRef`) を使う
- v0.2.3 段階では template にコメントのみ記載、有効化は Human Approval 後

---

## GitHub を正本にする方針

- 全コードは `~/kosame-dev-orchestra` を GitHub に push したものが正本
- `main` ブランチへの merge = 人間承認済み
- deploy 候補は必ず GitHub Actions success を確認してから

---

## GitHub Actions を通してから deploy 候補に進む方針

```
git push → GitHub Actions (verify + pm-agent:cloud-run-preflight) → ✅ → Human Approval → deploy
```

CI が落ちている状態では deploy しない。

---

## deploy 前後で同じ fixture & client を使う方針

```bash
# ローカル確認
node tools/pm-agent-http-client.js http://127.0.0.1:8080

# deploy 後確認（baseUrl を切り替えるだけ）
node tools/pm-agent-http-client.js https://SERVICE_URL
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

fixture は `fixtures/pm-agent/` に3種類。ローカルで通れば Cloud Run でも通る。

---

## じゅんやさんをコピペ作業員にしない思想

AI が「これをコピペしてください」と出力する形は取らない。

- コマンドは `tools/pm-agent-deploy-command-generator.js` が生成して提示する
- チェックリストは `tools/pm-agent-cloud-run-preflight.js` が自動確認する
- じゅんやさんは「承認する / しない」だけを判断すればよい

---

## 危険箇所だけガードして爆速で進める方針

v0.2.3 で「絶対にやらないこと」:

- APIを実行しない（fetch / OpenAI / Gemini）
- deployしない（gcloud run deploy 実行しない）
- docker build しない
- Secret 値を読まない
- .env を読まない
- git push / git tag しない
- npm install しない（CI でも実行しない）

それ以外: Dockerfile / template / preflight / docs / smoke は全部一気に実装する。

---

## v0.3.0 以降の候補

| ステップ | 内容 |
|---|---|
| v0.3.0 | Human Approval → Cloud Run deploy 実行 |
| v0.3.1 以降 | n8n 接続 / `dryRunOnly: false` 移行 / Secret Manager 完全接続 |
