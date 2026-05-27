# KOSAME Dev Orchestra v3.1.0 Release Record
## Kosame CLI Entry Pack

**Version:** 3.1.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v3.1.0 implements the **Kosame CLI Entry Pack** — Cloud Shell上でこさめ副社長が判断系toolを呼び出す入口と、commandをOperating Console Foundationにルーティングするtoolを追加。

---

## New Tools (2)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/kosame-cli-entry.js` | `runCli`, `DEMO_INPUTS` | Cloud Shell CLI入口。引数なしでstatus、--help対応 |
| `tools/kosame-cli-router.js` | `routeCliCommand` | CLI commandをOperating Console Foundationにルーティング |

---

## New package.json Scripts (7)

```
kosame:status       → node tools/kosame-cli-entry.js status
kosame:commit-check → node tools/kosame-cli-entry.js commit-check
kosame:push-check   → node tools/kosame-cli-entry.js push-check
kosame:release-check→ node tools/kosame-cli-entry.js release-check
kosame:dispatch     → node tools/kosame-cli-entry.js dispatch
kosame:approval     → node tools/kosame-cli-entry.js approval
kosame:handoff      → node tools/kosame-cli-entry.js handoff
```

---

## New Smoke Tests (3)

- `smoke/dev-agent-kosame-cli-router-smoke.js`
- `smoke/dev-agent-kosame-cli-entry-smoke.js`
- `smoke/dev-agent-v3.1.0-release-record-smoke.js`

---

## Key Design Decisions

### dryRun: true は絶対デフォルト
全CLIコマンドが `dryRun: true` を返す。git push / tag / deploy / rm / API実行は一切しない。

### demo input fallback
CLI entry は入力なしで呼ばれた場合 `DEMO_INPUTS[command]` をフォールバックとして使う。実際の状態は v3.2.0 State Auto-Reader から取得する想定。

### session_id
`--session=<id>` フラグで session_id を受け取り、全ツール出力に伝播。
