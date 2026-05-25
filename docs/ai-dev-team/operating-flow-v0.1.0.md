# KOSAME Dev Orchestra 開発フロー v0.1.0

## フロー概要

```
[1. 作業開始前の確認]
         ↓
[2. こさめ PM の設計・切り分け]
         ↓
[3. Gemini 下読み（必要な場合）]
         ↓
[4. Claude Code チケット作成]
         ↓
[5. Claude Code 実装（command batching）]
         ↓
[6. verify / smoke 実行]
         ↓
[7. diff 確認・完了報告]
         ↓
[8. じゅんやさん commit 承認]  ← Human Approval
         ↓
[9. じゅんやさん push 承認]    ← Human Approval
         ↓
[10. じゅんやさん deploy 承認]  ← Human Approval（必要な場合）
```

---

## 1. 作業開始前の確認

以下を確認してから作業を開始する：

- 対象 repo は正しいか（ANESTY Board と混線していないか）
- 現在の正本 commit は何か（`git log --oneline -1`）
- 触ってよいファイルは明確か
- 禁止操作は明確か
- `project-handoff-template-v0.1.0.md` が埋まっているか

---

## 2. こさめ PM の設計・切り分け

- 今回の作業範囲を決定する
- ANESTY Board との混線リスクを確認する
- 安全ゲート判断（何を Human Approval にするか）
- Claude Code チケットの設計
- Gemini タスクパケットの設計（Gemini を使う場合）

---

## 3. Gemini 下読み（必要な場合）

`gemini-agent-task-packet-v0.1.0.md` に従ってタスクパケットを作成し、Gemini に読ませる。

Gemini が担当：
- 長文ドキュメントの要約
- ログの整理
- GCP / Cloud Run / Secret Manager の一次レビュー

Gemini にさせないこと：
- 最終的なアーキテクチャ判断
- `.env` / Secret Manager の値の読み取り

---

## 4. Claude Code チケット作成

以下の構造でチケットを作成する：

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

## 5. Claude Code 実装（command batching）

`claude-code-command-batching-v0.1.0.md` に従う：

- 作業開始前に許可範囲・禁止範囲・検証範囲を宣言する
- 細かい確認を逐次出さない
- まとめて実施して最後に一括報告する
- `.env` / Secret Manager の値は読まない
- commit / push / deploy は実行しない

---

## 6. verify / smoke 実行

```bash
npm run verify
git diff --stat
git diff --name-only
```

全チェックが PASS することを確認する。

---

## 7. diff 確認・完了報告

Claude Code が完了報告を出す：

1. 変更したファイル一覧
2. 各ファイルの役割
3. 実行した検証コマンドと結果
4. 実行していない検証コマンドがあれば理由
5. 未対応リスク
6. 次にやるべきこと

---

## 8. じゅんやさん commit 承認（Human Approval）

じゅんやさんが diff を確認し、commit する：

```bash
git add [具体的なファイルを指定]
git commit -m "コミットメッセージ"
```

---

## 9. じゅんやさん push 承認（Human Approval）

じゅんやさんが push する：

```bash
git push
```

---

## 10. じゅんやさん deploy 承認（Human Approval・必要な場合）

じゅんやさんが deploy を判断・実行する。
AI チームは deploy コマンドを実行しない。

---

## トラブル時の戻り方

| 状況 | 対処 |
|---|---|
| verify が失敗した | Claude Code に失敗箇所を修正させる。commit は行わない |
| 想定外のファイルが変更された | `git diff` で確認し、Claude Code に不要な変更を元に戻させる |
| ANESTY Board 側に誤って変更が入った | `git diff` で確認し、じゅんやさんが切り戻しを判断する |
| secrets が漏洩しそうになった | 即座に作業を停止し、じゅんやさんに報告する |

---

## ANESTY Board 側へ誤って戻らないルール

- 作業開始時に `pwd` / `git remote -v` で対象 repo を確認する
- `~/anesty-board` は絶対に触らない（KOSAME Dev Orchestra 作業中）
- チケットの「絶対に触らない repo」欄を必ず明記する
- v87.0.x のバージョン番号を KOSAME Dev Orchestra の次作業番号として使わない
- KOSAME Dev Orchestra の次作業番号は v0.1.1, v0.1.2, v0.1.3, v0.2.0 ... を使う

---

## ANESTY Board 側での KOSAME Dev Orchestra 設計書の参照

ANESTY Board 側で KOSAME Dev Orchestra の設計書を参照する場合：

- `~/kosame-dev-orchestra` を **参照元** とする
- ANESTY Board repo に KOSAME Dev Orchestra の設計書を複製しない
- 参照方法は Claude Code プロンプトに「`~/kosame-dev-orchestra/docs/...` を参照」と明記する
