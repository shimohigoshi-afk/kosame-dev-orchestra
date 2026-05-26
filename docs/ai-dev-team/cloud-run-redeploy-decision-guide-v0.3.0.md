# Cloud Run Redeploy Decision Guide — v0.3.0

## 概要

Cloud Run PM Agent の再 deploy（redeploy）判断ガイド。
初回 deploy 後に問題が発生した場合、または機能追加時の redeploy 判断基準を定義する。

**Human Approval のもと deploy 実行後に参照する。v0.3.0 では実行しない。**

---

## redeploy が必要なケース

| トリガー | redeploy 種別 | Human Approval |
|---|---|---|
| smoke 失敗（バグ修正後） | 新コード + redeploy | 必要 |
| 機能追加（dryRunOnly: false 移行等） | 新バージョン deploy | 必要 |
| Secret Manager 設定変更 | 設定更新 + redeploy | 必要 |
| インスタンス数変更 | 設定変更のみ | 必要 |
| rollback → 再修正後 | 新コード + redeploy | 必要 |

---

## redeploy しない（rollback で対応する）ケース

| 状況 | 推奨アクション |
|---|---|
| 新 revision がクラッシュ | 旧 revision へ rollback |
| smoke 全失敗（すぐに直らない） | 旧 revision へ rollback して調査 |
| billing スパイク（原因不明） | サービス停止 → 調査 → redeploy |

---

## redeploy 前チェックリスト

```bash
# 1. ローカルで全 smoke が通ることを確認
npm run verify

# 2. 最終確認
npm run pm-agent:deploy-readiness-final-check

# 3. smoke で修正箇所を確認
node tools/pm-agent-post-deploy-smoke.js http://127.0.0.1:8080
```

---

## redeploy 手順

1. コード修正 → `npm run verify` で全 smoke PASS を確認
2. `npm run pm-agent:deploy-readiness-final-check` で `readyForHumanDeploy: true`
3. Human Approval（じゅんやさん）
4. `node tools/pm-agent-first-deploy-command-pack.js` でコマンド確認
5. Cloud Shell で `gcloud builds submit` → `gcloud run deploy`
6. `node tools/pm-agent-post-deploy-smoke.js <NEW_SERVICE_URL>` で確認
7. 結果を `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` に記録

---

## バージョン管理方針

| 変更規模 | バージョン |
|---|---|
| バグ修正・軽微な変更 | v0.4.x |
| 機能追加（dryRunOnly: false 等） | v0.5.0 |
| アーキテクチャ変更 | v1.0.0 |

---

## 参考

- `tools/pm-agent-first-deploy-command-pack.js` — deploy コマンドパック
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — インシデント対応
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 手順
