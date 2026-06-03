# KOSAME Dev Orchestra Operating Manual Pack (v39.0.0)

## 目的
KOSAME Dev Orchestraの使い方・役割分担・安全境界・作業フロー・実repo投入手順を one-stop で参照できる運用manual packetを生成する。

## 役割分担

| 担当 | 役割 |
|------|------|
| じゅんやさん | 最終YES担当 — git/deploy全操作の最終承認 |
| Kosame/GPT | PM・安全ゲート — ステージ承認・エスカレーション判断 |
| Claude | 実装担当 — packet生成・許可ゾーン内ファイル編集・verify |
| Gemini | Bulk work / draft expansion / fallback |
| Grok | Research / secondary review |
| DeepSeek | Code analysis / alternative suggestions |
| Kimi | Long-context document review |
| Cloud Shell | CLI (node/npm/git status read-only) |

## standardOperationFlow (15ステップ)
1. Intake
2. Product Selection (v32)
3. Connection Bridge (v27)
4. Work Order (v25)
5. Preflight (v25.5)
6. First Touch Dry Run (v33)
7. Launch Packet (v34)
8. Final Gate (v36)
9. Launch Handoff (v37)
10. Dry-run Dispatch (v28)
11. Claude Code実行 (controlled)
12. Handoff Import (v26)
13. Acceptance Gate (v38)
14. Commit Candidate
15. git add/commit/push/tag (Human実行)

## safeCommandPolicy
- alwaysAllowed: node --check / npm run verify / git status / git log / ls / find / cat (allowed zones)
- requiresHumanYes: git add / git commit / git push / git tag
- alwaysBlocked: git reset --hard / git clean -f / rm -rf / gcloud deploy / docker build / cat .env

## versionMilestones
| range | 概要 |
|-------|------|
| v1–v10 | Agent基盤 |
| v11–v16 | Operator Console |
| v17–v20 | Multi-Provider Routing |
| v21–v24 | Dev Factory |
| v25–v26 | Product Repo Preparation |
| v27–v30 | Connection Bridge & E2E |
| v31–v35 | Node24 & First Touch Readiness |
| v36–v40 | Final Gate, Handoff, Manual & Completion |

## 使用方法
```bash
node tools/kosame-dev-orchestra-operating-manual-pack.js
npm run pm-agent:kosame-dev-orchestra-operating-manual-pack
npm run smoke:kosame-dev-orchestra-operating-manual-pack
```
