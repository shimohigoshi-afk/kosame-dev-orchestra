# Operator Local Console Command v1.1.0

## Purpose
- Provide a unified, user-friendly CLI entry point for all operator tasks.
- Act as the primary interface for Junya-san during local operations.

## Commands
- `status`: Aggregated view of the operator state.
- `next`: Recommendation for the next action.
- `approval`: Summary of pending approvals.
- `handoff`: Generate the handoff document.
- `verify`: Entry point for recording verification results.
- `actions`: Entry point for recording GitHub Actions results.
- `dashboard`: Snapshot of all key metrics.

## Design
- Minimalist and high-signal.
- DRY-RUN by default.
- No direct shell execution.
