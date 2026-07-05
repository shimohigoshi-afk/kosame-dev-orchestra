# KOSAME Sales Console デモページ

## ステータス
- 社内確認用デモ（本番公開前）
- 本番公開には、正式住所・電話番号・問い合わせ先・会社情報の確定が必要
- SVG仮画像は本番用写真に差し替えが必要

## 公開手順（Cloudflare Pages）

### 方法A: Wrangler CLI（推奨）

```bash
# 1. 認証
npx wrangler login

# 2. デプロイ（スクリプト実行）
bash scripts/deploy-fk-omiya-demo.sh

# または直接実行:
npx wrangler pages deploy public/ --project-name=fk-omiya-branch
```

デプロイ後、`https://fk-omiya-branch-xxxxx.pages.dev` のようなURLが発行されます。

### 方法B: Cloudflare Dashboard（手動）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Pages
2. 「Create application」→「Pages」タブ→「Direct Upload」
3. プロジェクト名: `fk-omiya-branch`
4. `public/fk-omiya-branch.html` をアップロード
   - ファイル名を `index.html` にリネームしてアップロードすると `/` でアクセス可能
5. 公開後、発行された `.pages.dev` のURLを共有

### 方法C: GitHub Pages（代替）

1. GitHubリポジトリ Settings → Pages
2. Source: Deploy from a branch → `main` / `/public`
3. 保存後、`https://<user>.github.io/<repo>/fk-omiya-branch.html` でアクセス

## noindex設定
`<meta name="robots" content="noindex, nofollow">` を設定済み。
検索エンジンにインデックスされません。

## 公開前に確認すること

- [ ] ページが正しく表示される（スクロール、レスポンシブ）
- [ ] noindex が維持されている（`<meta name="robots" content="noindex, nofollow">`）
- [ ] 住所・電話番号が仮情報のままである
- [ ] お問い合わせフォームは未接続（仮リンク `#`）
- [ ] 保険・金融商品の断定表現がない
- [ ] 顧客情報・秘密情報が含まれていない

## 本番公開前に必要な作業
- 正式な住所・電話番号・営業時間の反映
- SVG仮画像→本番写真の差し替え（FV/メッセージ/サービス×6/支店紹介/マップ）
- Google Maps埋め込み
- お問い合わせフォームの送信先設定
- プライバシーポリシー詳細ページの作成
- noindexの削除

## 注意
- 本ファイルは KOSAME Dev Orchestra の一部として管理されています
- 本番公開時は別リポジトリに切り出すことを推奨
- 本番公開前の確認用であり、顧客への最終提示には使用しないでください
