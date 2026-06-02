# First Safe Docs Edit Execution Pack v15.0.0

## 目的
README.mdなど低リスクdocs編集に限定して、Claude編集用の安全実行packetを生成する。
実ファイル編集・commit・push・tagは自動実行しない。

## 入力
| フィールド | 必須 | 説明 |
|-----------|------|------|
| taskGoal | ○ | 編集タスクの目的 |
| targetFiles | - | 編集対象ファイル一覧 (デフォルト: ['README.md']) |
| allowedFiles | - | 許可ファイルパターン |
| deniedFiles | - | 禁止ファイルパターン |
| editScopeDesc | - | 編集スコープの説明 |
| verifyCommands | - | 検証コマンド一覧 |
| doneCriteria | - | 完了判定条件 |
| rollbackHint | - | ロールバック手順 |

## 出力
| フィールド | 説明 |
|-----------|------|
| allowedFiles | 許可ファイル一覧 |
| deniedFiles | 禁止ファイル一覧 |
| editScope | targetFiles ごとの isAllowed / isDenied 判定 |
| verifyCommands | 検証コマンド |
| doneCriteria | 完了判定条件 |
| rollbackHint | ロールバック手順 |
| readyToPresent | じゅんやさん提示準備完了か |
| noRealFileEdit | true (固定) |
| noRealCommit | true (固定) |
| noRealPush | true (固定) |
| noRealTag | true (固定) |

## デフォルト allowedFiles
- `./docs/ai-dev-team/**`
- `./README.md`

## デフォルト deniedFiles
- `./.env` / `./.env.*`
- `./secrets/**` / `./credentials/**`
- `./tools/**` / `./smoke/**` / `./fixtures/**`
- `./package.json`

## 安全ルール
- このpacket自体は実ファイル編集・commit・push・tagを自動実行しない
- じゅんやさんのYESが必要
- dangerousActionsDenied に列挙されたコマンドは実行禁止
