# Operator Smoke Registry v1.2.5

## 概要
全 smoke test の登録と状態追跡レジストリ。

## 目的
- どの smoke test が登録済みかを一元管理
- pass/fail 状態を記録し、リリース判定に使用
- 新規パック追加時に自動的にレジストリへ追加

## レジストリポリシー
- 全登録エントリーがリリース前に pass 状態であること
- `status: "unknown"` はまだ実行されていないことを示す
- `status: "passed"` / `"failed"` は最新の実行結果を示す

## 利用方法
```bash
node tools/operator-smoke-registry-pack.js
```
