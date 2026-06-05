# KOSAME Dev Orchestra — Human Burden Meter Pack v110.3.0

## Purpose

Measure whether the workflow is putting too much burden back on Junya.

## Burden Bands

| Band | Score Range | Meaning |
|---|---|---|
| LOW | 0–10 | Normal — auto-proceed |
| WATCH | 11–25 | Monitor — slight increase |
| HIGH | 26–50 | Too many asks — compress |
| TOO_MUCH | 51+ | Reset to gate-supervised mode |

## Burden Sources and Weights

| Source | Weight |
|---|---|
| humanApprovalsRequested | ×2 |
| copyPasteActions | ×3 |
| repeatedConfirmations | ×4 |
| preferenceQuestions | ×5 |
| manualVerificationSteps | ×2 |
| chatConsultations | ×3 |
| repeatedDownloadsSaves | ×2 |
| unnecessaryDetours | ×6 |

## Rules

- No danger gate → `shouldAskUser: false`, proceed automatically
- Preference/comfort questions → do not ask
- Approval for irreversible/dangerous → one short YES/NO only

## Reduction Actions (HIGH/TOO_MUCH)

- Compress confirmations into one YES/NO
- Use failure snapshot instead of full log
- Continue automatically for routine work
- Defer non-critical choices
- Summarize only the next action

## Tool

`tools/dev-agent-human-burden-meter-pack.js`
