# Operator Local Console Complete Flow v1.4.0

## 完成フロー図

```
[オペレーター] → node tools/operator-unified-cli.js <command>
                           ↓
                   [コマンドルーター]
                    /    |    |    \
               status  next  approval  handoff
                 ↓      ↓      ↓        ↓
           [状態表示] [次推奨] [承認] [引き継ぎ]
                           ↓
              [こさめPMが判断・整理]
                           ↓
              [じゅんやさん：YES / NO]
```

## 典型的な操作フロー

1. `node tools/operator-unified-cli.js status` で現状確認
2. `node tools/operator-unified-cli.js next` で次アクション確認
3. 承認が必要なら `node tools/operator-unified-cli.js approval`
4. セッション終了時は `node tools/operator-unified-cli.js handoff`

## 安全性保証
- 全コマンドは dry-run / local-only
- 外部への影響は一切ない
- Human Approval Gate が必要な操作は必ず明示
