# KOSAME Dev Orchestra v3.0.0 Release Record
## Kosame Dev Orchestra Operating Console Foundation

**Version:** 3.0.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v3.0.0 is the **Kosame Dev Orchestra Operating Console Foundation** — the integration milestone that unifies all tools from v2.6.0 through v2.9.0 into a single cohesive operating console. This release completes the "管理をこさめ副社長に寄せる" goal.

---

## New Tools (3)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/kosame-operating-console-foundation.js` | `runOperatingConsole`, `getFoundationStatus` | Top-level console integration: command / decision / health / list modes |
| `tools/kosame-operating-decision-packet.js` | `generateOperatingDecisionPacket` | Derives primary action from current state |
| `tools/operating-console-command-map.js` | `getCommandMap`, `lookupCommand`, `listHumanApprovalCommands` | Registry of all 13+ console commands |

---

## New Smoke Tests (4)

- `smoke/dev-agent-operating-console-command-map-smoke.js`
- `smoke/dev-agent-kosame-operating-decision-packet-smoke.js`
- `smoke/dev-agent-kosame-operating-console-foundation-smoke.js`
- `smoke/dev-agent-v3.0.0-release-record-smoke.js`

---

## New Docs (2)

- `docs/ai-dev-team/kosame-dev-orchestra-v3.0.0-release-record.md` (this file)
- `docs/ai-dev-team/kosame-operating-console-operating-guide.md`

---

## Operating Console Architecture

```
runOperatingConsole(request)
├── mode: 'command'   → runOperatorConsole (v2.6.0)
├── mode: 'decision'  → generateOperatingDecisionPacket (v3.0.0)
├── mode: 'health'    → createRepositoryHealthSnapshot (v2.7.0)
└── mode: 'list'      → getCommandMap + listCommands
```

### Decision priority order (primaryAction derivation)
1. `verify failed` → `run_claude_repair` (urgency: high)
2. `actions failed` → `triage_actions_failure` (urgency: high)
3. `dirty + no verify` → `run_verify` (urgency: normal)
4. `dirty + verified` → `run_commit_check` (urgency: normal)
5. `ahead of origin` → `run_push_check` (urgency: normal)
6. `all green` → `run_release_check` (urgency: low)
7. default → `wait_for_instruction` (urgency: low)

---

## Complete Version History

| Version | Pack Name | New Tools | New Smokes |
|---------|-----------|-----------|------------|
| v2.6.0 | Operator Command Console | 6 | 7 |
| v2.7.0 | Real Status Import Pack | 4 | 5 |
| v2.8.0 | One-shot Operation Plan Generator | 5 | 6 |
| v2.9.0 | Release Gate / Tag Readiness Pack | 4 | 5 |
| v3.0.0 | Operating Console Foundation | 3 | 4 |
| **Total** | **v2.6.0–v3.0.0** | **22** | **27** |

---

## Safety Invariants (永続)

- `git push` / `git tag` → always `gate_required: true`, always `humanApprovalRequired: true`
- `dryRun: true` on all tool outputs — no side effects
- No shell execution, no external API calls in any tool
- Dangerous operations hardcoded in `DANGEROUS_COMMANDS` list

---

## Verify Result

npm run verify — all smokes PASS (see v2.6.0–v3.0.0 additions in package.json verify chain)
