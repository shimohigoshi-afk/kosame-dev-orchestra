# Agent Dispatch Queue (v0.5.2)

## 概要
Agent Dispatch Queue は、発行された Operator Command を各エージェント（Gemini / Claude / こさめ PM）や人間（じゅんやさん）へ振り分け、実行状態を管理するキューシステムである。

## キューの構成
- **Inbound**: 未処理のコマンドパケット
- **Processing**: 実行中のコマンド
- **Review**: 実行完了、承認待ちのコマンド
- **Completed / Failed / Canceled**: 終了状態

## 振り分け先 (Target Agents)
- `gemini-bulk`: 大量生成・下読み（Gemini）
- `claude-repair`: 補修・仕上げ（Claude Code）
- `kosame-pm`: 切り分け・レビュー（PM エージェント）
- `human-approval`: 最終判断（人間）
- `cloud-shell`: 検証実行（人間・CLI）
