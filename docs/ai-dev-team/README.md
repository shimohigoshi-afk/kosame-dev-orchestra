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
| `lightweight-model-routing-v0.1.9.md` | 軽量モデルルーティング方針 | 実装済み（v0.1.9） |
| `cloud-run-pm-agent-foundation-v0.2.0.md` | Cloud Run PM Agent foundation 設計 | 実装済み（v0.2.0） |
| `http-dry-run-intake-v0.2.1.md` | HTTP dry-run intake 設計 | 実装済み（v0.2.1） |
| `http-request-fixtures-local-client-v0.2.2.md` | HTTP request fixtures & local smoke client 設計 | 実装済み（v0.2.2） |
| `cloud-run-launch-pack-max-v0.2.3.md` | Cloud Run Launch Pack MAX 全体設計 | 実装済み（v0.2.3） |
| `cloud-run-deploy-runbook-v0.2.3.md` | Cloud Run deploy 手順書（Human Approval 後） | 実装済み（v0.2.3） |
| `cloud-run-rollback-runbook-v0.2.3.md` | Cloud Run rollback 方針・手順書 | 実装済み（v0.2.3） |
| `cloud-run-human-approval-packet-v0.2.3.md` | じゅんやさん向け承認パケット | 実装済み（v0.2.3） |
| `cloud-run-release-checklist-v0.2.3.md` | Cloud Run release チェックリスト | 実装済み（v0.2.3） |
| `cloud-run-deploy-execution-pack-v0.3.0.md` | Deploy Execution & Runtime Ops Pack 全体設計 | 実装済み（v0.3.0） |
| `cloud-run-first-deploy-approval-v0.3.0.md` | じゅんやさん向け初回 deploy 承認チェックリスト | 実装済み（v0.3.0） |
| `cloud-run-post-deploy-verification-v0.3.0.md` | deploy 後確認手順 | 実装済み（v0.3.0） |
| `cloud-run-runtime-ops-pack-v0.3.0.md` | runtime 運用ガイド（billing・監視・スケーリング） | 実装済み（v0.3.0） |
| `cloud-run-incident-response-v0.3.0.md` | インシデント対応ガイド（P1/P2/P3） | 実装済み（v0.3.0） |
| `cloud-run-redeploy-decision-guide-v0.3.0.md` | 再 deploy 判断ガイド | 実装済み（v0.3.0） |
| `n8n-cloud-run-connection-readiness-v0.3.0.md` | n8n 接続設計・準備ガイド | 実装済み（v0.3.0） |
| `webhook-intake-security-checklist-v0.3.0.md` | webhook セキュリティチェックリスト | 実装済み（v0.3.0） |
| `external-caller-contract-v0.3.0.md` | 外部呼び出しコントラクト定義 | 実装済み（v0.3.0） |
| `first-cloud-run-deploy-execution-v0.4.0.md` | v0.4.0 初回 Cloud Run deploy 実行手順（じゅんやさん実行） | 実装済み（v0.4.0） |
| `first-cloud-run-deploy-result-record-v0.4.1.md` | v0.4.1 deploy 結果記録テンプレート（deploy 後に記録） | 実装済み（v0.4.1） |
| `cloud-run-url-smoke-record-v0.4.1.md` | Cloud Run URL smoke 記録テンプレート | 実装済み（v0.4.1） |
| `cloud-run-first-deploy-troubleshooting-v0.4.1.md` | 初回 deploy トラブルシューティングガイド | 実装済み（v0.4.1） |
| `cloud-run-n8n-first-connection-v0.4.2.md` | n8n 初回接続手順・設定ガイド | 実装済み（v0.4.2） |
| `webhook-first-connection-result-record-v0.4.2.md` | webhook / n8n 接続結果記録テンプレート | 実装済み（v0.4.2） |
| `cloud-run-secret-manager-readiness-v0.4.2.md` | Secret Manager 準備ガイド（名前のみ・値閲覧禁止） | 実装済み（v0.4.2） |
| `cloud-run-production-cutover-notes-v0.4.2.md` | 本番移行メモ・Go/No-Go チェックリスト・monitoring 計画 | 実装済み（v0.4.2） |
| `claude-code-approval-policy-v0.4.3.md` | Claude Code 承認ポリシー（Allowed/Ask/Deny） | 実装済み（v0.4.3） |
| `yes-hell-reduction-guide-v0.4.3.md` | YES地獄削減ガイド（自律実行・Batching） | 実装済み（v0.4.3） |
| `approval-gate-risk-matrix-v0.4.3.md` | 承認ゲート・リスクマトリックス（L1-L4） | 実装済み（v0.4.3） |
| `safe-ask-deny-command-policy-v0.4.3.md` | 具体的なコマンド実行可否リスト | 実装済み（v0.4.3） |
| `multi-agent-task-packet-v0.4.4.md` | 共通タスクパケット形式（v0.4.4） | 実装済み（v0.4.4） |
| `agent-role-routing-policy-v0.4.4.md` | エージェント・ロール・ルーティング方針 | 実装済み（v0.4.4） |
| `gemini-agent-task-packet-v0.4.4.md` | Gemini エージェント専用パケット定義（v0.4.4） | 実装済み（v0.4.4） |
| `claude-code-fix-packet-v0.4.4.md` | Claude Code 専用修正パケット定義（v0.4.4） | 実装済み（v0.4.4） |
| `gemini-agent-dev-policy-v0.4.5.md` | Gemini エージェント開発ポリシー（量産・下読み） | 実装済み（v0.4.5） |
| `claude-code-dev-policy-v0.4.5.md` | Claude Code 開発ポリシー（修復・仕上げ） | 実装済み（v0.4.5） |
| `kosame-pm-review-policy-v0.4.5.md` | PM Agent レビュー・統合ポリシー | 実装済み（v0.4.5） |
| `claude-fix-handoff-v0.4.6.md` | エラー修復の Claude Handoff 手順 | 実装済み（v0.4.6） |
| `verify-failure-triage-v0.4.6.md` | エラー自動仕分け（Triage）ロジック | 実装済み（v0.4.6） |
| `bug-repair-routing-guide-v0.4.6.md` | バグ修復ルーティングガイド | 実装済み（v0.4.6） |
| `pm-agent-runtime-monitoring-v0.4.7.md` | Cloud Run PM Agent 運用監視設計 | 実装済み（v0.4.7） |
| `runtime-health-signal-guide-v0.4.7.md` | Runtime Health Signal ガイド | 実装済み（v0.4.7） |
| `runtime-log-review-packet-v0.4.7.md` | ログレビューパケット形式 | 実装済み（v0.4.7） |
| `cost-control-routing-extension-v0.4.8.md` | コスト管理・ルーティング拡張設計 | 実装済み（v0.4.8） |
| `lightweight-model-cost-policy-v0.4.8.md` | 軽量モデル・コストポリシー | 実装済み（v0.4.8） |
| `expensive-model-escalation-policy-v0.4.8.md` | 高額モデル・エスカレーション基準 | 実装済み（v0.4.8） |
| `release-governance-v0.4.9.md` | リリース・ガバナンス設計 | 実装済み（v0.4.9） |
| `versioning-and-changelog-policy-v0.4.9.md` | バージョン・チェンジログ方針 | 実装済み（v0.4.9） |
| `human-approval-release-packet-v0.4.9.md` | リリース承認用パケット形式 | 実装済み（v0.4.9） |
| `dev-orchestra-operator-console-foundation-v0.5.0.md` | Operator Console 基盤設計 | 実装済み（v0.5.0） |
| `operator-command-map-v0.5.0.md` | オペレーター・コマンドマップ | 実装済み（v0.5.0） |
| `operator-dashboard-data-contract-v0.5.0.md` | ダッシュボード・データ定義 | 実装済み（v0.5.0） |

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

## v0.5.0 時点のステータス

**KOSAME Dev Orchestra 基盤完成**: v0.1.0 から v0.5.0 までの全 68 ファイルを整備完了。

| バージョン | ハイライト | 状態 |
|---|---|---|
| v0.1.x | 基本設計・エージェントインターフェース | 完了 |
| v0.2.x | Cloud Run PM Agent / Launch Pack | 完了 |
| v0.3.x | Deploy Execution / Runtime Ops | 完了 |
| v0.4.0-0.4.2 | First Deploy / Connection / Production Readiness | 完了 |
| v0.4.3-0.4.6 | Governance / Multi-Agent / Failure Repair | 完了 |
| v0.4.7-0.4.9 | Monitoring / Cost Control / Release Governance | 完了 |
| v0.5.0 | Operator Console Foundation | 完了 |
