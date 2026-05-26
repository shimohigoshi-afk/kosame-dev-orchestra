# Operator Unified CLI v1.2.1

## 概要
すべての Operator Console コマンドを単一エントリーポイントから呼び出せる統合 CLI。

## 目的
- 複数のツールファイルを個別に覚えなくても操作できる
- コマンドの一覧を `help` で即確認できる
- こさめPMが判断し、じゅんやさんは最終YES/NOのみ

## 利用方法
```bash
node tools/operator-unified-cli.js help
node tools/operator-unified-cli.js status
node tools/operator-unified-cli.js next
node tools/operator-unified-cli.js approval
```

## 設計原則
- dry-run / local-only
- 外部API・git push・deploy は一切呼ばない
- Human Approval Gate を常に維持
