# Operator State File (v0.7.1)

## 概要
Operator State File は、現在の開発・運用状況を可視化し、エージェント間や人間（こさめPM、じゅんやさん）との共有を円滑にするための状態管理ファイルである。

## 管理項目
- `currentVersion`: 現在のプロジェクトバージョン
- `currentPhase`: 現在のフェーズ (e.g., Development, Verification, Production)
- `lastCommit`: 最後に記録されたコミットハッシュ（任意）
- `workflowStatus`: 現在のワークフロー状況 (e.g., Idle, InProgress, Paused, Blocked)
- `pendingApproval`: 承認待ち項目の有無と内容
- `nextAction`: 次に実行すべき推奨アクション
- `activeAgent`: 現在稼働中のエージェント (e.g., Gemini, Claude, None)
- `riskLevel`: 現在の操作リスクレベル (e.g., Low, Medium, High)

## 運用ルール
- 状態ファイルは `fixtures/operator-state.json` (実機運用時) または sample を参照する。
- Secret値やAPIキーは絶対に含めない。
- 各ツール実行後、必要に応じて状態を更新する。
