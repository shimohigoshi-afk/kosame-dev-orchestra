# Product Repo Connection Prep Pack v21.5.0

## 目的
実プロダクトrepoへ作業を流す前に、接続準備情報をdry-run packetとして整理する。
実際のrepo存在確認コマンドは実行しない。

## 主要出力フィールド
| フィールド | 説明 |
|-----------|------|
| repoPathCandidate | 推定repoパス |
| repoExistenceCheckPlan | dry-run only の確認コマンド計画 |
| branchPolicy | defaultBranch / workBranch / requiresPR |
| safeReadCommands | 安全に実行できる読み取りコマンド |
| safeWriteZones | 書き込み可能ゾーン |
| deniedZones | 書き込み禁止ゾーン |
| secretAndEnvPolicy | シークレット/env取扱ポリシー |
| customerDataPolicy | 顧客データ取扱ポリシー |
| verificationCommands | 検証コマンド |
| rollbackPolicy | ロールバック手順 |
| humanApprovalGates | 4段階承認ゲート |
| connectionReady | 接続準備完了か |

## humanApprovalGates (4段階)
1. こさめ/GPT PM: task scope review before repo access
2. Claude: implementation and node --check before staging
3. こさめ/GPT PM: diff review before commit
4. じゅんやさん: final YES before git add / commit / push / tag

## 安全ルール
- noRealRepoAccess / noRealExecution: true 固定
- repoExistenceCheckPlan は dry-run only と note に明記
- 実コマンドはじゅんやさんのYES後のみ実行可
