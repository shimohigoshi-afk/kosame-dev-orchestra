# PM Agent Runtime Monitoring — v0.4.7

## 概要

v0.4.7 で導入される PM Agent の継続的なランタイムモニタリング指針。
Cloud Run 上で動作するエージェントの健全性を、メトリクスとログの両面から監視する。

---

## 監視項目

| カテゴリ | 項目 | 閾値 / 確認内容 |
|---|---|---|
| 可用性 | GET /health | 成功率 99.9% 以上 |
| パフォーマンス | リクエストレイテンシ (p95) | 10秒以内（モデル推論含む） |
| 信頼性 | エラーレート (5xx) | 1% 未満 |
| リソース | CPU/Memory 使用率 | 80% 未満を維持 |
| 課金 | 日次コスト | 予算額内であることを確認 |

---

## モニタリングツール

```bash
# モニタリングチェックリスト生成
node tools/pm-agent-runtime-monitoring-pack.js
```

---

## 運用フロー

1. **日次確認**: 毎朝、前日のログとエラーレートを確認する。
2. **アラート対応**: Cloud Monitoring アラート（設定済みの場合）発生時に `runtime-health-signal-guide` を参照。
3. **週次レビュー**: パフォーマンスの傾向を確認し、必要に応じてリソース割り当てを調整。

---

## 参考

- `docs/ai-dev-team/runtime-health-signal-guide-v0.4.7.md` — 異常検知時の対応ガイド
- `docs/ai-dev-team/runtime-log-review-packet-v0.4.7.md` — ログ詳細分析パケット
- `docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md` — 基本運用操作
