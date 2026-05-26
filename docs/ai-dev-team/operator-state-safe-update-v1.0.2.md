# Operator State Safe Update v1.0.2

## Update Policy
Updates to the operator state must follow these safety rules:

1. **Validation**: All updates must match the expected schema.
2. **Audit**: `updatedAt` must be updated automatically.
3. **No Secrets**: Any field containing "key", "secret", "token", or "password" must be rejected if it appears in the updates.
4. **Consistency**: `currentVersion` should follow semantic versioning.

## Example Usage
```javascript
const newState = updateState(oldState, {
  workflowStatus: 'Verifying',
  nextAction: 'Run smoke tests'
});
```
