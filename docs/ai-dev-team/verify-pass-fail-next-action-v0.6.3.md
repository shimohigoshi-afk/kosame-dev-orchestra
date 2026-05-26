# Verify Pass/Fail Next Action (v0.6.3)

## 判定後の次アクション

| 判定クラス | 次アクション | 担当 |
|---|---|---|
| `PASS` | `git commit` 承認 | こさめ PM |
| `SYNTAX_ERROR` | 即時修正依頼 | Claude Code |
| `LOGIC_FAIL` | ロジック再検討 & 修正 | Gemini -> Claude |
| `MISSING_FILE` | ファイル生成状況の再確認 | Gemini |
| `MISSING_SCRIPT` | `package.json` 更新 | こさめ PM / Claude |

## ポリシー
FAIL が 1つでもある場合、`commit` への進行は原則禁止（強制バイパスにはじゅんやさんの承認が必要）。
