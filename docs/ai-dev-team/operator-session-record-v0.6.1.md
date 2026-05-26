# Operator Session Record (v0.6.1)

## 概要
Operator Session Record は、一連の作業セッション（例: v0.5.1〜v0.7.0 の実装セッション）の経過と結果を記録するものである。これは、別のエージェントや人間への「引き継ぎ」の正本となる。

## 記録項目
- **Session ID**: SES-YYYYMMDD-NNN
- **Current Version**: セッション開始・終了時のバージョン
- **Completed Work**: 完了したタスクパケット
- **Failed / Skipped Work**: 完了できなかったタスクとその理由
- **Next Action**: 次のセッションで最初に行うべきこと
- **Risks / Handoff Memo**: 注意点や申し送り事項

## 運用
セッションの最後には必ず `Session Completion Record` を生成し、`README.md` や `docs/` に反映させるか、お引越し用の `HANDOFF.md` に記載する。
