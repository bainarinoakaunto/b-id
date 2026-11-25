# B! ID セットアップ手順

自作のオンラインサービスを、利用者が設定したB! IDで使えるようにする認証基盤です。メールアドレスは本人確認にのみ使用し、平文では保存しません。
GitHub Pages(画面)と Google Apps Script(サーバー側)だけで動きます。

## ファイル構成

| ファイル | 置く場所 | 役割 |
|---|---|---|
| `Code.gs` | Apps Script | 認証コードの送信、ログイン確認、トークンの発行・検証 |
| `index.html` | GitHub Pages (`b-id` リポジトリ) | 紹介ページ(トップ) |
| `login/index.html` | GitHub Pages (`b-id` リポジトリ) | ログイン画面 |
| `b-id.js` | GitHub Pages (`b-id` リポジトリ) | 各サービスが読み込む共通ファイル |

## 保存する情報

- users: 内部ID・利用者が設定したB! ID・メールアドレスのHMAC照合値・登録日（メールアドレスそのものは保存しません）
- sessions: トークンのハッシュ・ID・サービス名・有効期限
- services: 登録したサービスの名前とURL
- パスワードは使いません。新規登録ではメール認証後にB! IDを設定します。認証コードは10分だけ一時保管し、使用後または期限切れで消えます。
- HMAC秘密鍵はApps Scriptのスクリプトプロパティに保存します。スプレッドシートにはメールアドレスのHMAC値だけを保存します。

## 手順

### 1. Apps Script を用意する(スプレッドシートは自動で作られます)

1. script.google.com を開き、「新しいプロジェクト」を作る
2. `Code.gs` の中身を貼り付けて保存する
3. 関数 `setup` を選んで実行する(権限の承認が出たら許可する)
   → スプレッドシート「B! ID」が自動で作られ、`users` `services` `sessions` の3枚のシートができます
4. 画面下の実行ログに、スプレッドシートのURLが出ます。このスプレッドシートは**共有しない**こと

スプレッドシートのIDは、スクリプトのプロパティ(`SPREADSHEET_ID`)に保存されます。`setup` を実行し忘れても、最初のアクセスで自動で作られます。

### 2. メールの送信元を決める(任意)

- 何もしなければ、あなたのGoogleアカウントから、送信者名「B! ID」で送られます。
- 本来のアドレスを見せたくない場合は、別のGmailアドレスを「別のアドレスから送信」に登録して、`Code.gs` の `MAIL_ALIAS` に入れます。
- 無料のGmailだと、1日に送れるメールは約100通です。

### 3. ウェブアプリとして公開する

1. 「デプロイ → 新しいデプロイ → 種類: ウェブアプリ」
2. 実行ユーザー: **自分** / アクセスできるユーザー: **全員**
3. 表示された `https://script.google.com/macros/s/…/exec` のURLを控える

`Code.gs` を直したあとは、「デプロイを管理 → 編集 → 新バージョン」で再デプロイしてください。

### 4. 画面とJSのURLを書き換える

- `login/index.html` と `register/index.html` の `API_URL` に、手順3のURLを入れる
- `b-id.js` の `API_URL` に、手順3のURLを入れる
- `b-id.js` の `LOGIN_URL` を `https://ユーザー名.github.io/b-id/login/` にする

### 5. GitHub Pages で公開する

1. `b-id` というリポジトリを作り、`index.html`・`b-id.js`・`login/` フォルダを置く
2. Settings → Pages で、公開するブランチを選ぶ
3. `https://ユーザー名.github.io/b-id/` で紹介ページが、`https://ユーザー名.github.io/b-id/login/` でログイン画面が開けば成功です
   (ログイン画面は、サービスから開かないと「ログイン元のサービスが指定されていません」と出ます。これは正常です)
4. 紹介ページの【ここに…】の部分(サービス一覧と連絡先)を、自分の内容に書き換える

### 6. 使いたいサービスを登録する

`services` シートに1行ずつ追加します。

| serviceId | name | redirectUrl | active |
|---|---|---|---|
| kabuonrain | 株シミュレーター LIFE オンライン | https://bainarinoakaunto.github.io/Online-Stk-Simu/ | TRUE |

- `redirectUrl` はサービスのベースURLです。末尾に `/` を付けます。
- `active` が `TRUE` のサービスだけログイン・新規登録を許可します。`FALSE` の場合は無効です。
- このGSはメールアドレスをサービスへ渡さず、認証結果として `sub` と `userId` を返します。

### 7. 各サービスに組み込む

サービスのHTMLに次を足します。

```html
<script src="https://ユーザー名.github.io/b-id/b-id.js"></script>
<script>
  BID.requireLogin().then(function (user) {
    // user.id が使えます(shareEmail が TRUE のサービスなら user.email も)
    // ここにサービス本体の処理を書く
  });
</script>
```

そのほかの命令:

- `BID.user()` … ログイン中のユーザー(未ログインなら null)
- `BID.token()` … サービス側のサーバーで確認したいときに渡すトークン
- `BID.logout()` … ログアウト

サービスが自前のサーバーで重要な処理をする場合は、`BID.token()` をそのサーバーに渡し、サーバーから Apps Script の `verify` で確認してください。ブラウザ側の確認だけでは改ざんされる可能性があります。

## 安全のための仕組み

- 戻り先URLは、`services` シートに登録したものだけ許可
- トークンはサービス専用で、有効期間は7日(`SESSION_HOURS` で変更可)
- トークンは URL の `#` 以降で渡し、受け取ったらすぐアドレスバーから消す
- 認証コードは6桁・10分有効・1回だけ使える・5回間違えると無効
- 同じアドレスへの再送は60秒空け、全体でも10分に20通まで
- 認証コードの送信は、登録済みかどうかに関係なく同じ応答を返す

## 困ったときは

| 症状 | 確認すること |
|---|---|
| 「このサービスはB! IDに登録されていません」 | `services` シートの `urlPrefix` が、サービスのURLの先頭と合っているか(最後が `/` か) |
| 通信に失敗する | デプロイの「アクセスできるユーザー」が全員か。`/exec` で終わるURLを使っているか |
| 認証メールが届かない | 迷惑メールフォルダ、権限の承認、再デプロイ(新バージョン)をしたか |
| 「いま送信できません」 | 送信が一時的に多すぎます。しばらく待ってください。1日の上限も確認してください |

## 毎日の整理(おすすめ)

Apps Script の「トリガー」で、関数 `cleanup` を1日1回動かすと、期限切れのログイン情報が消えます。

## このリポジトリのテスト設定

- B! IDトップ: https://bainarinoakaunto.github.io/b-id/
- ログイン画面: https://bainarinoakaunto.github.io/b-id/login/
- テストサービス: https://bainarinoakaunto.github.io/Online-Stk-Simu-b-id-test/
- テストサービス登録行: `kabuonrain-test | 株シミュレーター LIFE（テスト） | https://bainarinoakaunto.github.io/Online-Stk-Simu-b-id-test/ | FALSE`

**重要:** `Code.gs` はこの公開リポジトリに置かず、Google Apps Scriptのプロジェクト内だけで管理してください。API_URLはApps Scriptのウェブアプリ公開後に設定します。


## 画面の構成（新規登録・ログイン分離）

- ホーム: `https://bainarinoakaunto.github.io/b-id/`
- 新規登録: `https://bainarinoakaunto.github.io/b-id/register/`
- ログイン: `https://bainarinoakaunto.github.io/b-id/login/`

新規登録では、①メールアドレス入力 ②メール認証 ③認証後にメールアドレス欄を消去 ④利用者がB! ID（半角英数字と _ の4〜20文字）を設定、の順に進みます。認証後の一時チケットにはメールアドレスそのものではなくHMAC照合値だけを10分間保持します。ログインでは登録済みメールアドレスを認証します。メールアドレスの平文はスプレッドシートに保存せず、HMAC照合値でアカウントを特定します。既存のusersシートは `setup()` 実行時に移行され、従来のアカウントには仮のB! ID（`user_` + 8文字）が割り当てられます。新規登録・ログインを有効にするには、最新の `Code.gs` をApps Scriptに反映して再デプロイしてください。
