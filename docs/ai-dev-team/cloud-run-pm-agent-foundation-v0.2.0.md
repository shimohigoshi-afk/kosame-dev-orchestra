# v0.2.0 Cloud Run PM Agent Foundation

## 概要

v0.2.0 は、KOSAME Dev Orchestra の次フェーズである Cloud Run PM Agent の foundation を実装するバージョン。

**今回は Cloud Run への deploy はしない。外部 API を実行しない。Secret を読まない。**

---

## v0.2.0 の目的

- PM Agent の基本設計・役割・責任範囲をコードとして定義する
- Task Packet スキーマを最小限で確立する
- dry-run routing decision を実装し、将来の実運用につなぐ基盤を作る
- 危険箇所（deploy / secret / billing / production_mutation / critical リスク）を明確にガードする
- それ以外の作業領域では爆速で進める

---

## PM Agent Foundation の役割

KOSAME Cloud Run PM Agent は、AI 開発チームの「タスク受付・ルーティング・安全ゲート」を担当する。

- タスクを受け取り、Task Packet スキーマに従って検証する
- Task の kind / riskLevel を見て、推奨担当を決定する
- Human Approval が必要なタスクをブロックする
- PM 自身は API を直接叩かない。エージェントへの routing 指示のみ行う

---

## Task Packet Schema の役割

Task Packet は PM Agent へのタスク入力の最小単位。

必須: `id`, `title`, `kind`, `riskLevel`

任意: `targetRepo`, `allowedFiles`, `forbiddenFiles`, `context`, `acceptanceCriteria`, `verificationCommands`, `humanApprovalRequiredFor`

Task Packet によりタスクの責任範囲・許可ファイル・禁止ファイル・検証方法を明示し、じゅんやさんをコピペ作業員にしない仕組みを作る。

---

## Dry-Run Task Intake の役割

v0.2.0 では全ての routing decision は dry-run。実 API は叩かない。

- `decideTaskRoute(taskPacket)` が `dryRun: true` を返すことで安全を担保する
- 将来は `dryRun: false` の live routing に移行するが、それには Human Approval が必要

---

## Routing Decision Stub の役割

task kind に応じた推奨担当マッピング（dry-run stub）:

| task kind | 推奨担当 | 理由 |
|---|---|---|
| docs / summary / bulk_reading / classification | gemini | 大量処理・コスト効率 |
| implementation / test / smoke / refactor | claude_code | 実装品質・差分管理 |
| product_decision / final_review / safety_gate | kosame_pm / gpt | 判断品質・方針整合 |
| deploy / secret / billing / production_mutation | human | Human Approval 必須 |
| riskLevel: critical | human | リスク問わず Human Approval 必須 |

---

## Cloud Run に載せる理由

- スケール: タスク量に応じてスケールアウトできる
- コスト: アイドル時はゼロコスト（Cloud Run の従量課金）
- 分離: PM Agent を独立したサービスとして KOSAME Dev Orchestra 本体と切り離せる
- 管理: GCP 上で Secret Manager・IAM と統合しやすい

---

## GitHub を正本にする理由

- 変更履歴がすべて git log に残る
- Claude Code による差分作成・Human Approval によるマージが自然に組み込める
- GitHub Actions による自動 verify が走る
- じゅんやさんが最終判断を `git push` / `merge` の形で行える

---

## Secret Manager を秘密情報の金庫にする理由

- API キー値・接続文字列を環境変数やコードに直書きしない
- Cloud Run からは IAM ロール経由でのみアクセスできる
- Claude Code / Gemini Agent がキー値を見ることなく動作できる設計にする

---

## じゅんやさんをコピペ作業員にしない

PM Agent が行うこと:
- タスクの受付・routing・ブロック
- Human Approval が必要な境界の明示
- 実装差分の作成（Claude Code が担当）
- 自動 verify

じゅんやさんが行うこと:
- 最終判断: `git commit` / `git push` / `deploy` 承認
- Human Approval 境界のタスクの実行承認

コピペ・手作業・繰り返し確認は AI チームが担当。じゅんやさんは意思決定に集中する。

---

## 役割分担

| ロール | 担当 |
|---|---|
| じゅんやさん | 最終判断・Human Approval・commit / push / deploy 承認 |
| こさめ PM / PM Agent | タスク設計・routing・安全ゲート |
| Claude Code | 実装・差分作成・smoke 実行 |
| Gemini Agent | 大量処理・下読み・分類・要約 |
| GPT | 判断・レビュー・PM 補助 |
| GitHub Actions | verify 自動化 |
| Cloud Run | PM Agent 実行基盤（v0.2.1 以降） |

---

## 危険箇所だけガードして爆速で進める方針

安全運転で遅く進めるのではなく、危険箇所だけ明確にガードし、それ以外はギリギリまで攻めて爆速で進める。

ガードする箇所:
- Secret 値・APIキー値の読み取り・出力
- 本番環境への直接変更
- 課金 API の実行
- deploy / git push / git tag（Human Approval 必要）
- 法的リスクのある操作

それ以外:
- ローカルファイルの作成・編集: 全速前進
- dry-run ツールの実装: 全速前進
- smoke テストの実装: 全速前進
- ドキュメントの整備: 全速前進

---

## 今回の制約

- **deploy しない**: v0.2.0 は foundation-only。Cloud Run への deploy は v0.2.1 以降
- **API を実行しない**: fetch なし。外部 API なし
- **Secret を読まない**: `.env` / Secret Manager / GitHub Secrets 不使用
- **printenv / env を実行しない**
- **git push / git tag しない**: Human Approval 必要

---

## Human Approval が必要な境界

| 操作 | 理由 |
|---|---|
| `git commit` / `git push` / `git tag` | コード変更の最終責任 |
| `deploy`（Cloud Run / Railway） | 本番環境変更 |
| Secret Manager の値の閲覧・変更 | 秘密情報保護 |
| 課金・外部 API 実接続 | コスト発生 |
| live call の有効化（--live フラグ） | API 実行リスク |
| riskLevel: critical のタスク | 高リスク操作全般 |

---

## v0.2.1 以降の候補

- Cloud Run への PM Agent deploy 設計
- n8n / GitHub Actions との Task Packet 受け渡し設計
- Task Packet の実運用フロー（Issue → Packet → routing → execution → verify → merge）
- BackOffice Agent / BackOffice Orchestra への流用

---

## 注意事項

- このドキュメントに実キー値・実キーっぽいサンプルは含まない
- APIキー値を記録しないことは KOSAME Dev Orchestra の基本ルール
- 危険箇所だけガードして爆速で進める方針を維持する
