# KOSAME Dev Orchestra External SE Review Packet v51.0.0

## 概要

外部SEに「全部作ってください」と渡すのではなく、「この危険箇所だけレビューしてください」と渡せるReview Packetを生成するpackです。

## 背景と目的

v50まででKOSAME Dev Orchestraは「動かせる」状態に到達しました。
次のステップは「外注SE依存を下げる」ことです。

通常開発の80〜90%をKOSAME Dev Orchestraで内製し、残り10%を外部SE・専門家レビューに回す設計にします。

## 外部SEの役割定義

| 役割 | 説明 |
|------|------|
| **外部SE / 監査担当** | 「最後の危険箇所を見る監査役」 |
| NG | 「全部作ってもらう人」 |

## Review Scope (外部SEに依頼する範囲)

- security design
- personal data handling
- insurance/customer data boundary
- Cloud Run / Secret Manager / IAM
- database schema
- authentication / authorization
- production readiness
- incident recovery

## Out of Scope (外部SEに依頼しない範囲)

- docs-only wording changes
- minor smoke test additions
- README updates
- fixture / dry-run packet additions
- git commit / push / tag execution (代行)
- deploy execution (代行)
- Secret値の閲覧・操作

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- 全DANGER GATES BLOCKED
- じゅんやさんが最終YES担当

## 使用方法

```bash
npm run pm-agent:external-se-review-packet
npm run smoke:external-se-review-packet
```

## 関連Pack

- v52.0.0 Security Review Checklist
- v53.0.0 Production Go/No-Go Review
- v55.0.0 External Review Handoff Complete
