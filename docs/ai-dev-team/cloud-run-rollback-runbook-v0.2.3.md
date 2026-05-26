# Cloud Run Rollback Runbook — v0.2.3

**v0.2.3 段階では deploy しない。このドキュメントは v0.3.0 以降で deploy 後に異常が発生した場合の rollback 方針。**

---

## rollback を判断するトリガー

以下のいずれかが発生した場合、直ちに rollback を検討する:

| トリガー | 判断 |
|---|---|
| `GET /health` が非 200 を返す | 即 rollback |
| `POST /dry-run-task` が予期しないエラーを返す | 即 rollback |
| Cloud Run revision が unhealthy | 即 rollback |
| 想定外の billing 急増 | サービス停止 → 確認 |
| smoke テストが FAIL | 即 rollback |
| レスポンスタイムが著しく劣化 | 調査 → 判断 |

---

## rollback の考え方

Cloud Run は revision ベースのトラフィック管理。

```
旧 revision (stable) ←→ 新 revision (問題あり)
                      ↑
               ここをトラフィック切替で rollback
```

**デプロイ前の revision ID を必ず記録しておくこと。**

---

## rollback 手順

### Step 1: revision 一覧確認

```bash
gcloud run revisions list \
  --service SERVICE_NAME \
  --region REGION \
  --project PROJECT_ID
```

→ 旧 revision ID を確認する（例: `kosame-pm-agent-00001-abc`）

### Step 2: 旧 revision に 100% トラフィックを戻す

```bash
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions PREVIOUS_REVISION=100 \
  --region REGION \
  --project PROJECT_ID
```

**この操作は Human Approval が必要。じゅんやさんが判断する。**

### Step 3: rollback 後 smoke 確認

```bash
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

smoke が全 PASS になったことを確認する。

---

## post-deploy smoke 失敗時の判断フロー

```
smoke FAIL
  ↓
GET /health 確認
  ↓ 非 200 → 即 rollback
  ↓ 200 → POST /dry-run-task で詳細確認
      ↓ decision エラー → routing ロジック確認 → rollback 判断
      ↓ 正常 → smoke の fixture 問題か確認
```

---

## 人間承認が必要な境界

| 操作 | 必要 |
|---|---|
| smoke 実行（ローカル） | 不要（AI が実行可） |
| smoke 実行（Cloud Run URL） | 不要（AI が実行可） |
| トラフィック切替（rollback） | **必要**（じゅんやさん承認） |
| revision 削除 | **必要**（じゅんやさん承認） |
| サービス停止 | **必要**（じゅんやさん承認） |
| Secret Manager の値変更 | **必要**（じゅんやさん承認） |
| billing 関連操作 | **必要**（じゅんやさん承認） |

---

## rollback 記録

rollback を実施した場合、以下を記録する:

- rollback 日時
- トリガーとなった事象
- 戻した revision ID
- rollback 後の smoke 結果
- 対応者: じゅんやさん

---

## 禁止事項

- AI が単独で rollback コマンドを実行しない
- Secret や billing に触れない
- rollback 後に問題の原因を特定するまで再 deploy しない
