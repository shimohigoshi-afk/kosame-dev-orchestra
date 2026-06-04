# KOSAME Dev Orchestra Security Review Checklist v52.0.0

## 概要

本番前や外部SEレビュー前に確認すべき安全項目をチェックリスト化するpackです。
24項目のチェックリストを内蔵し、category / severity / reviewer / blockerIfFailed を定義します。

## チェックカテゴリ

| カテゴリ | 主な確認内容 |
|---------|------------|
| Secret / .env / API key | git commitされていないか、ログ出力されていないか |
| IAM / permissions | 最小権限か、不要なOwner/Editorがないか |
| Cloud Run / service account | 認証設定、CPU/memory/timeout |
| GitHub Actions / secrets | workflowでsecretがログ出力されないか |
| customer data / insurance data | PII/保険情報がログに出ないか、暗号化されているか |
| logs / transcripts / uploads | 個人情報がCloud Loggingに入らないか |
| database / storage | バックアップ・アクセスルール |
| authentication / authorization | 認証バイパスリスク、認可設計 |
| deploy / rollback | Rollback手順の文書化・検証 |
| monitoring / alerting | エラー率・レイテンシアラート、オンコールrunbook |
| backup / restore | 定期バックアップ・リストアテスト |
| legal / compliance handoff | 個人情報保護法・保険業法・DPA確認 |

## overallStatus 判定ロジック

| 状態 | overallStatus |
|------|--------------|
| blockerIfFailed=true のitemがFAIL | `NOT_READY` |
| blockerIfFailed=true のitemがPENDING | `PENDING_REVIEW` |
| 全item PASS (または blockerなし) | `READY` |

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- critical/high severity の多くは `externalReviewRecommended: true`
- じゅんやさんが最終GO/NO-GO担当

## 使用方法

```bash
npm run pm-agent:security-review-checklist
npm run smoke:security-review-checklist
```

## 関連Pack

- v51.0.0 External SE Review Packet
- v53.0.0 Production Go/No-Go Review
- v55.0.0 External Review Handoff Complete
