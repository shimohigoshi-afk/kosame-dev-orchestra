# KOSAME Dev Orchestra Spec v0.1.0

## Position

KOSAME Dev Orchestra is a common AI development team OS for ANESTY Board, KOSAME Sales DX, future PWA, meeting-minutes DX, lead-discovery tools, and Cloud Run based products.

It is not an ANESTY Board-only feature.

## Version separation

- ANESTY Board uses v87.0.x for bot implementation history.
- KOSAME Dev Orchestra uses v0.1.0 and later for common development-team design.

These must not be mixed.

## Roles

- じゅんやさん: final decision maker / business owner
- こさめ PM: design, routing, safety gate, Claude Code ticket generation
- Gemini Agents: long document reading, log summary, GCP / Cloud Run / Secret Manager first review
- Claude Code: implementation
- GitHub Actions: verify / smoke automation
- Cloud Run: execution platform
- GitHub: source of truth
- Secret Manager: secret vault

## Principle

じゅんやさんをコピペ作業員にしない。
Human approval remains for commit, push, deploy, billing, secrets, and production-impacting operations.
