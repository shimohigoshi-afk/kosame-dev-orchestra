# FK Omiya Console — フィードバック収集 GAS セットアップ手順

## 概要

FK Omiya Console のフィードバック機能は、Google Apps Script (GAS) 経由で Google スプレッドシートにデータを保存します。

---

## ステップ 1: Google スプレッドシートの作成

1. Google スプレッドシートを新規作成
2. シート名を `Feedback` に変更（任意）
3. 1行目にヘッダーを設定:

```
A1: datetime
B1: category
C1: comment
D1: screen
E1: anonymousId
```

スプレッドシートの URL から **スプレッドシートID** をメモします。
例: `https://docs.google.com/spreadsheets/d/<スプレッドシートID>/edit`

---

## ステップ 2: Google Apps Script の作成

1. スプレッドシートのメニューから「拡張機能」→「Apps Script」を開く
2. `コード.gs` に以下のコードをペースト:

```javascript
const SHEET_NAME = 'Feedback';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // テストリクエストは無視
    if (data._test) {
      return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // ヘッダー行がなければ追加
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['datetime', 'category', 'comment', 'screen', 'anonymousId']);
    }

    sheet.appendRow([
      data.datetime || new Date().toISOString(),
      data.category || '',
      data.comment || '',
      data.screen || '',
      data.anonymousId || '',
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 週次サマリーメール送信（任意）
function sendWeeklySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  const header = rows[0];
  const data = rows.slice(1);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekData = data.filter(r => new Date(r[0]) >= weekAgo);

  const catCounts = {};
  weekData.forEach(r => {
    const cat = r[1] || '不明';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const top = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const body = [
    `FK Omiya Console 週次フィードバックレポート`,
    `期間: ${weekAgo.toLocaleDateString('ja-JP')} 〜 ${new Date().toLocaleDateString('ja-JP')}`,
    `件数: ${weekData.length}件`,
    ``,
    `カテゴリ別:`,
    ...top.map(([cat, cnt]) => `  ${cat}: ${cnt}件`),
    ``,
    `コメント一覧:`,
    ...weekData.filter(r => r[2]).map(r => `  [${r[1]}] ${r[2]}`),
  ].join('\n');

  // 送信先メールアドレスを設定してください
  const TO = 'shimohigoshi@kosame-ai.com';
  GmailApp.sendEmail(TO, `【FK Omiya】週次フィードバックレポート (${weekData.length}件)`, body);
}
```

---

## ステップ 3: Web App としてデプロイ

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類を「ウェブアプリ」に設定
3. 以下の設定を行う:
   - **実行ユーザー**: 自分（自分のGoogleアカウント）
   - **アクセスできるユーザー**: 全員（匿名を含む）
4. 「デプロイ」をクリック
5. 表示された **ウェブアプリの URL** をコピー

---

## ステップ 4: FK Omiya Console への URL 設定

1. FK Omiya Console を開く
2. 左サイドバーの「設定」をクリック
3. 「Google Apps Script Web App URL」欄に URL をペースト
4. 設定は自動保存されます（ブラウザの localStorage に保存）

---

## ステップ 5: 週次メール送信トリガーの設定（任意）

1. Apps Script エディタで「トリガー」（時計アイコン）をクリック
2. 「トリガーを追加」
3. 以下の設定:
   - 実行する関数: `sendWeeklySummary`
   - イベントソース: 時間主導型
   - 時間ベースのトリガーのタイプ: 週ベースのタイマー
   - 曜日: 月曜日
   - 時刻: 午前 8 時〜9 時

---

## Gemini AI 分析の設定

1. Google AI Studio (https://aistudio.google.com/app/apikey) で API キーを取得
2. FK Omiya Console の「設定」タブ →「Gemini API キー」欄に貼り付け
3. 「AI分析を実行」ボタンでローカルキャッシュを分析

**注意**: Gemini API キーはブラウザのローカルストレージに保存されます。共有端末では使用しないでください。

---

## データ保存の仕組み

```
ユーザー操作
    ↓
フィードバックモーダル入力
    ↓
① ブラウザ localStorage にキャッシュ保存（オフライン対応）
② GAS Web App に POST → Google スプレッドシートに追記
    ↓
管理者: 設定タブで集計確認 / Gemini分析実行 / 週次レポートDL
```

---

## セキュリティ注意事項

- GAS の URL は「全員アクセス可能」となるため、悪用防止のため URL は公開しないこと
- フィードバックに個人情報を含めないよう、UI 上に注意書きを表示しています
- Gemini API キーを他者に共有しないこと
