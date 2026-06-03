# First Real Product Repo Result Acceptance Gate (v38.0.0)

## 目的
初回実プロダクトrepo作業後のClaude報告を受け入れてよいかを判定する。
Secret / .env / API key / 顧客情報 / 保険証券 / 健診情報 が含まれる場合は hold/reject。
deploy / push / tag / destructive delete が報告に含まれる場合は reject。

## 検出パターン

### secretPatterns
api key / api_key / secret / .env / password / token / credential / private key / access key / bearer / auth key

### customerDataPatterns
insurance / health record / patient / policyholder / employee salary / financial record / personal info / pii / 個人情報 / 保険証券 / 健診 / 診察 / 氏名 / 住所 / 電話番号

### forbiddenFilePatterns
.env / secrets/ / credentials/ / private/ / .ssh/ / config/secrets / config/credentials / insurance/ / health/

### dangerousOpPatterns
git commit / git push / git tag / git reset --hard / git clean -f / rm -rf / deploy / gcloud deploy / docker build

## acceptanceDecision ロジック
- secretLeak/customerDataLeak/dangerousOp → hold
- forbiddenFile → reject
- verificationFailed/outOfZone → revise
- all clear → approve

## commitCandidateReady 条件
acceptanceDecision = 'approve' かつ 全チェック通過

## 使用方法
```bash
node tools/first-real-product-repo-result-acceptance-gate-pack.js
npm run pm-agent:first-real-product-repo-result-acceptance-gate
npm run smoke:first-real-product-repo-result-acceptance-gate
```

## 次ステップ
commitCandidateReady = true → こさめ/GPT PM final review → じゅんやさん YES → git add/commit/push/tag (Human実行)
