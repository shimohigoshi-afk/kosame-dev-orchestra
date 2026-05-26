# First Cloud Run Deploy Result Record — v0.4.1

## 概要

v0.4.0 Cloud Run 初回 deploy 結果記録。

**v0.4.0 deploy 実行後にこのファイルを上書き・追記して記録を残す。**
テンプレート生成: `node tools/pm-agent-first-deploy-result-template.js`

---

## deploy 基本情報

| 項目 | 値 |
|---|---|
| deploy バージョン | v0.4.0 |
| 記録バージョン | v0.4.1 |
| 実行日時 | YYYY-MM-DD HH:MM:SS |
| 実行者 | じゅんやさん (Cloud Shell) |
| commit | COMMIT_HASH_PLACEHOLDER |
| service name | pm-agent |
| region | asia-northeast1 |
| project ID | PROJECT_ID_PLACEHOLDER |
| Cloud Run URL | https://SERVICE_URL_PLACEHOLDER |
| image URL | gcr.io/PROJECT_ID/pm-agent:VERSION_PLACEHOLDER |

---

## deploy コマンド記録

```bash
# 実行したコマンドをここに記録
gcloud run deploy pm-agent ...
```

deploy ステータス: `PENDING (success / failed)`

---

## smoke 結果

| チェック | 結果 |
|---|---|
| GET /health → 200 | PENDING |
| GET /health body.status === ok | PENDING |
| GET /info → 200 | PENDING |
| GET /info body.dryRunOnly === true | PENDING |
| POST /dry-run-task (implementation) → claude_code | PENDING |
| POST /dry-run-task (critical) → blocked: true | PENDING |
| 全体: success | PENDING |

smoke 実行コマンド: `node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL`

---

## GitHub Actions 結果

| 項目 | 値 |
|---|---|
| ワークフロー | pm-agent-launch-readiness |
| 結果 | PENDING (success / failure) |
| run URL | https://github.com/OWNER/REPO/actions/runs/RUN_ID |

---

## billing 確認

| 項目 | 状況 |
|---|---|
| 確認日時 | YYYY-MM-DD |
| 予期しない課金 | PENDING (none / amount) |
| 予算アラート設定 | PENDING (done / todo) |

---

## rollback 必要性

- rollback 必要: PENDING (no / yes)
- rollback 理由（yes の場合）: PENDING

---

## 問題・備考

PENDING (none / 問題があれば記録)

---

## 次アクション

PENDING (v0.4.1 記録完了後の次ステップを記録)

候補:
- n8n 接続テスト（Human Approval 後）
- `dryRunOnly: false` 移行設計（v0.5.0 候補）
- Secret Manager 本格接続（v0.5.0 候補）
- 認証追加（Cloud Run Invoker）
