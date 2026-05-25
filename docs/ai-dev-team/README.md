# docs/ai-dev-team — ドキュメント目次

KOSAME Dev Orchestra の設計書・方針文書を管理するディレクトリ。

---

## ファイル一覧と役割

| ファイル | 役割 | 状態 |
|---|---|---|
| `KOSAME_DEV_ORCHESTRA_SPEC_v0.1.0.md` | 全体仕様・ロードマップ・バージョン体系 | 実装済み |
| `permission-policy-v0.1.0.md` | Claude Code 権限方針（許可・Human Approval・禁止） | 実装済み |
| `claude-code-command-batching-v0.1.0.md` | Command Batching 方針・完了報告テンプレート | 実装済み |
| `role-map-v0.1.0.md` | 役割分担マップ（1枚で全体把握） | 実装済み |
| `operating-flow-v0.1.0.md` | 開発フロー定義（作業開始〜deploy 承認） | 実装済み |
| `reuse-guide-v0.1.0.md` | 他プロジェクトへの流用ガイド | 実装済み |
| `project-handoff-template-v0.1.0.md` | 引き継ぎテンプレート（新チャット・別プロジェクト用） | 実装済み |
| `gemini-agent-task-packet-v0.1.0.md` | Gemini タスクパケット形式・チェックリスト | 実装済み |

---

## 新プロジェクトへの適用時の読み順

1. `role-map-v0.1.0.md` — 誰が何をするか把握
2. `operating-flow-v0.1.0.md` — 実際の作業フローを把握
3. `permission-policy-v0.1.0.md` — Claude Code への権限設定
4. `reuse-guide-v0.1.0.md` — 流用の3点セットを確認
5. `project-handoff-template-v0.1.0.md` — テンプレートに情報を埋める

---

## 各ロールと担当ツール

| ロール | 担当ツール | 主な責務 |
|---|---|---|
| じゅんやさん | Claude Code CLI / ブラウザ | 最終判断・Human Approval |
| こさめ PM | Claude API / チケット形式 | 設計・切り分け・安全ゲート |
| Gemini Agents | Gemini API | 下読み・要約・GCP 観点レビュー |
| Claude Code | Claude Code CLI | 実装・差分作成・verify 実行 |
| GitHub Actions | `.github/workflows/` | verify / smoke 自動化 |
| Cloud Run | GCP | 実行基盤 |
| GitHub | `~/kosame-dev-orchestra` 等 | 正本管理 |
| Secret Manager | GCP | 秘密情報保管 |
| GCS / Firestore | GCP | 成果物保存・状態管理 |
| n8n | n8n instance | 配線盤（ジョブ配布） |

---

## v0.1.0 時点のステータス

| 機能 | 状態 |
|---|---|
| permission-policy 定義 | 実装済み |
| command batching 方針 | 実装済み |
| role-map | 実装済み |
| operating-flow | 実装済み |
| reuse-guide | 実装済み |
| project-handoff-template | 実装済み |
| gemini-agent-task-packet | 実装済み（方針のみ） |
| GitHub Actions verify | 実装済み（v0.1.1） |
| Gemini API 実接続 | v0.1.3 候補 |
| Cloud Run PM Agent | v0.2.0 以降候補 |
