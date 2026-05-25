# KOSAME Dev Orchestra Spec v0.1.0

---

## 1. Position（位置づけ）

KOSAME Dev Orchestra は、ANESTY Board に限らず、KOSAME 営業DX・スマホPWA・議事録DX・案件発掘ツール・将来の Cloud Run 系プロダクト全般に流用する **共通 AI 開発チーム OS** である。

ANESTY Board 専用の機能ではない。

---

## 2. バージョン分離の原則

ANESTY Board と KOSAME Dev Orchestra は **別物** であり、バージョン体系も分離する。

| 対象 | バージョン体系 | 正本管理場所 |
|---|---|---|
| ANESTY Board（Discordボット本体） | `v87.0.x` 系 | `~/anesty-board` |
| KOSAME Dev Orchestra（共通AI開発チームOS） | `v0.1.x / v0.2.x / v1.0.0` 系 | `~/kosame-dev-orchestra` |

これらを **混在させてはならない**。

---

## 3. ロール定義

| ロール | 担当 |
|---|---|
| じゅんやさん | 最終決裁者 / ビジネスオーナー |
| こさめ PM | 設計・ルーティング・安全ゲート・Claude Code チケット生成 |
| Gemini Agents | 長文ドキュメント読み取り・ログ要約・GCP / Cloud Run / Secret Manager 一次レビュー |
| Claude Code | 実装担当 |
| GitHub Actions | verify / smoke 自動化 |
| Cloud Run | 実行プラットフォーム |
| GitHub | ソース管理の正本 |
| Secret Manager | シークレット保管庫 |

---

## 4. 大原則

**じゅんやさんをコピペ作業員にしない。**

じゅんやさんがすべき操作は以下の3点のみ：

1. Claude Code の出力を貼る（プロンプト投入）
2. 結果を見る
3. commit / push / deploy を **自分で判断・承認する**

それ以外は AI チームが完結させる。

---

## 5. Human Approval（人間承認）ゲート

以下の操作は必ず **じゅんやさんの判断・承認** を必要とする。AI が自律実行してはならない。

| 操作 | 理由 |
|---|---|
| `git commit` | 変更の確定 |
| `git push` | リモートへの反映。取り消しコストが高い |
| `git tag` | バージョン管理への影響 |
| `deploy`（Cloud Run / Railway） | 本番影響あり |
| `gcloud` コマンド | GCP リソース変更 |
| Secret Manager の値閲覧・変更 | 秘密情報の漏洩リスク |
| 課金・外部 API 実接続 | コスト発生 |
| PR / issue の作成・コメント | 外部への影響 |

---

## 6. バージョン体系（KOSAME Dev Orchestra 側）

KOSAME Dev Orchestra の作業バージョンは以下の体系を使用する。

| バージョン | 用途 |
|---|---|
| `v0.1.0` | 初版正本化（permission strategy / command batching 方針整備） |
| `v0.1.1` | GitHub Actions verify / smoke 方針整備 |
| `v0.1.2` | Claude Code ticket runner 方針整備 |
| `v0.1.3` | Gemini Agent task packet 方針整備 |
| `v0.2.0` | Cloud Run PM Agent 方針整備（中規模マイルストーン） |
| `v1.0.0` | 本番運用開始（大規模マイルストーン） |

### 重要：ANESTY Board v87.0.x との関係

ANESTY Board の `v87.0.9`・`v87.0.10`・`v87.0.11`・`v87.0.12`・`v87.0.13` 以降は、
**ANESTY Board bot 本体の実装履歴** であり、KOSAME Dev Orchestra の作業番号ではない。

KOSAME Dev Orchestra の次作業番号として `v87.0.x` を使用してはならない。

---

## 7. 推奨ディレクトリ構成

KOSAME Dev Orchestra の設計書・方針文書は **`~/kosame-dev-orchestra`** を正本管理場所とする。

```
kosame-dev-orchestra/
├── docs/
│   └── ai-dev-team/
│       ├── KOSAME_DEV_ORCHESTRA_SPEC_v0.1.0.md  # 本ファイル（正本）
│       ├── permission-policy-v0.1.0.md
│       └── claude-code-command-batching-v0.1.0.md
├── tickets/
│   └── common/
│       └── kosame_dev_orchestra_permission_strategy_v0_1_0.md
├── smoke/
│   └── dev-agent-permission-policy-smoke.js
├── package.json
└── README.md
```

ANESTY Board 本体（`~/anesty-board`）に KOSAME Dev Orchestra の設計書を混在させない。
ANESTY Board の `docs/ai-dev-team/` は **参照コピー** であり、正本ではない。

---

## 8. Permission Policy 概要

Claude Code の操作権限は3分類に整理する。

| 分類 | 内容 |
|---|---|
| 自律実行してよい操作 | ファイル読み書き（秘密情報除く）・smoke 実行・verify 実行・git 参照系 |
| Human Approval が必要な操作 | commit・push・deploy・Secret Manager・課金・外部 API |
| 原則禁止操作 | `.env` 読み取り・`rm -rf`・`git reset --hard`・`curl \| bash` 等 |

詳細は `docs/ai-dev-team/permission-policy-v0.1.0.md` を参照。

---

## 9. Command Batching 方針

Claude Code が逐次確認を出し続ける「確認地獄」を防ぐための方針。

- 作業開始前に「許可範囲・禁止範囲・検証範囲」を一度だけ宣言する
- 安全な操作（読み取り・文書作成・smoke 追加）はまとめて実施する
- 完了後に一括報告する（完了報告テンプレートを使用）

詳細は `docs/ai-dev-team/claude-code-command-batching-v0.1.0.md` を参照。

---

## 10. Gemini First ルーティング方針

| 役割 | 担当 AI |
|---|---|
| 長文ドキュメント読み取り・ログ要約・コスト見積もり | Gemini（安価な一次処理） |
| 最終アーキテクチャ判断・チケット確定 | こさめ GPT |
| 実装 | Claude Code |
| commit / push / deploy 判断 | じゅんやさん（Human Approval） |
| 創作ブレスト | Grok（保留） |

---

## 11. 秘密情報管理ルール

- `.env` / `.env.*` を Claude Code に渡してはならない
- Secret Manager の値を Claude Code の文脈に含めてはならない
- API キー・トークン・パスワードをプロンプトに直接貼ってはならない
- 秘密情報が必要な場合は yes/no だけを確認させる

---

## 12. Claude Code チケット形式

各作業は以下の構造を持つチケットとして定義する：

```
作業名
目的
背景
今回作るファイル
触ってよいファイル
触ってはいけないファイル
禁止事項
検証コマンド
完了条件
Human Approval が必要な操作
次の作業への接続
```

---

## 13. Smoke テスト戦略

- 各マイルストーンでドキュメント・設定の存在確認と必須キーワード検証を smoke スクリプトで実施する
- smoke スクリプトは `smoke/` 配下に配置する
- 外部 API 接続・env 読み取りは smoke スクリプトに含めない
- `npm run verify` が全 smoke を通過することを完了条件とする

---

## 14. GitHub Actions CI 方針（v0.1.1 候補）

以下を v0.1.1 で実装予定（現時点は方針のみ）：

```yaml
name: verify
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci --omit=dev
      - run: npm run verify
```

commit / push / deploy は引き続き Human Approval とする。
GitHub Actions は verify / smoke の自動化のみ担当する。

---

## 15. 開発ワークフロー標準

1. こさめ PM がチケットを設計する
2. Gemini が長文・ログ・既存ドキュメントを一次レビューする
3. Claude Code がチケットに従い実装する（command batching 適用）
4. Claude Code が smoke / verify を実行して完了報告する
5. じゅんやさんが完了報告を確認し commit / push / deploy を判断する

---

## 16. 新プロダクトへのオンボーディング

KOSAME Dev Orchestra を新プロダクトに適用する際の手順：

1. `~/kosame-dev-orchestra` の `docs/ai-dev-team/` をコピーする
2. プロダクト固有の permission-policy を追記する
3. プロダクト固有の smoke スクリプトを追加する
4. `npm run verify` が通ることを確認する
5. じゅんやさんの承認後、対象プロダクト repo に反映する

---

## 17. 対応プロダクト一覧（現在と予定）

| プロダクト | 状態 |
|---|---|
| ANESTY Board（Discord ボット） | 実装中（v87.0.x 系） |
| KOSAME 営業 DX | 予定 |
| スマホ PWA | 予定 |
| 議事録 DX | 予定 |
| 案件発掘ツール | 予定 |
| Cloud Run 系プロダクト | 予定 |

---

## 18. AI エージェント間の通信プロトコル

- Claude Code ↔ じゅんやさん: テキストプロンプト（Claude Code CLI）
- Gemini ↔ じゅんやさん: テキストプロンプト（Gemini API / CLI）
- こさめ PM ↔ じゅんやさん: チケット形式のドキュメント
- エージェント間の直接通信は現時点では行わない（Human Approval を必ず経由する）

---

## 19. 品質ゲート

| ゲート | 条件 |
|---|---|
| verify 通過 | `npm run verify` が全チェックを通過する |
| smoke 通過 | 全 smoke スクリプトが PASS する |
| ドキュメント整合 | 必須キーワードが全対象ファイルに存在する |
| 秘密情報未漏洩 | `.env` / Secret Manager への Claude Code アクセスがない |
| Human Approval | commit / push / deploy がじゅんやさんの判断済みである |

---

## 20. リスク管理

| リスク | 対策 |
|---|---|
| ANESTY Board と KOSAME Dev Orchestra のバージョン混線 | バージョン体系を6章で明確分離。v87.0.x は ANESTY Board 専用 |
| 秘密情報の漏洩 | 11章のルールを厳守。Claude Code に `.env` を渡さない |
| 確認地獄によるじゅんやさんの負荷増大 | command batching 方針（9章）を適用 |
| AI が本番操作を自律実行 | Human Approval ゲート（5章）を厳守 |
| 設計書の分散・陳腐化 | `~/kosame-dev-orchestra` を正本として一元管理 |

---

## 21. 次にやること（ロードマップ）

### KOSAME Dev Orchestra v0.1.0（現在）：正本化

- [x] Permission strategy / command batching 方針整備
- [x] `docs/ai-dev-team/` 配下のドキュメント作成
- [x] `smoke/dev-agent-permission-policy-smoke.js` による自動検証
- [x] `npm run verify` 通過確認

### KOSAME Dev Orchestra v0.1.1 候補：GitHub Actions verify / smoke

- [ ] `.github/workflows/verify.yml` 作成
- [ ] push / PR 時に `npm run verify` を自動実行
- [ ] commit / push / deploy は引き続き Human Approval

### KOSAME Dev Orchestra v0.1.2 候補：Claude Code ticket runner

- [ ] `tools/render-kosame-ticket.js` によるチケット自動生成
- [ ] チケット形式の標準化・テンプレート整備

### KOSAME Dev Orchestra v0.1.3 候補：Gemini Agent task packet

- [ ] Gemini への一次処理タスクパケット形式の定義
- [ ] 長文ドキュメント読み取り・ログ要約の自動化方針

### KOSAME Dev Orchestra v0.2.0 以降候補：Cloud Run PM Agent

- [ ] こさめ PM の一部機能を Cloud Run 上で動作させる方針
- [ ] Secret Manager・GCP 連携の設計

---

## 付録：ANESTY Board との関係整理

ANESTY Board の `v87.0.x` 系は ANESTY Board bot 実装の履歴バージョンであり、
KOSAME Dev Orchestra の作業番号とは **無関係** である。

ANESTY Board 側で KOSAME Dev Orchestra の成果物（permission-policy 等）を参照する場合は、
`~/kosame-dev-orchestra` から **コピー** して利用し、ANESTY Board 側を正本としない。

| 項目 | ANESTY Board | KOSAME Dev Orchestra |
|---|---|---|
| バージョン | v87.0.x | v0.1.x / v0.2.x / v1.0.0 |
| 正本 repo | `~/anesty-board` | `~/kosame-dev-orchestra` |
| 主な内容 | Discord ボット実装 | AI 開発チーム OS 設計 |
| 次の作業番号 | v87.0.x に続く ANESTY Board の番号 | v0.1.1, v0.1.2, v0.1.3, v0.2.0 ... |
