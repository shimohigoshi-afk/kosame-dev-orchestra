# KOSAME Dev Orchestra v3.4.0 Release Record
## Kosame Safe Command Generator Pack

**Version:** 3.4.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v3.4.0 implements the **Kosame Safe Command Generator Pack** — Cloud Shellへ貼れる安全コマンド案を自動生成するtoolセット。全コマンドは `deny-command-guard` で検査済み。

---

## New Tools (5)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/deny-command-guard.js` | `guardCommand`, `guardCommandList`, `DENY_PATTERNS` | 禁止コマンド検出・拒否 |
| `tools/safe-commit-command-generator.js` | `generateSafeCommitCommands` | 安全commit手順生成 (git add -A 禁止) |
| `tools/safe-push-command-generator.js` | `generateSafePushCommands` | 安全push手順生成 (事前確認 + approval gate) |
| `tools/safe-tag-command-generator.js` | `generateSafeTagCommands` | 安全tag手順生成 (Actions success必須) |
| `tools/kosame-safe-command-generator.js` | `generateSafeCommands` | マスターgenerator (commit/push/tag/custom切替) |

---

## Deny Command Guard — 禁止パターン一覧

| パターン | 重大度 |
|---------|--------|
| `rm -rf` | CRITICAL |
| `git reset --hard` | CRITICAL |
| `git clean -f/-fd` | CRITICAL |
| `gcloud run deploy` / `gcloud deploy` | CRITICAL |
| `.env` access / Secret Manager | CRITICAL |
| API key exposure | CRITICAL |
| `git push --force` | CRITICAL |
| `docker build/push` | HIGH |
| `git push origin main` (unauthorized) | HIGH |
| `git tag vN` (must have approval) | HIGH |
| `npm publish` | HIGH |
| external HTTP/fetch calls | HIGH |

## Always Allowed

- `node --check` / `npm run verify` / `npm run smoke:*` / `npm run kosame:*`
- `git status` / `git log` / `git diff`
- `git add <specific-file>` (not -A or .)
- `git commit -m`

---

## New Smoke Tests (3)

- `smoke/dev-agent-deny-command-guard-smoke.js`
- `smoke/dev-agent-kosame-safe-command-generator-smoke.js`
- `smoke/dev-agent-v3.4.0-release-record-smoke.js`
