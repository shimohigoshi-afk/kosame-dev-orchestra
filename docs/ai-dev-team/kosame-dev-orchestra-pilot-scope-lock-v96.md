# KOSAME Dev Orchestra Pilot Scope Lock v96.0.0

## Purpose
Lock pilot target product, scope, excluded scope, data boundary, Guardian requirements, and approval gates.

## Decision
- **Pilot Product**: anesty_board (safest first pilot candidate)
- **sales_dx**: HOLD — real customer/insurance/Gmail/PDF data boundary not cleared
- **No real customer data, real send, real contract, real billing, real deploy**

## Pilot Scope (anesty_board)
- task CRUD dry-run
- board display
- docs editing
- local mock data only

## Excluded Scope
- real customer data
- real billing
- real deploy
- live external sends

## Guardian Requirements
- Guardian Class must be confirmed before pilot start
- Human approval required for all irreversible actions

## Approval Gates
1. Junya final YES for pilot start
2. Guardian readiness confirmed
3. Data boundary sign-off
4. No real customer data confirmed

## Tool
`tools/dev-agent-pilot-scope-lock-pack.js`

## Version
96.0.0
