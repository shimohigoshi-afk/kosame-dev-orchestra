# Versioning and Changelog Policy — v0.4.9

## 概要

プロジェクトの一貫性を保つためのバージョニング（Semantic Versioning 準拠）と、Changelog の記述ルール。

---

## バージョニング規則

`MAJOR.MINOR.PATCH` の形式を採用する。

- **MAJOR**: 破壊的な変更、または大規模なアーキテクチャ刷新。
- **MINOR**: 機能追加、拡張パックの導入（例: v0.4.0 -> v0.5.0）。
- **PATCH**: バグ修正、ドキュメントの微修正。

エージェントによる自動更新時は、原則として `PATCH` バージョンをインクリメントする。拡張パック導入時は `MINOR` を上げる。

---

## Changelog 記述ルール

`README.md` または専用の `CHANGELOG.md` に以下の形式で記録する。

### [Version] - YYYY-MM-DD
#### Added
- 追加された機能や拡張パック。
#### Changed
- 既存機能の変更点。
#### Fixed
- 修正されたバグや問題。
#### Security
- セキュリティに関する改善。

---

## 参考

- `docs/ai-dev-team/release-governance-v0.4.9.md`
