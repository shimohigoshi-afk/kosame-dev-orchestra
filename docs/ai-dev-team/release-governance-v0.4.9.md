# Release Governance — v0.4.9

## 概要

v0.4.9 で導入される、プロダクションリリースに関するガバナンス指針。
安全なデプロイ、バージョニング、および人間による最終承認プロセスを厳格化する。

---

## リリース基準

リリースを実行するためには、以下の条件を全て満たす必要がある。

1. **Smoke Test 全件合格**: 全ての `smoke/*.js` が正常終了すること。
2. **Linter / Type Check 合格**: コード品質が維持されていること。
3. **Change Log 更新**: 変更内容が正しく記録されていること。
4. **Human Approval**: じゅんやさんによる最終承認が得られていること。

---

## リリースツール

```bash
# リリースパケット（承認用）生成
node tools/release-governance-packet.js
```

---

## ガバナンスフロー

1. **Pre-release**: 開発環境での smoke test 実行と変更点のまとめ。
2. **Approval Request**: `generateReleasePacket` で生成された内容を承認者に送付。
3. **Execution**: 承認後、本番環境へのデプロイを実行。
4. **Post-release**: `pm-agent-post-deploy-smoke.js` による本番環境の正常性確認。

---

## 参考

- `docs/ai-dev-team/versioning-and-changelog-policy-v0.4.9.md` — バージョニング規則
- `docs/ai-dev-team/human-approval-release-packet-v0.4.9.md` — 承認依頼テンプレート
- `docs/ai-dev-team/cloud-run-release-checklist-v0.2.3.md` — 旧リリースチェックリスト
