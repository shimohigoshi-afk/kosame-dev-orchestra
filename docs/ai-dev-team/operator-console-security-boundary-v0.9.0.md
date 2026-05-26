# Operator Console Security Boundary (v0.9.0)

## セキュリティ原則
- **No Secret Access**: API 経由で Secret 値（.env, APIキー）を返さない。
- **Read-Only by Default**: 読み取り専用アクセスを基本とし、破壊的な操作は API からは行わない（CLI 経由の人間による実行を優先）。
- **Local Access Only (Initial)**: 最初は localhost からのアクセスのみを許可する。

## 認証
将来的に Cloud Run にデプロイする場合は、IAP (Identity-Aware Proxy) または Bearer Token による認証を必須とする。
