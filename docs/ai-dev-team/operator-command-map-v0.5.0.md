# Operator Command Map — v0.5.0

## 概要

オペレータコンソールから実行可能な基本コマンドのマッピング。

---

## コマンド一覧

### エージェント管理 (`agent`)
| コマンド | 引数 | 説明 |
|---|---|---|
| `list` | なし | 全エージェントの一覧と状態を表示 |
| `status` | `[AGENT_ID]` | 特定エージェントの詳細ステータスを表示 |
| `restart` | `[AGENT_ID]` | エージェント（Cloud Run リビジョン）の再起動 |

### コスト管理 (`cost`)
| コマンド | 引数 | 説明 |
|---|---|---|
| `summary` | なし | 全体の累積コストを表示 |
| `set-limit` | `[AMOUNT]` | 予算閾値の変更 |
| `force-flash` | `on/off` | 全エージェントの Flash モデル強制モード切替 |

### リリース管理 (`release`)
| コマンド | 引数 | 説明 |
|---|---|---|
| `pending` | なし | 承認待ちのリリースパケット一覧 |
| `approve` | `[PACKET_ID]` | リリースの承認と実行 |
| `rollback` | `[AGENT_ID]` | 直前のバージョンへの切り戻し |

---

## 実行安全性

全ての破壊的コマンド（`restart`, `set-limit`, `approve`, `rollback`）は、実行前に `dry-run` 結果を表示し、オペレータの再確認を求める。

---

## 参考

- `docs/ai-dev-team/dev-orchestra-operator-console-foundation-v0.5.0.md`
