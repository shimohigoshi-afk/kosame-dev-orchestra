# Dev Orchestra Operator Console Foundation — v0.5.0

## 概要

v0.5.0 で導入される、Dev Orchestra 全体を俯瞰・操作するためのオペレータコンソールの基盤設計。
複数のエージェントの状態、コスト、リリース状況を一元管理するためのデータ構造とコマンド体系を定義する。

---

## コンソールの役割

1. **状況可視化**: 全エージェントの稼働状況と最新の smoke test 結果の表示。
2. **一括操作**: 複数エージェントへの同時指示（例：全エージェントの Flash モデル強制）。
3. **ガバナンス管理**: 未承認のリリースパケットの確認と承認フローのトリガー。
4. **コスト監視**: リアルタイムでのトークン消費量と予算達成率の表示。

---

## コンソールツール

```bash
# オペレータコンソールパケット生成
node tools/dev-orchestra-operator-console-pack.js
```

---

## 基盤設計思想

- **Stateless**: コンソール自体は状態を持たず、各エージェントの API やログから動的に情報を収集する。
- **Read-only by default**: 情報の閲覧を基本とし、変更操作には個別の明示的な承認を必要とする。
- **Extensible**: 新しい拡張パックやエージェントが追加された際、最小限の設定変更で追従可能とする。

---

## 参考

- `docs/ai-dev-team/operator-command-map-v0.5.0.md` — コマンドリファレンス
- `docs/ai-dev-team/operator-dashboard-data-contract-v0.5.0.md` — データ連携仕様
- `docs/ai-dev-team/KOSAME_DEV_ORCHESTRA_SPEC_v0.1.0.md` — 全体仕様書
