# KOSAME Dev Orchestra Cost/Speed/Quality Scorecard v108.0.0

## Purpose
Score AI development route by cost, speed, quality, risk, human burden, maintainability.

## Operating Principle
**Guard only irreversible danger zones; move fast everywhere else.**

## Route Scorecard
| Route | Cost | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| ClaudeCode_implementation | medium | fast | high | file edits, smoke, verification |
| GPTAgent_PM | medium | medium | high | planning, PM, design |
| Gemini_bulk | low | fast | medium | bulk reading, summarization |
| Grok_adversarial | medium | medium | high | weakness, red team |
| LightweightModel | low | very fast | medium | simple classification, routing |
| Human_approval_only | zero AI | slowest | highest | **irreversible actions only** |

## Routing Guidance
- Default implementation: ClaudeCode
- Planning/design: GPTAgent
- Bulk review: Gemini
- Adversarial: Grok
- Simple tasks: LightweightModel
- Irreversible: Human only

## Tool
`tools/dev-agent-cost-speed-quality-scorecard-pack.js`

## Version
108.0.0
