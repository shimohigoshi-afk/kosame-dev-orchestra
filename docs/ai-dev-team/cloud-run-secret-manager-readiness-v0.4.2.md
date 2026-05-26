# Cloud Run Secret Manager Readiness — v0.4.2

## 概要

Cloud Run PM Agent の Secret Manager 接続準備ガイド。

**Secret Manager の値はじゅんやさんのみが GCP Console で確認・設定する。**
**AIは Secret 値を読み取らない・表示しない・コードに含めない。**
**全操作は Human Approval 後にじゅんやさんが実施する。**

readiness チェック生成: `node tools/pm-agent-secret-manager-readiness-pack.js`

---

## readiness チェックリスト

- [ ] Secret Manager: 必要な Secret が登録済み（GCP Console で確認）
- [ ] IAM: Cloud Run SA に Secret Manager Secret Accessor ロール付与済み
- [ ] template.yaml: secretKeyRef セクションを人間が確認・有効化済み
- [ ] deploy 後: GCP Console で env var 参照を確認済み
- [ ] じゅんやさんの承認（Human Approval）

---

## 登録が必要な Secret 名

以下の Secret 名を GCP Console → Secret Manager で確認する（値は GCP Console でのみ確認）:

| Secret 名 | 用途 | 必要性 |
|---|---|---|
| OPENAI_API_KEY | OpenAI API 呼び出し | OpenAI 利用時のみ |
| GEMINI_API_KEY | Gemini API 呼び出し | Gemini 利用時のみ |

**禁止事項:**
- Secret 値をコードに直接記述しない
- Secret 値を Git にコミットしない
- Secret 値をこのドキュメントや任意のログに記録しない
- AI に Secret 値を渡さない

---

## IAM 設定

Cloud Run のサービスアカウントに以下のロールが必要:

| 項目 | 値 |
|---|---|
| SA | Cloud Run default SA (または custom SA) |
| 必要ロール | Secret Manager Secret Accessor |
| 確認方法 | GCP Console → IAM → プロジェクト → Service Account |

IAM 設定は Human Approval 後にじゅんやさんが GCP Console から実施する。

---

## cloud-run/pm-agent-service.template.yaml の secretKeyRef 設定

Secret Manager を参照するには `secretKeyRef` を使用する（値を直接記述しない）:

```yaml
# Uncomment セクションを有効化（人間が確認・編集する）
# env:
#   - name: OPENAI_API_KEY
#     valueFrom:
#       secretKeyRef:
#         name: OPENAI_API_KEY
#         key: latest
#   - name: GEMINI_API_KEY
#     valueFrom:
#       secretKeyRef:
#         name: GEMINI_API_KEY
#         key: latest
```

`--set-env-vars` で Secret 値を直接渡してはならない。必ず `secretKeyRef` を使用する。

---

## 設定手順（じゅんやさんが実施）

1. GCP Console → Secret Manager を開く
2. 必要な Secret を作成する（名前のみ確認、値は人間のみ入力）
3. Cloud Run SA に Secret Manager Secret Accessor ロールを付与
4. `cloud-run/pm-agent-service.template.yaml` の secretKeyRef セクションを有効化
5. deploy 後: GCP Console → Cloud Run → service で env var が正しく参照されていることを確認

---

## deploy 後の確認

deploy 後は GCP Console で以下を確認する:

1. Cloud Run → service → Edit → Environment variables
2. `OPENAI_API_KEY` / `GEMINI_API_KEY` が secretKeyRef で参照されているか確認
3. secret の version が `latest` になっているか確認

---

## 参考

- `tools/pm-agent-secret-manager-readiness-pack.js` — readiness チェック生成
- `docs/ai-dev-team/secret-api-key-injection-guide-v0.1.6.md` — Secret 注入ガイド
- `cloud-run/pm-agent-service.template.yaml` — service 定義テンプレート
- `docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md` — 本番移行メモ
