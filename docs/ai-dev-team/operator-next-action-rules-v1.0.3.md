# Operator Next Action Rules v1.0.3

## Rule Definitions

1. **Verification Rule**:
   - Condition: State is `Idle` and there are new implementations.
   - Action: `run_verify`
   - Target: `npm run verify`

2. **Claude Escalation Rule**:
   - Condition: Verification `failed`.
   - Action: `send_to_claude`
   - Reason: Automated fix needed.

3. **Human Approval Rule**:
   - Condition: `riskLevel` is `High` OR `Critical`.
   - Action: `human_approval_required`
   - Reason: High risk operation requires manual review.

4. **Commit Rule**:
   - Condition: Verification `passed` and `lastCommit` doesn't match current work.
   - Action: `commit_candidate`

5. **Release Rule**:
   - Condition: GitHub Actions `success`.
   - Action: `release_record`
