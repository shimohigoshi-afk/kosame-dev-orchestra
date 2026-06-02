# Product Release Candidate Packet Builder v19.0.0

## 目的
商品repoでの実装結果をrelease candidate packetにまとめる。
まだ実release/deploy/pushはしない。

## 入力フィールド
| フィールド | 説明 |
|-----------|------|
| targetProduct | 対象商品タイプ |
| targetRepo | 対象repoパス |
| taskGoal | タスクの目的 |
| intendedFiles | 意図した変更ファイル |
| deniedFiles | 禁止ファイルパターン |
| version | バージョン |
| rollbackNote | ロールバック手順 |
| verifyPassed | npm verify結果 |
| nodeCheckPassed | node --check結果 |
| smokePassed | smoke結果 |

## prePushChecklist (8項目)
1. git status shows only intended files
2. npm run verify passes
3. node --check passes
4. rollbackNote documented
5. product smoke tests passing
6. こさめ/GPT PM review completed
7. Claude implementation review completed
8. **じゅんやさん final YES obtained** (必須)

## preDeployChecklist (8項目)
1. All pre-push checks completed
2. Staging environment tested
3. Rollback procedure confirmed
4. No customer/patient/employee PII
5. No secrets without Secret Manager
6. GitHub Actions CI green
7. こさめ/GPT PM deploy approval
8. **じゅんやさん deploy YES obtained** (必須)

## 安全ルール
- noRealRelease / noRealDeploy / noRealPush: true 固定
- absolutelyForbidden: git add/commit/push/tag/deploy (automated) の明示禁止
