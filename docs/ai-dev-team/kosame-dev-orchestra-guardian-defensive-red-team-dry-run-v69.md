# KOSAME Dev Orchestra Guardian Defensive Red Team Dry-Run v69.0.0

## 概要

攻撃シナリオをdry-runで想定し、防御チェックを設計するpackです。
実攻撃・実エクスプロイトは絶対に実行しません。

## シナリオ一覧 (6件)

| scenarioId | シナリオ | severity |
|------------|---------|----------|
| rt-001 | Secret leak via log output | critical |
| rt-002 | Unauthorized API endpoint access | critical |
| rt-003 | Customer data cross-tenant access | critical |
| rt-004 | Prompt injection via user input | high |
| rt-005 | IDOR (Insecure Direct Object Reference) | high |
| rt-006 | Insurance disclosure duty violation via AI | critical |

## 安全設計

- `dryRun: true` / `realAttackExecuted: false`
- 全シナリオ `realAttack: false`
- 実ペネトレーションテストは別途人間承認ゲート

## 使用方法

```bash
npm run pm-agent:guardian-defensive-red-team-dry-run
npm run smoke:guardian-defensive-red-team-dry-run
```
