# First Real Product Repo Execution Prompt Pack v24.0.0

## 目的
v23.0 dispatch plan と v23.5 safety gate review をもとに、Claude Codeへ実プロダクトrepo作業を
投げる直前の実行prompt packを生成する。まだ実repoへは投げない。

## commandsAllowed (8種類)
- node --check <editedFile>
- npm run verify (or equivalent)
- npm test (non-destructive)
- git status --short
- git diff --stat HEAD
- git log --oneline -5
- cat README.md
- ls -la (read-only)

## commandsForbidden (12種類)
- git add/commit/push/tag (without じゅんやさん YES)
- git reset --hard / git clean -f (without じゅんやさん YES)
- rm -rf / deploy / gcloud deploy / docker build / docker push
- cat .env / secrets / node -e (arbitrary eval)
- curl/wget to external APIs with real credentials
- Any command that writes to production systems

## implementationSteps (9ステップ)
最後のステップ: "STOP — do NOT git add / commit / push. Return report and wait for human YES."

## reportFormat 必須フィールド (8種)
editedFiles / diffSummary / nodeCheckResult / verifyResult / smokeResult / remainingRisks / rollbackNote / gitStatusOutput

## promptReady 判定
- isKnownProduct: true
- hasTaskScope: true
- hasAllowedFiles: true
- safetyCleared: safetyGatePassed !== false

## 安全ルール
- noRealRepoEdit / noRealExecution: true 固定
- safetyGatePassed = false → "# EXECUTION PROMPT BLOCKED"
- exportedExecutionPrompt に CRITICAL SAFETY RULES を必ず明記
