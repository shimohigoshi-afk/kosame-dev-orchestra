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
