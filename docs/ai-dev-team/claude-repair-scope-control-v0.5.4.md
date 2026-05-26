# Claude Repair Scope Control (v0.5.4)

## スコープ制御
Claude Code に補修を依頼する際、不必要なファイル変更を防ぐためにスコープを制御する。

### 許可リスト (Target Files)
- 修正が必要なコードファイル
- 対応するテストファイル

### 禁止リスト (Prohibited Files)
- `.env` ファイル
- `package.json` (こさめ PM の許可なく変更禁止)
- `README.md` (補修作業中の更新は原則不要)
- `GEMINI.md` / `MEMORY.md`

### 境界線 (Boundaries)
- 既存のアーキテクチャを大きく変えるリファクタリングは禁止。
- 報告されたエラーの修正のみに集中する。
