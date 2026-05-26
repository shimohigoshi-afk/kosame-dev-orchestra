# KOSAME Dev Orchestra

**共通 AI 開発チーム OS**

KOSAME Dev Orchestra は、ANESTY Board 専用ではなく、以下すべてのプロジェクトに流用できる共通 AI 開発チーム OS です。

- ANESTY Board（Discord ボット）
- KOSAME 営業 DX
- スマホ PWA
- 議事録 DX
- 案件発掘ツール
- Cloud Run 系プロダクト

---

## このリポジトリの役割

設計書・方針文書・テンプレート・検証スクリプトを管理する。
実装コードはプロジェクト別リポジトリに置く。

---

## 大原則

**じゅんやさんをコピペ作業員にしない。**

| 役割 | 担当 |
|---|---|
| 最終判断・commit / push / deploy 承認 | じゅんやさん（Human Approval） |
| 設計・切り分け・安全ゲート | こさめ PM |
| 下読み・要約・GCP 観点レビュー | Gemini Agents |
| 実装・差分作成 | Claude Code |
| 自動検証 | GitHub Actions |

---

## ANESTY Board v87.x との分離

| 対象 | バージョン | 正本管理 |
|---|---|---|
| ANESTY Board（Discord ボット本体） | v87.0.x | `~/anesty-board` |
| KOSAME Dev Orchestra（共通 AI 開発チーム OS） | v0.1.x / v0.2.x / v1.0.0 | このリポジトリ |

これらを **混在させてはならない**。

---

## v0.1.0 ドキュメント一覧

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/KOSAME_DEV_ORCHESTRA_SPEC_v0.1.0.md` | 全体仕様・ロードマップ | 実装済み |
| `docs/ai-dev-team/permission-policy-v0.1.0.md` | Claude Code 権限方針 | 実装済み |
| `docs/ai-dev-team/claude-code-command-batching-v0.1.0.md` | Command Batching 方針 | 実装済み |
| `docs/ai-dev-team/role-map-v0.1.0.md` | 役割分担マップ | 実装済み |
| `docs/ai-dev-team/operating-flow-v0.1.0.md` | 開発フロー定義 | 実装済み |
| `docs/ai-dev-team/reuse-guide-v0.1.0.md` | 他プロジェクトへの流用ガイド | 実装済み |
| `docs/ai-dev-team/project-handoff-template-v0.1.0.md` | 引き継ぎテンプレート | 実装済み |
| `docs/ai-dev-team/gemini-agent-task-packet-v0.1.0.md` | Gemini タスクパケット形式 | 実装済み |

---

## v0.1.2 / v0.1.3 Agent Interface Scaffold

| ファイル / ディレクトリ | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/agent-interface-v0.1.2.md` | エージェント共通インターフェース定義 | 実装済み |
| `docs/ai-dev-team/agent-api-wiring-v0.1.3.md` | API Wiring Preparation 設計 | 実装済み（実接続 disabled） |
| `docs/ai-dev-team/gpt-agent-task-packet-v0.1.2.md` | GPT タスクパケット形式 | 実装済み |
| `docs/ai-dev-team/gemini-agent-task-packet-v0.1.2.md` | Gemini タスクパケット形式（v0.1.2更新） | 実装済み |
| `providers/mock-provider.js` | mock プロバイダー（ローカル応答） | 実装済み |
| `providers/gpt-provider.js` | GPT プロバイダー（実接続 disabled） | 実装済み |
| `providers/gemini-provider.js` | Gemini プロバイダー（実接続 disabled） | 実装済み |
| `tools/agent-task-packet-sample.js` | タスクパケットサンプル出力 | 実装済み |
| `tools/agent-router-dry-run.js` | 全プロバイダー dry-run ルーティング | 実装済み |
| `tools/agent-runner-local.js` | --provider= 切り替えローカル実行 | 実装済み |

**注意**: GPT / Gemini の実 API 呼び出しは未実装・disabled。有効化には Human Approval が必要。

---

## v0.1.4 Agent Live Call Gate

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/agent-live-call-gate-v0.1.4.md` | Live Call Gate 設計・ルール定義 | 実装済み |
| `providers/provider-config.js` | live call ON/OFF 判定集約 | 実装済み |
| `tools/agent-live-gate-check.js` | ゲート状態確認ツール | 実装済み |

---

## v0.1.5 OpenAI / Gemini Live-Call Implementation

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/agent-live-call-implementation-v0.1.5.md` | Live-Call 実装設計・ルール定義 | 実装済み |
| `providers/provider-config.js` | 新環境変数対応・model/maxTokens/timeoutMs 追加 | 実装済み |
| `providers/gpt-provider.js` | fetch による OpenAI 実接続コード実装 | 実装済み |
| `providers/gemini-provider.js` | fetch による Gemini 実接続コード実装 | 実装済み |
| `tools/agent-runner-local.js` | --live フラグ対応 | 実装済み |
| `tools/agent-live-call-one-shot.js` | 人間承認後 1 回限定 live call 専用ツール | 実装済み |

**通常実行は dry-run**。外部 API を実際に呼ぶには以下の **すべて** が必要：

1. `--live` フラグを明示的に指定
2. `KOSAME_AGENT_LIVE_CALLS_ENABLED=true`
3. `KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL=true`
4. 対象プロバイダーの API キーが環境変数に存在

1 つでも欠ければ dry-run で安全終了する。
**有効化には Human Approval が必要。**

---

## v0.1.6 Secret / APIキー注入ガイド & One-Shot 実行準備

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/secret-api-key-injection-guide-v0.1.6.md` | APIキー安全注入ガイド | 実装済み |
| `docs/ai-dev-team/one-shot-live-call-checklist-v0.1.6.md` | one-shot 実行前チェックリスト | 実装済み |
| `tools/agent-one-shot-preflight.js` | 実行前 gate 条件確認ツール（API呼び出しなし） | 実装済み |

**v0.1.6 は実 API 実行ではなく、安全な実行準備のためのガイドとツール群。**

- APIキー値は boolean 判定のみ（値そのものは出力しない）
- preflight ツールは外部 API を一切呼ばない
- one-shot 実行は Human Approval 後に `--live` を明示した場合のみ

---

## v0.1.7 OpenAI One-Shot Live Call 成功記録

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/openai-one-shot-success-record-v0.1.7.md` | OpenAI one-shot live call 成功記録 | 実装済み |

**OpenAI one-shot live call は Human Approval のもと 1 回成功済み。**

- preflight `readyForOneShot: true` 確認済み
- `success: true` / `provider: gpt` / `dryRun: false` / `error: null`
- APIキー値はログ・ドキュメントに記録していない
- 実行後 env cleanup 済み、git status clean を確認済み

**v0.1.7 は記録のみ。今回の作業では外部 API 実行はしない。**

---

## v0.1.8 Gemini One-Shot Live Call 成功記録

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/gemini-one-shot-success-record-v0.1.8.md` | Gemini one-shot live call 成功記録 | 実装済み |

**Gemini one-shot live call は Human Approval のもと 1 回成功済み。**

- preflight `readyForOneShot: true` 確認済み
- `success: true` / `provider: gemini` / `dryRun: false` / `error: null`
- 使用モデル: `gemini-2.5-flash-lite`（軽量モデル優先ルーティング方針）
- APIキー値はログ・ドキュメントに記録していない
- 実行後 env cleanup 済み、git status clean を確認済み

**OpenAI / Gemini 両方の実 API 接続成功に到達。**

**v0.1.8 は記録のみ。今回の作業では外部 API 実行はしない。**

---

## v0.1.9 Lightweight Model Routing

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/lightweight-model-routing-v0.1.9.md` | 軽量モデルルーティング方針 | 実装済み |
| `providers/provider-config.js` | `lightweightRoutingPolicy` 追加 | 実装済み |

**OpenAI / Gemini 両方の実接続成功後、軽量モデルルーティング方針を正式に `provider-config.js` へ反映。**

- `defaultGeminiModel`: `gemini-2.5-flash-lite`（env `KOSAME_AGENT_MODEL_GEMINI` で上書き可）
- `defaultOpenAIModel`: `gpt-4o-mini`（env `KOSAME_AGENT_MODEL_OPENAI` で上書き可）
- `bulkProcessingProvider: gemini` — 大量処理・下読み・分類・要約は Gemini 寄せ
- `reviewProvider: gpt` — 判断・レビュー・PM補助は GPT 寄せ
- `premiumReviewProvider` — 高リスク・高単価・最終レビューは env で切り替え可能
- 上位モデル（`gemini-2.5-pro` / `gpt-4o`）は env override で使用可。常用しない

**v0.1.9 は API 実行なし。today は設計のコード化のみ。**

---

## v0.2.0 Cloud Run PM Agent Foundation

| ファイル / ディレクトリ | 役割 | 状態 |
|---|---|---|
| `apps/pm-agent/pm-agent.js` | PM Agent 本体（routing decision / agent info） | 実装済み |
| `apps/pm-agent/task-packet-schema.js` | Task Packet スキーマ・バリデーション・サンプル | 実装済み |
| `apps/pm-agent/pm-agent-dry-run.js` | dry-run CLI ツール | 実装済み |
| `apps/pm-agent/README.md` | PM Agent 概要・実行方法・禁止事項 | 実装済み |
| `docs/ai-dev-team/cloud-run-pm-agent-foundation-v0.2.0.md` | PM Agent foundation 設計ドキュメント | 実装済み |

**危険箇所だけ明確にガードし、それ以外は爆速で進める方針で foundation を一気に実装。**

- `getPmAgentInfo()`: `name / version / status / plannedRuntime / sourceOfTruth / secretStore / routingPolicy` を返す
- `decideTaskRoute(taskPacket)`: task kind / riskLevel に応じた routing を dry-run で返す
  - `docs / summary / bulk_reading / classification` → `gemini` 推奨
  - `implementation / test / smoke / refactor` → `claude_code` 推奨
  - `product_decision / final_review / safety_gate` → `kosame_pm` 推奨
  - `deploy / secret / billing / production_mutation` → `human` (blocked / humanApprovalRequired)
  - `riskLevel: critical` → kind 問わず blocked
- `validateTaskPacket(taskPacket)`: 必須フィールド検証
- `createSampleTaskPacket()`: 動作確認用サンプル

**v0.2.0 は foundation-only。Cloud Run deploy なし・API 実行なし・Secret 読み取りなし。**

---

## v0.2.1 HTTP Dry-Run Intake

| ファイル | 役割 | 状態 |
|---|---|---|
| `apps/pm-agent/pm-agent-http-server.js` | HTTP サーバー（dry-run intake）| 実装済み |
| `docs/ai-dev-team/http-dry-run-intake-v0.2.1.md` | HTTP dry-run intake 設計ドキュメント | 実装済み |

**Node 標準 `http` モジュールだけで HTTP 入口を実装。Cloud Run に載せる直前構造。**

- `GET /health` → `{ status: "ok", version: "v0.2.1", mode: "http-dry-run-intake" }`
- `GET /info` → PM Agent メタ情報 + `deployStatus: "not-deployed"` / `dryRunOnly: true`
- `POST /dry-run-task` → Task Packet を受け取り `{ dryRun: true, validation, decision }` を返す
  - JSON パースエラー → 400
  - バリデーション失敗 → 200 `{ success: false, validation.errors }`
  - 成功 → 200 `{ success: true, decision.recommendedOwner, ... }`
- 未対応ルート → 404 / メソッド不一致 → 405

**v0.2.1 は deployしない。外部 API 実行なし。Secret 読み取りなし。**

---

## v0.2.2 HTTP Request Fixtures & Local Smoke Client

| ファイル | 役割 | 状態 |
|---|---|---|
| `fixtures/pm-agent/sample-implementation-task.json` | implementation 系 Task Packet fixture | 実装済み |
| `fixtures/pm-agent/sample-docs-task.json` | docs / summary 系 Task Packet fixture | 実装済み |
| `fixtures/pm-agent/sample-critical-deploy-task.json` | deploy / critical リスク Task Packet fixture（placeholder） | 実装済み |
| `tools/pm-agent-http-client.js` | ローカル HTTP クライアント（Node 標準 http/https のみ） | 実装済み |
| `docs/ai-dev-team/http-request-fixtures-local-client-v0.2.2.md` | fixture & client 設計ドキュメント | 実装済み |

**Cloud Run deploy 前後で同じ fixture & client を使い回せる検証セットを整備。**

- fixture 3 種は `validateTaskPacket` / `decideTaskRoute` で routing を検証済み
  - `implementation` → `recommendedOwner: claude_code` / `blocked: false`
  - `docs` → `recommendedOwner: gemini` / `blocked: false`
  - `deploy + critical` → `humanApprovalRequired: true` / `blocked: true`
- `tools/pm-agent-http-client.js` は `requestJson / getHealth / getInfo / postDryRunTask / runLocalClientDemo` をエクスポート
- baseUrl を切り替えるだけでローカル → Cloud Run URL に向け直せる構造

**v0.2.2 は deployしない。外部 API 実行なし。Secret 読み取りなし。**

---

## v0.2.3 Cloud Run Launch Pack MAX

| ファイル / ディレクトリ | 役割 | 状態 |
|---|---|---|
| `Dockerfile` | Cloud Run 用コンテナイメージ定義 | 実装済み |
| `.dockerignore` | Secret・.env・git 履歴などを exclude | 実装済み |
| `cloud-run/pm-agent-service.template.yaml` | Cloud Run service 定義テンプレート（placeholder 使用） | 実装済み |
| `cloud-run/README.md` | Cloud Run 設定ファイルの使い方・承認前チェックリスト | 実装済み |
| `tools/pm-agent-cloud-run-preflight.js` | deploy 前のファイル・設定・安全性チェック（実行のみ） | 実装済み |
| `tools/pm-agent-deploy-command-generator.js` | gcloud コマンド文字列生成（実行しない・文字列出力のみ） | 実装済み |
| `tools/pm-agent-post-deploy-smoke.js` | deploy 後の HTTP smoke 検証ツール（ローカルサーバーで動作確認済み） | 実装済み |
| `smoke/dev-agent-cloud-run-launch-pack-max-smoke.js` | Launch Pack 全体検証 smoke | 実装済み |
| `.github/workflows/pm-agent-launch-readiness.yml` | GitHub Actions readiness 検証（deploy/gcloud/secrets なし） | 実装済み |
| `docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md` | Launch Pack 全体設計ドキュメント | 実装済み |
| `docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md` | deploy 手順書（Human Approval 後に使用） | 実装済み |
| `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` | rollback 方針・手順書 | 実装済み |
| `docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md` | じゅんやさん向け承認パケット | 実装済み |
| `docs/ai-dev-team/cloud-run-release-checklist-v0.2.3.md` | release チェックリスト | 実装済み |

**v0.2.3 は「deployできる直前状態」を作る。deploy 実行は v0.3.0 で Human Approval を得てから。**

- `Dockerfile` / `.dockerignore` — Secret・.env を完全 exclude した安全なコンテナ定義
- `cloud-run/pm-agent-service.template.yaml` — 全 PLACEHOLDER 使用・実値は Git 管理外
- `tools/pm-agent-cloud-run-preflight.js` — ファイル存在・スクリプト・安全性を一括チェック
- `tools/pm-agent-deploy-command-generator.js` — child_process 不使用・文字列出力のみ
- `tools/pm-agent-post-deploy-smoke.js` — ローカルサーバー統合テスト対応
- `.github/workflows/pm-agent-launch-readiness.yml` — deploy/gcloud/docker build/secrets 参照なし

**v0.2.3 は deployしない。外部 API 実行なし。Secret 読み取りなし。**

新規 npm scripts:
- `npm run smoke:cloud-run-launch-pack-max` — Launch Pack 全体 smoke
- `npm run pm-agent:cloud-run-preflight` — preflight チェック
- `npm run pm-agent:deploy-commands` — deploy コマンド文字列生成
- `npm run pm-agent:post-deploy-smoke` — post-deploy smoke（デフォルト: localhost:8080）
- `npm run verify` に `smoke:cloud-run-launch-pack-max` を追加済み

次ステップ: v0.3.0 Deploy Execution & Runtime Ops Pack → v0.4.0 Cloud Run deploy 実行（じゅんやさん）

---

## v0.3.0 Deploy Execution & Runtime Ops Pack

| ファイル / ディレクトリ | 役割 | 状態 |
|---|---|---|
| `tools/pm-agent-deploy-approval-packet.js` | deploy 承認パケット生成 | 実装済み |
| `tools/pm-agent-deploy-readiness-final-check.js` | deploy 直前最終確認（`readyForHumanDeploy: true`） | 実装済み |
| `tools/pm-agent-runtime-ops-packet.js` | runtime 運用・incident response パケット生成 | 実装済み |
| `tools/pm-agent-webhook-contract-generator.js` | webhook / n8n 接続コントラクト生成 | 実装済み |
| `tools/pm-agent-first-deploy-command-pack.js` | v0.4.0 初回 deploy コマンドパック（文字列生成のみ） | 実装済み |
| `tools/pm-agent-first-deploy-result-template.js` | deploy 結果記録テンプレート（v0.4.1 用） | 実装済み |
| `smoke/dev-agent-cloud-run-deploy-execution-pack-smoke.js` | Deploy Execution Pack 全体 smoke | 実装済み |
| `smoke/dev-agent-runtime-ops-pack-smoke.js` | Runtime Ops Pack smoke | 実装済み |
| `smoke/dev-agent-webhook-connection-readiness-smoke.js` | Webhook / n8n 接続準備 smoke | 実装済み |
| `smoke/dev-agent-first-deploy-command-pack-smoke.js` | First Deploy Command Pack smoke | 実装済み |
| `docs/ai-dev-team/cloud-run-deploy-execution-pack-v0.3.0.md` | Deploy Execution Pack 全体設計 | 実装済み |
| `docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md` | じゅんやさん向け承認チェックリスト | 実装済み |
| `docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md` | deploy 後確認手順 | 実装済み |
| `docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md` | runtime 運用ガイド | 実装済み |
| `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` | インシデント対応ガイド | 実装済み |
| `docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md` | 再 deploy 判断ガイド | 実装済み |
| `docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md` | n8n 接続準備ガイド | 実装済み |
| `docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md` | webhook セキュリティチェック | 実装済み |
| `docs/ai-dev-team/external-caller-contract-v0.3.0.md` | 外部呼び出しコントラクト | 実装済み |

**v0.3.0 は deploy 準備の完全な一式。deploy 実行そのものは v0.4.0（Human Approval 後）。**

新規 npm scripts:
- `npm run pm-agent:deploy-readiness-final-check` → `readyForHumanDeploy: true` 確認
- `npm run pm-agent:first-deploy-command-pack` → v0.4.0 deploy コマンドパック生成
- `npm run smoke:cloud-run-deploy-execution-pack / runtime-ops-pack / webhook-connection-readiness / first-deploy-command-pack`

---

## v0.4.0 First Cloud Run Deploy Execution（準備完了・人間実行待ち）

| ファイル | 役割 | 状態 |
|---|---|---|
| `docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md` | v0.4.0 初回 deploy 実行手順 | 実装済み（実行はじゅんやさん） |
| `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` | v0.4.1 deploy 結果記録テンプレート | 実装済み（記録は deploy 後） |

**v0.4.0 実行前チェック:**

```bash
npm run verify                             # 全 smoke PASS
npm run pm-agent:deploy-readiness-final-check  # readyForHumanDeploy: true
node tools/pm-agent-first-deploy-command-pack.js  # deploy コマンド確認
```

**v0.4.0 はじゅんやさんが Cloud Shell で deploy コマンドを実行する。AI は実行しない。**

次ステップ候補（v0.4.0）: じゅんやさん Human Approval → Cloud Run deploy 実行
次ステップ候補（v0.4.1）: deploy 結果記録
次ステップ候補（v0.5.0 以降）: n8n 接続 / `dryRunOnly: false` 移行

---

## Human Approval が必要な操作

以下は必ず **じゅんやさんの承認** を得てから実行する：

- `git commit`
- `git push`
- `git tag`
- `deploy`（Cloud Run / Railway）
- `gcloud` コマンド
- Secret Manager の値閲覧・変更
- 課金・外部 API 実接続
- PR / issue の作成

---

## 次に読むべき順番

1. `docs/ai-dev-team/README.md` — ドキュメント目次と役割
2. `docs/ai-dev-team/role-map-v0.1.0.md` — 役割分担を把握
3. `docs/ai-dev-team/operating-flow-v0.1.0.md` — 開発フローを把握
4. `docs/ai-dev-team/permission-policy-v0.1.0.md` — Claude Code の権限範囲を把握
5. `docs/ai-dev-team/reuse-guide-v0.1.0.md` — 別プロジェクトへの流用方法
6. `docs/ai-dev-team/project-handoff-template-v0.1.0.md` — 引き継ぎ時に使用

---

## 検証コマンド

```bash
npm run verify
```

## GitHub Actions 自動検証（v0.1.1）

`push` / `pull_request` 時に `.github/workflows/verify.yml` が自動で `npm run verify` を実行する。
手動で Cloud Shell / PowerShell から実行しなくてよい。
