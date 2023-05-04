# gas-jquantsapi

GoogleスプレッドシートからJ-Quants APIを利用します。

## 使い方

Googleスプレッドシートの「拡張機能」＞「Apps Script」からスクリプトエディタを起動します。

「ライブラリ」に `1fQcntI2lJBbiqfz1IaXLNOuJ8Z3IUuD5xiTsqfBzdJZMdcCMSTPJrsoX` を追加します。

「プロジェクトの設定」から「スクリプトプロパティを編集」で、次の情報を設定します。

- `JQUANTSAPI_MAILADDRESS`: メールアドレス
- `JQUANTSAPI_PASSWORD`: パスワード

「エディタ」をひらき、次のコードを入力します。

```javascript
jquantsapi.setProperties(PropertiesService.getScriptProperties());

function jquants_company_name(code ,date) {
  return jquantsapi.listed_info(code, date).CompanyName;
}
```

Googleスプレッドシートのセルに次のように入力します。

```
=jquants_company_name(2789)
```

指定したコード（2789）の企業名が表示されます。

## テスト

```shell
deno test test*.js
```

## 参考

- [J-Quants](https://jpx-jquants.com/)
- [J-Quants API リファレンス](https://jpx.gitbook.io/j-quants-ja/)
