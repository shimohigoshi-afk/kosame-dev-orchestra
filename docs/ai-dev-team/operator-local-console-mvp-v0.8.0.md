# Operator Local Console MVP (v0.8.0)

## 概要
Operator Local Console MVP は、これまで個別に開発してきた State, Dashboard, CLI Status, Handoff, Approval の各機能を統合し、ローカルターミナル上で一元的に操作・確認できる最小限のコンソールである。

## 統合機能
- **View Status**: 現在の状態をサマリー表示。
- **View Dashboard Data**: UI向けの整形データを表示。
- **Generate Handoff**: 作業引継ぎ資料を出力。
- **Categorize Approvals**: 承認待ち項目の分類を表示。

## 設計思想
- 「実行」ではなく「表示・生成・判断補助」に特化する。
- 状態の不整合を防ぐため、常に `fixtures/operator-state.json` を参照する。
- 複雑なUIライブラリは使わず、標準出力（console.log）をベースにする。
