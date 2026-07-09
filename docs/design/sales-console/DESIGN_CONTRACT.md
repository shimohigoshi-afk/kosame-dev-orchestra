# KOSAME Sales Console — Design Contract

## Reference Image
- `ui-asset-board-reference.png` — 本ファイルと同ディレクトリに配置。デザイン正本として参照のみ。UIに直接貼り付け禁止。

## Color Tokens
| Token | Value |
|-------|-------|
| Deep Navy background | `#020a14` |
| Panel/Card Navy | `rgba(10,26,47,.96)` → `rgba(5,15,29,.98)` |
| Gold | `#d8b56a` |
| Gold light | `#e8cf8f` |
| Text | `#f3f7fb` |
| Muted | `#8fa3b6` |

## Typography
- Body: `'Noto Sans JP', 'Inter', system-ui, sans-serif`
- Brand: `'Shippori Mincho'` (KOSAME ロゴのみ)
- Card title: 17px / 750 weight / letter-spacing .025em
- Card desc: 13px / line-height 1.65

## Card Layout (Dashboard)
- Grid: `minmax(0,1fr) 42%` (左テキスト / 右ビジュアル)
- min-height: 120-136px
- padding: 20px 24px
- gap: 20px+
- Left icon-ring: **display:none** (Dashboardカードのみ)
- Right card-visual-img: max-width 250-280px, height 110-126px, object-fit contain

## Card Visual SVGs
- 17 dedicated SVG files at `public/assets/sales-console/cards/*.svg`
- Referenced via `<img class="card-visual-img" src="assets/sales-console/cards/xxx.svg">`
- No inline SVG watermarks in HTML

## Calculator
- Size: 500×660px
- Display: 64px height, 30px font
- Buttons: 56px min-height, 18px font
- Close: ✕ button in header (top-right). No bottom close button.

## Sales Support
- Collapsed by default (aria-expanded="false")
- Cards: 2-column, gap 24px, min-height 160px, padding 26px 28px

## Floating Tools
- Whiteboard, Meeting Memo, Calc Memo, Calculator — all draggable, maximizable
- No localStorage/sessionStorage for state/position

## Prohibited
- Inline SVG watermarks on cards
- PNG images as card visuals
- Image generation or manipulation of reference assets
- External libraries
- LOAN_TAX_RULES modification
- Auth/API changes
