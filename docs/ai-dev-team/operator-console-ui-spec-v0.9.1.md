# Operator Console UI Spec (v0.9.1)

## 概要
Operator Console UI Spec は、将来的に開発する Web UI の要件と設計指針をまとめたものである。

## 主要機能
- **Status Dashboard**: プロジェクトの状態、リスク、エージェント稼働状況を俯瞰。
- **Approval Board**: 承認待ち項目の確認と意思決定の送信。
- **Action Center**: 次に実行すべきコマンドのコピーや、Handoff 生成。
- **Verification History**: 検証結果の履歴確認と、エラー箇所の特定補助。

## 設計指針
- **Minimalist**: 必要な情報のみを表示し、判断を迷わせない。
- **Action-Oriented**: 次に何をすべきかが常に一目でわかるようにする。
- **Visual Feedback**: リスクレベルやステータスを色（緑、黄、赤）で強調。
