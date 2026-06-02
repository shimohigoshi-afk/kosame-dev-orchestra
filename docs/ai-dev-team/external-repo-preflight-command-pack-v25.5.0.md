# External Repo Preflight Command Pack v25.5.0

## 目的
実プロダクトrepoへClaude作業を投げる前に、人間がCloud Shell / PowerShellで確認する
preflight command packを生成する。実行はしない。

## 対応 shellType
- `bash` (デフォルト)
- `powershell`
- `cloud_shell`

## safeReadCommands の種類
- ls -la / Get-ChildItem (repo listing)
- git status --short (untracked/modified check)
- git log --oneline -5 (recent history)
- git branch (current branch)
- git diff --stat HEAD (change scope)
- node --version / npm --version

## forbiddenCommands (12種類)
rm -rf / git reset --hard / git clean -f / git push / git tag / git add / git commit / deploy / docker / gcloud / cat .env / printenv

## checks の構成
- repoCleanCheck: git status + stash list (dry-run only)
- branchCheck: git branch + log (干-run only)
- packageVersionCheck: node -e require('./package.json').version
- dependencyCheck: npm ls --depth=0 + node/npm version
- verifyCommandCandidate: npm run verify / npm test / node --check
- gitSafetyCheck: safeOps / unsafeOps を明示
- secretSafetyCheck: 商品別確認項目
- backupRecommendation: git stash / baseline記録 / rollback準備

## 安全ルール
- noRealCommandExecution: true 固定
- noRealRepoAccess: true 固定
- 全checkは dry-run only とnoteに明記
