# Operator Self Review Rubric v1.3.0

## ルーブリック（評価基準）

### クリティカル（全て必須）

| 基準 | 確認方法 |
|---|---|
| 全 smoke test が pass | `npm run verify` が0 exit |
| 禁止アクションがスクリプトに含まれない | Safety Contract 照合 |
| Safety contract 検証済み | `node tools/operator-safety-contract-pack.js` |
| Human Approval Gate が存在する | ドキュメント確認 |
| .env / Secret アクセスがない | ファイル内容確認 |

### 高優先度

| 基準 | 確認方法 |
|---|---|
| 完成チェックリスト 100% | `node tools/operator-completion-checklist-pack.js` |
| Smoke レジストリ最新 | `node tools/operator-smoke-registry-pack.js` |
| package.json version が milestone に一致 | `cat package.json` |

### 中優先度

| 基準 | 確認方法 |
|---|---|
| README 更新済み | ファイル確認 |
| Handoff document 生成済み | fixtures 確認 |

## RELEASE_READY 条件
全クリティカル項目が `passed: true` であること。
