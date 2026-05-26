# Operator Console Next Implementation Plan (v1.0.0)

## フェーズ 1: Local HTTP API 実装 (v1.1.x)
- Express 等を用いたローカルサーバーの構築。
- `operator-console-endpoints-v0.9.0.md` に基づく各エンドポイントの実装。
- ローカルファイル (`fixtures/*.json`) との連携。

## フェーズ 2: Web UI (React/Vite) 実装 (v1.2.x)
- `operator-console-ui-spec-v0.9.1.md` に基づく画面実装。
- Tailwind CSS または Vanilla CSS を用いたモダンなダークテーマ UI。
- API 経由でのリアルタイム状態表示と、承認操作の実現。

## フェーズ 3: Cloud Run デプロイと IAP 連携 (v1.3.x)
- コンテナ化と Google Cloud Run へのデプロイ。
- Identity-Aware Proxy (IAP) によるセキュアなアクセス管理。
- 本番環境の状態監視の統合。
