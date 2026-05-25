# KOSAME Dev Orchestra 流用ガイド v0.1.0

## このガイドの目的

ANESTY Board 以外のプロジェクト（KOSAME 営業 DX / スマホ PWA / 議事録 DX / 案件発掘ツール）に
KOSAME Dev Orchestra の設計・ワークフローを流用する方法を定義する。

---

## 流用時の3点セット

新しいプロジェクトに KOSAME Dev Orchestra を適用するには、以下3点をセットで用意する。

### 1. KOSAME Dev Orchestra 共通設計書

`~/kosame-dev-orchestra/docs/ai-dev-team/` の以下ファイルを参照する（コピー不要）：

- `role-map-v0.1.0.md` — 役割分担
- `operating-flow-v0.1.0.md` — 開発フロー
- `permission-policy-v0.1.0.md` — Claude Code 権限
- `claude-code-command-batching-v0.1.0.md` — Command Batching
- `gemini-agent-task-packet-v0.1.0.md` — Gemini タスクパケット

### 2. 個別プロジェクト設計書

プロジェクト固有の以下を用意する：

- プロジェクト概要・目的
- 対象 repo / deploy 先 / secrets 管理場所
- プロジェクト固有の権限設定（共通設計書を上書きする箇所）
- 対象ユーザー / データ / 規制要件

### 3. 今回やりたい作業

`project-handoff-template-v0.1.0.md` を使って記述する：

- 今回の作業対象
- 触ってよいファイル
- 禁止事項
- 完了条件

---

## ANESTY Board 依存を持ち込まない注意

| 持ち込んでよいもの | 持ち込んではいけないもの |
|---|---|
| KOSAME Dev Orchestra 設計書（参照） | ANESTY Board の v87.0.x バージョン番号 |
| 権限方針・Command Batching 方針 | ANESTY Board の `bot.js` / `BOARD_CANON.js` |
| 役割分担・開発フロー | ANESTY Board の `.env` / secrets |
| Gemini タスクパケット形式 | ANESTY Board 専用の Discord / webhook 設定 |

---

## プロジェクトごとの分離原則

各プロジェクトは以下を完全に分離する：

| 項目 | 内容 |
|---|---|
| Repo | プロジェクトごとに独立した GitHub リポジトリ |
| Deploy 先 | Cloud Run / Railway / その他を個別に設定 |
| Secrets | Secret Manager でプロジェクトごとにシークレットを分離 |
| データ | GCS bucket / Firestore collection をプロジェクトごとに分離 |
| GitHub Actions | workflow をプロジェクト repo 内に置く |

---

## こさめ PM の判断範囲

こさめ PM が担当する（Claude Code や Gemini に丸投げしない）：

- プロジェクトの作業範囲の切り分け
- ANESTY Board との混線防止の確認
- 安全ゲート判断（何を Human Approval にするか）
- Claude Code に渡すチケットの設計
- Gemini に渡すタスクパケットの設計

---

## Claude Code へ渡す範囲

Claude Code は以下を担当する（範囲を超えさせない）：

- チケットに従ったファイルの作成・編集
- smoke / verify スクリプトの実装・実行
- `node --check` による構文確認
- `git status` / `git diff` / `git log` の参照
- 完了報告の作成

Claude Code に渡してはならないもの：

- `.env` / Secret Manager の値
- deploy 判断
- commit / push の実行（Human Approval が必要）
- プロジェクトの設計判断

---

## Gemini に読ませる範囲

Gemini の得意領域（安価に処理できるもの）：

- 長文ドキュメントの読み取り・要約
- ログの整理・要約
- GCP / Cloud Run / Secret Manager の設定レビュー
- コストの見積もり
- diff の一次レビュー

Gemini に読ませてはならないもの：

- `.env` / Secret Manager の実際の値
- API キー・トークン・パスワード

---

## GitHub Actions へ逃がす検証

以下は GitHub Actions で自動化する（v0.1.1 候補）：

- `npm run verify`
- `npm run smoke:*`
- `node --check <file>`

---

## 人間承認（Human Approval）に残す範囲

以下は必ず **じゅんやさんの判断・承認** を必要とする：

- `git commit`
- `git push`
- `deploy`（Cloud Run / Railway / その他）
- Secret Manager の値閲覧・変更
- 課金・外部 API 実接続
- 本番データの削除・変更
- PR / issue の作成

---

## 流用チェックリスト

新プロジェクトを始める前に確認する：

- [ ] KOSAME Dev Orchestra と ANESTY Board のバージョンが混在していないか
- [ ] プロジェクト固有の repo が独立しているか
- [ ] secrets が Secret Manager でプロジェクトごとに分離されているか
- [ ] `project-handoff-template-v0.1.0.md` に情報が埋まっているか
- [ ] Claude Code へのチケットに触ってはいけないファイルが明記されているか
- [ ] Human Approval が必要な操作が明記されているか
