# KOSAME Live Cockpit Readonly Monitor 作業票

> バージョン: 110.80.0  
> 作業名: v110.80 KOSAME Live Cockpit Readonly Monitor  
> 種別: 作業票 / 実装前計画  
> 方針: read-only 監視画面から開始する

## 目的

じゅんやさんが別画面で、KOSAME Dev Orchestra と `kosame-sales-dx` の動きを同時に見られるようにする。  
まずは安全のため、操作ボタンなし・read-only の監視画面として実装する。

## 監視対象

- `~/kosame-dev-orchestra`
- `/home/lavie/repos/kosame-sales-dx`

## 画面の初期仕様

- read-only
- repoに変更を加えない
- git status を表示
- changed files を表示
- staged files を表示
- recent commits を表示
- GitHub Actions の最近の状態を表示
- 現在の作業対象repoを表示
- 危険ゲートを表示
- 次に人間承認が必要なものを表示
- ブラウザで見られる HTML 画面を用意する

## 画面表示セクション

- CURRENT MISSION
- ACTIVE REPO
- DEV ORCHESTRA STATUS
- SALES DX STATUS
- CHANGED FILES
- STAGED FILES
- RECENT COMMITS
- GITHUB ACTIONS
- HUMAN GATE
- WARNINGS
- NEXT ACTION

## 担当AI案

### 第一候補

- Codex
- 理由: ローカルのリポジトリ構造を確認しながら、read-only 監視画面の土台と安全ゲートを同時に設計しやすい

### 補助案

- Gemini
- 理由: 監視対象の状態整理や要約の補助に向く

### 使わないもの

- DeepSeek
- opencode

## 実装範囲

### 進める範囲

- 監視UIの仕様定義
- read-only スナップショット取得の設計
- HTML で閲覧できる監視画面の土台
- 危険ゲートの可視化
- 人間承認待ち項目の表示

### 進めない範囲

- git add
- commit
- push
- tag 操作
- repo変更コマンドの実行
- Secret / API key / `.env` / credentials の中身参照
- `kosame-sales-dx` の商品コード変更
- `transcriber` repo の変更
- DeepSeek / opencode の利用

## 変更予定ファイル

### 新規作成候補

- `docs/kosame-live-cockpit-v110-80.md`
- `tools/kosame-live-cockpit-snapshot.js`
- `tools/kosame-live-cockpit-server.js`
- `public/kosame-live-cockpit.html`
- `smoke/v110-80-live-cockpit-smoke.js`

### 更新候補

- `package.json`

### package.json 変更候補

- version を `110.80.0` に更新
- `cockpit:snapshot` を追加
- `cockpit:server` を追加
- `smoke:v110-80` を追加
- `verify` に `smoke:v110-80` を追加

## 危険ゲート

### 絶対禁止

- `git add`
- `git commit`
- `git push`
- `git tag`
- `git reset`
- `git checkout --`
- force push
- tag 上書き

### read-only 許可コマンド

- `git status`
- `git diff --name-only`
- `git diff --cached --name-only`
- `git log --oneline`
- `gh run list`

### child_process 利用時の制約

- read-only コマンドだけに限定する
- ユーザー入力を shell へ直接渡さない
- 秘密情報を読むコマンドを含めない

## 監視項目の意味

- `CURRENT MISSION`: 今の作業の目的を表示する
- `ACTIVE REPO`: いま見ている対象repoを表示する
- `DEV ORCHESTRA STATUS`: KOSAME Dev Orchestra 側の状態を表示する
- `SALES DX STATUS`: kosame-sales-dx 側の状態を表示する
- `CHANGED FILES`: 未ステージ変更を表示する
- `STAGED FILES`: ステージ済み変更を表示する
- `RECENT COMMITS`: 最新のコミット履歴を表示する
- `GITHUB ACTIONS`: 最近の Actions 状況を表示する
- `HUMAN GATE`: 次に必要な人間承認を表示する
- `WARNINGS`: 危険や制約を表示する
- `NEXT ACTION`: 次にやるべき安全な一手を表示する

## 実施方針

1. まずは作業票だけを確定する
2. その後、read-only スナップショット実装に進む
3. 監視画面の HTML 表示を用意する
4. 追加の操作ボタンや書き込み機能は入れない

## 完了時の報告観点

- 作業票内容
- 担当AI案
- 実装範囲
- 変更予定ファイル
- 危険ゲート
- `v110.80` を進めてよいか

