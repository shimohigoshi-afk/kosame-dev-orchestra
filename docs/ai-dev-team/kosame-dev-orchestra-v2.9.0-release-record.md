# KOSAME Dev Orchestra v2.9.0 Release Record
## Release Gate / Tag Readiness Pack

**Version:** 2.9.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v2.9.0 implements the **Release Gate / Tag Readiness Pack** — tools that control the release gate, generate tag readiness packets, produce release handoff summaries, and suggest next development phases. This is the final pack before v3.0.0 integration.

---

## New Tools (4)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/release-gate-controller.js` | `evaluateReleaseGate`, `GATE_STATUSES` | Controls open/closed/pending gate state |
| `tools/tag-readiness-packet.js` | `generateTagReadinessPacket` | Generates tag readiness summary for じゅんやさん |
| `tools/release-handoff-packet.js` | `generateReleaseHandoffPacket` | Post-release handoff with next steps |
| `tools/post-release-next-phase-suggestion.js` | `suggestNextPhase`, `PHASE_SUGGESTIONS` | Suggests next version phase |

---

## New Smoke Tests (5)

- `smoke/dev-agent-release-gate-controller-smoke.js`
- `smoke/dev-agent-tag-readiness-packet-smoke.js`
- `smoke/dev-agent-release-handoff-packet-smoke.js`
- `smoke/dev-agent-post-release-next-phase-suggestion-smoke.js`
- `smoke/dev-agent-v2.9.0-release-record-smoke.js`

---

## New Fixtures (1)

- `fixtures/tag-readiness.sample.json` — sample tag readiness input data

---

## Key Design Decisions

### Three-state gate: open / pending / closed
- `closed`: technical checks fail (actions, verify, working tree, docs, version)
- `pending`: technical checks pass but じゅんやさん hasn't approved yet
- `open`: all technical + junyaApproved=true → release allowed

Even with `gateStatus: 'open'`, `humanApprovalRequired` remains `true` — the gate records that approval was given, not that Claude can self-approve.

### Tag readiness gate is always hardcoded
`gate_required: true` and `humanApprovalRequired: true` are never derived from input — they are always set.

### Post-release phase knowledge is encoded as data
`PHASE_SUGGESTIONS` maps version strings to next-phase metadata. This allows phase routing without conditional logic chains.

### Gemini health check in next-phase suggestion
If `providerHealth.gemini` contains 'error', an immediate action is added suggesting Claude-only mode for the next phase.

---

## Compatibility

- All v2.0.0–v2.8.0 tools unchanged
- `dryRun: true` on all new tool outputs
