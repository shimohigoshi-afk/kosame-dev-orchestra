# Operator Console Implementation Entry (v0.7.0)

## 実装への入り口
Operator Console の実装を開始するためのエントリポイントを定義する。

### 1. ディレクトリ構成案
- `apps/operator-console/`: フロントエンド (Next.js)
- `apps/pm-agent/api/`: バックエンド API (Express/Cloud Run)
- `shared/schemas/`: パケット定義の共有

### 2. 最初のタスク
- `operator-command-packet.js` を `shared/` へ移動し、フロント・バック両方で使えるようにする。
- じゅんやさんが Cloud Shell を開かずに、Web から `git push` を承認できる仕組みを作る。
