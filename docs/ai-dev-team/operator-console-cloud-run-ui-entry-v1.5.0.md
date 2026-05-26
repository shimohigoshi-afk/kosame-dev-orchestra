# Operator Console Cloud Run UI Entry v1.5.0

## 概要
v2.1.x 以降で実装予定の Cloud Run ベース Web UI エントリーポイント設計。

## 設計方針
- Cloud Run 上の Express サーバー
- Operator Console の全コマンドを HTTP エンドポイントで提供
- 認証は Cloud IAM / Identity-Aware Proxy

## 想定エンドポイント（v2.1.x 計画）

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/status` | GET | 現在状態取得 |
| `/next` | GET | 次アクション提示 |
| `/approval` | GET | 承認待ち一覧 |
| `/handoff` | POST | 引き継ぎ文書生成 |
| `/dashboard` | GET | ダッシュボードスナップショット |

## 制約
- v2.0.0 時点では未実装（設計のみ）
- 実装は Gemini quota 回復後または別セッションで実施
- Human Approval Gate は Web UI でも維持

## 実装前提条件
- Cloud Run サービスが稼働中
- IAP 設定完了
- じゅんやさんの実装承認
