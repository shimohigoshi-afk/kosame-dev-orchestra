# Operator Gemini Work Scope v1.1.4

## Standard Work Boundaries

1. **Allowed**:
   - Creating/Editing `docs/`.
   - Creating/Editing `tools/`.
   - Creating/Editing `smoke/`.
   - Creating/Editing `fixtures/`.
   - Updating `README.md` and `package.json`.

2. **Prohibited**:
   - `run_shell_command`.
   - `git push` / `git tag`.
   - `gcloud` / `docker` commands.
   - Accessing `.env` or Secrets.
   - Deleting core infrastructure files.

3. **Verification**:
   - Gemini must provide smoke tests.
   - Human operator will run `npm run verify` in Cloud Shell.
