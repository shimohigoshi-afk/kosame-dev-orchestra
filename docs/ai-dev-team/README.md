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
| `agent-interface-v0.1.2.md` | エージェント共通インターフェース定義 | 実装済み（v0.1.2） |
| `agent-api-wiring-v0.1.3.md` | API Wiring Preparation 設計 | 実装済み（v0.1.3）— 実接続 disabled |
| `gpt-agent-task-packet-v0.1.2.md` | GPT タスクパケット形式 | 実装済み（v0.1.2） |
| `gemini-agent-task-packet-v0.1.2.md` | Gemini タスクパケット形式（v0.1.2更新） | 実装済み（v0.1.2） |
| `agent-live-call-gate-v0.1.4.md` | Live Call Gate 設計・ルール定義 | 実装済み（v0.1.4） |
| `agent-live-call-implementation-v0.1.5.md` | OpenAI/Gemini live-call 実装設計・ルール定義 | 実装済み（v0.1.5） |
| `secret-api-key-injection-guide-v0.1.6.md` | APIキー安全注入ガイド・禁止ルール | 実装済み（v0.1.6） |
| `one-shot-live-call-checklist-v0.1.6.md` | one-shot live call 実行前チェックリスト | 実装済み（v0.1.6） |
| `openai-one-shot-success-record-v0.1.7.md` | OpenAI one-shot live call 成功記録 | 実装済み（v0.1.7） |
| `gemini-one-shot-success-record-v0.1.8.md` | Gemini one-shot live call 成功記録 | 実装済み（v0.1.8） |

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
| Agent Interface Scaffold | 実装済み（v0.1.2） |
| Agent API Wiring Preparation | 実装済み（v0.1.3）— GPT/Gemini 実接続は disabled |
| Agent Live Call Gate | 実装済み（v0.1.4）— liveCallsActuallyEnabled=false 固定 |
| OpenAI/Gemini live-call implementation | 実装済み（v0.1.5）— 通常 dry-run・--live+gate条件必須 |
| Secret / APIキー注入ガイド & preflight ツール | 実装済み（v0.1.6）— API呼び出しなし・安全準備のみ |
| OpenAI one-shot live call 成功記録 | 実装済み（v0.1.7）— Human Approval のもと 1 回成功済み |
| Gemini one-shot live call 成功記録 | 実装済み（v0.1.8）— Human Approval のもと 1 回成功済み |
| 軽量モデルルーティング方針を provider-config に正式反映 | v0.1.9 候補（今回の作業では実行しない） |
| Cloud Run PM Agent | v0.2.0 以降候補 |
