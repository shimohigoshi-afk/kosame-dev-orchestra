# v110.84.2 KOSAME Console Branding & Project Registry Lite

- 目的: cockpit の名称を `☂️ KOSAME Console` に統一し、STATUS カードを project registry 由来にする
- 実装範囲: read-only 表示のまま、`projects` 配列を snapshot と UI に流す
- 危険ゲート: git write 操作なし、Secret / `.env` / credentials 非読取、Sales DX / transcriber 非変更
- smoke: project registry 読込、fallback、`Readonly` mode 表示、既存機能の無破壊確認
