# Commit Candidate Packet Builder v16.0.0

## 目的
意図ファイル限定add、staged files、diff stat、commit message候補、tag候補、
push前確認、Actions確認手順、rollback noteをまとめたpacketを生成する。
実commit / push / tagは絶対に実行しない。

## 入力
| フィールド | 必須 | 説明 |
|-----------|------|------|
| taskGoal | ○ | タスクの目的 |
| intendedFiles | ○ | 意図した追加ファイル一覧 |
| deniedFiles | - | 禁止ファイルパターン |
| version | - | バージョン文字列 (例: '16.0.0') |
| commitMsgBody | - | commit messageの本文 |
| rollbackNote | - | ロールバック手順 |
| verifyPassed | - | npm run verify 通過か |
| nodeCheckPassed | - | node --check 通過か |

## 出力
| フィールド | 説明 |
|-----------|------|
| intendedFiles | 意図ファイル一覧 |
| deniedFiles | 禁止ファイル一覧 |
| stagedFilesPreview | dry-run staged files (実際にgit addしない) |
| diffStatPreview | dry-run diff stat (実際にgit diffしない) |
| commitMessageCandidate | commit message候補 |
| tagCandidate | tag候補 (v{version}) |
| prePushChecklist | push前確認リスト (8項目) |
| githubActionsChecklist | GitHub Actions確認リスト (5項目) |
| rollbackNote | ロールバック手順 |
| humanApprovalRequired | true (固定) |
| dangerousActionsDenied | 禁止アクション一覧 |
| absolutelyForbidden | 絶対禁止リスト |
| isDeniedFileIncluded | denied fileが混入していないか |
| readyForHumanReview | じゅんやさん提示準備完了か |

## prePushChecklist 項目
1. git status shows only intended files (required)
2. git diff --stat matches expected changes (required)
3. npm run verify passes (required)
4. node --check on all new/edited JS files (required)
5. rollbackNote is documented (required)
6. humanApprovalRequired: じゅんやさんの最終YES取得済み (required)
7. commit message reviewed and approved (required)
8. tag candidate reviewed (optional)

## githubActionsChecklist 項目
1. Confirm GitHub Actions CI triggered after push
2. Check Actions tab for green status
3. Review test results and lint output
4. Confirm no unexpected workflow failures
5. Notify こさめ/GPT PM of CI result before tagging

## 安全ルール
- git add / git commit / git push / git tag は絶対に実行しない
- absolutelyForbidden に全自動git操作を列挙
- じゅんやさんの明示的YESが必要
- denied file 混入時は readyForHumanReview = false
