# Operator Dashboard Data (v0.7.2)

## 概要
Operator Dashboard Data は、将来的に Web UI や CLI 操作盤で表示するためのデータを集約・整形したものである。

## データ構造
- `summary`: プロジェクト全体の要約（バージョン、ステータス、リスクレベル）。
- `cards`: 各種情報を表示するためのウィジェット（カード）リスト。
- `actions`: 推奨される次の操作ボタンやコマンド。

## 目的
- UI 実装前にデータ契約（API Contract）を固定し、一貫性を保つ。
- 複数のソース（State, Decision Log, Verify Result）から情報を集約する。
