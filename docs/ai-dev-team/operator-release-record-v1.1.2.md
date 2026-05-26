# Operator Release Record v1.1.2

## Purpose
- Document the successful completion of a release or milestone.
- Provide a permanent record of what was deployed and verified.

## Key Fields
- `version`: The version being released.
- `commit`: The final commit hash.
- `pushed`: Boolean indicating if the commit was pushed to remote.
- `actionsStatus`: Final status of GitHub Actions.
- `verified`: Boolean indicating if `npm run verify` passed.
- `releaseNotes`: Summary of changes.
- `nextVersionCandidate`: Suggestion for the next version number.
