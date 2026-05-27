# KOSAME Operating Console Operating Guide
## こさめ副社長向け操作ガイド v3.0.0

---

## 概要

このガイドはこさめ副社長がKOSAME Dev Orchestra Operating Console (v3.0.0) を使用して開発オペレーションを管理するための手順書です。

---

## Operating Console の4つのモード

### 1. command モード（日常操作）

```js
runOperatingConsole({ command: 'status', input: repoState })
runOperatingConsole({ command: 'commit-check', input: checkInput })
runOperatingConsole({ command: 'push-check', input: pushInput })
runOperatingConsole({ command: 'release-check', input: releaseInput })
runOperatingConsole({ command: 'dispatch', input: dispatchInput })
```

### 2. decision モード（次アクション判断）

```js
runOperatingConsole({
  mode: 'decision',
  input: { currentState: healthSnapshot, sessionGoal: 'Release v3.0.0' }
})
```

判断優先順位:
1. verify失敗 → Claude係長修正 (urgency: high)
2. Actions失敗 → トリアージ (urgency: high)
3. 変更あり+verify未実施 → npm run verify (urgency: normal)
4. 変更あり+verify済み → commit-check (urgency: normal)
5. origin先行 → push-check (urgency: normal)
6. 全グリーン → release-check (urgency: low)

### 3. health モード（リポジトリ健全性確認）

```js
runOperatingConsole({
  mode: 'health',
  input: { git: gitData, actions: actionsData, verify: verifyData }
})
```

### 4. list モード（コマンド一覧）

```js
runOperatingConsole({ mode: 'list' })
// → 全13+コマンド + 人間承認必要コマンド一覧
```

---

## 人間承認が必要な操作 (じゅんやさん専管)

| コマンド | 理由 |
|---------|------|
| push-check → YES | git push origin main |
| release-check → YES | git tag + push |
| release-gate → open | 全条件確認後 |
| tag-readiness → YES | git tag 実行 |
| approval-summary | Critical/High リスク操作 |

**これらは絶対にこさめ副社長が自律実行しない。じゅんやさんのYES後のみ実行。**

---

## 典型的な作業フロー

```
1. health モードで現状確認
   ↓
2. decision モードで次アクション決定
   ↓
3. command モードで具体的チェック実行
   ↓
4. (人間承認必要なら) approval-summary → じゅんやさんへ
   ↓
5. じゅんやさんYES後に実行 (tag/push等)
```

---

## Safety Constraints (変更不可)

- ANESTY Board本体には触らない
- Secret / .env / API key を読まない
- 外部APIを実行しない
- git pushしない / git tagしない (じゅんやさんYES前)
- rm -rfしない / git reset --hardしない
- dryRun: true — 全ツール出力はdry runのみ
