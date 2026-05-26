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

次ステップ候補（v0.2.2 以降）: Cloud Run deploy 設計 / n8n・GitHub Actions 接続 / `dryRunOnly: false` 移行準備

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
