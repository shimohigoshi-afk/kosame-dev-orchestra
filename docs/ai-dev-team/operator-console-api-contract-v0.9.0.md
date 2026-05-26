# Operator Console API Contract (v0.9.0)

## 概要
Operator Console API Contract は、将来的に Cloud Run やローカル HTTP サーバーとして稼働するコンソール API のインターフェース定義である。

## 基本方針
- **RESTful**: 標準的な HTTP メソッドを使用。
- **JSON**: すべてのやり取りは JSON 形式。
- **Read-Only First**: 初期段階では参照系 (GET) を中心に実装し、更新系 (POST/PUT) は厳格な承認を必要とする。

## 目的
- UI 実装者がバックエンドの実装を待たずに開発できるようにする。
- ローカルツールとクラウド上の API で同じデータ構造を共有する。
