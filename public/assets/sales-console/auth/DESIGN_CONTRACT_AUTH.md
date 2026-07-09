# KOSAME Sales Console Auth Login Design Contract

## Purpose
ログイン画面は Dashboard カードUIと分離する。カード用 `.tool-card`, `.card-visual`, `.card-visual-img` のCSSをログイン画面へ漏らさない。

## Repo assets
- `/assets/sales-console/auth/auth-umbrella-mark.svg`
- `/assets/sales-console/auth/auth-rain-streaks.svg`
- `/assets/sales-console/auth/auth-bg-motif.svg`
- `/assets/sales-console/auth/auth-login.css`

## Required implementation
1. `public/kosame-sales-console.html` のログイン画面だけに `auth-login.css` 相当のCSSを適用する。
2. 既存のログイン処理は変更しない。
3. パスワード表示ボタンは必ず `type="button"`。
4. ログイン送信ボタンは既存処理に合わせて `type="submit"` または既存onclickを維持。
5. 仮ログイン・認証スキップは禁止。
6. localStorage/sessionStorageの新規仕様追加は禁止。
7. DashboardカードのSVG実装は触らない。

## Visual target
- Compact premium login card
- Navy and gold
- Umbrella mark 104〜132px
- Panel width 420〜460px
- No excessive vertical spacing
