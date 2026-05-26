# Operator Next 25 Percent Plan (v0.7.0)

## ロードマップ (v0.7.1 〜 v0.9.0)

### 1. 状態管理の永続化 (v0.7.x)
- Decision Log と Session Record を GCS または Firestore へ保存。
- エージェント間で状態を共有するための State API 実装。

### 2. Operator Console UI 実装 (v0.8.x)
- コマンドキューを一覧表示するダッシュボード（React/Next.js）。
- じゅんやさん向け「Yes/No ボタン」の実装。

### 3. 自動配線盤 (v0.9.x)
- n8n と連携し、GitHub Actions の失敗を自動検知して Claude Repair を起動するワークフローの構築。
- コストとリスクに基づくモデルの自動切り替え。
