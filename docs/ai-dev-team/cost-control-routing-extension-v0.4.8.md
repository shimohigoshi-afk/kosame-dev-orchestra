# Cost Control & Routing Extension — v0.4.8

## 概要

v0.4.8 で導入される、AI モデルの利用コスト最適化とルーティング拡張。
軽量モデル（Gemini Flash 等）の積極活用と、高コストモデル（Gemini Pro 等）へのエスカレーションルールを定義する。

---

## 基本ルーティング戦略

| タスク種別 | 推奨モデル | 理由 |
|---|---|---|
| 定型処理 / 変換 | `gemini-1.5-flash` | 低レイテンシ・低コスト |
| ドキュメント生成 | `gemini-1.5-flash` | 大規模コンテキスト対応・高速 |
| 複雑な推論 / 分析 | `gemini-1.5-pro` | 高い論理的推論能力が必要な場合のみ |
| コード修正提案 | `gemini-1.5-pro` | 精度重視 |

---

## コスト制御ツール

```bash
# コスト制御ルーティングパケット生成
node tools/cost-control-routing-extension-pack.js
```

---

## 運用ポリシー

1. **Flash First**: 全てのタスクは原則として Flash モデルで試行する。
2. **自動判定**: エージェントが Flash での解決が困難と判断した場合、エスカレーションポリシーに従い Pro モデルへ移行する。
3. **予算閾値**: 月間の合計コストが予算の 80% に達した場合、Pro モデルの使用を一時停止し、全てのルーティングを Flash に強制する。

---

## 参考

- `docs/ai-dev-team/lightweight-model-cost-policy-v0.4.8.md` — 軽量モデル活用指針
- `docs/ai-dev-team/expensive-model-escalation-policy-v0.4.8.md` — 高コストモデル昇格基準
- `docs/ai-dev-team/lightweight-model-routing-v0.1.9.md` — 初期ルーティング設計
