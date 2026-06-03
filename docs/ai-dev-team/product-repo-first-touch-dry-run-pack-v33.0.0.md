# Product Repo First Touch Dry Run Pack (v33.0.0)

## 目的
選定された商品repoに対して、実際に触る前のfirst touch dry-run packetを生成する。
外部repoには触らない。safeReadOnlyPlanとforbiddenAreaの定義のみを生成する。

## safeReadOnlyPlan (候補コマンド)
| コマンド | 目的 |
|----------|------|
| ls -la /path/to/repo/ | top-level directory構造確認 |
| cat /path/to/repo/package.json | scripts/dependencies確認 |
| cat /path/to/repo/README.md | README内容確認 |
| git -C /path/to/repo log --oneline -5 | 最新5コミット確認 |
| git -C /path/to/repo status | working tree状態確認 |
| find /path/to/repo/docs -name "*.md" | docs構造確認 |
| node --version | ランタイムバージョン確認 |

## allowedFirstTouchAreas
docs/** / README.md / smoke/** / runbook/**

## forbiddenFirstTouchAreas
.env / .env.* / secrets/** / credentials/** / config/secrets/** / src/auth/** / src/payment/** / insurance/** / health/** / production.config.* / .ssh/** / private/**

## commandsForbidden
git add / git commit / git push / git tag / git reset --hard / git clean -f / rm -rf / npm run deploy / gcloud deploy / docker build / cat .env / cat secrets/** / cat credentials/**

## 出力フィールド
- firstTouchDryRunId
- targetProduct / targetRepoCandidate
- firstTouchPurpose
- safeReadOnlyPlan
- allowedFirstTouchAreas / forbiddenFirstTouchAreas
- commandsToPreview / commandsForbidden
- expectedObservations
- backupBeforeTouchRequired
- dryRunReady / notReadyReasons
- humanApprovalRequired
- recommendedNextAction

## 使用方法
```bash
node tools/product-repo-first-touch-dry-run-pack.js
npm run pm-agent:product-repo-first-touch-dry-run-pack
npm run smoke:product-repo-first-touch-dry-run-pack
```

## 次ステップ
dryRunReady = true の場合、Human が safeReadOnlyPlan の実コマンドを実行して repo構造を確認する。
確認後、v34 Controlled Task Launch Pack へ進む。
