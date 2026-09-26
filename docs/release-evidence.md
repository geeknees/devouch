# 公開と配信の検証記録

## 操作改善の公開（2026-09-26 09:12 JST）

[PR #6](https://github.com/geeknees/devouch/pull/6) で入力変更時の確認・署名の解除、
ウォレットなしの取得導線と取得結果、CLIの日時検査、提出・導入資料を更新した。

| 項目 | 確認結果 |
|---|---|
| 公開画面 | https://geeknees.github.io/devouch/ |
| 検証したPR head | `0cde0713cf1469cb9b5446c9b3f3528876b09e13` |
| merge・配信commit | `e514d40d7baf78c6e5a387423c90450836c95b48` |
| PRのテスト | [Test run](https://github.com/geeknees/devouch/actions/runs/36203607078)、success |
| mainのテスト | [Test run](https://github.com/geeknees/devouch/actions/runs/36203712016)、success |
| Pagesの配信 | [Publish workspace](https://github.com/geeknees/devouch/actions/runs/36203893579)、success |

Ruby 19、TypeScript単体25、結合15の計59テストと型・構文検査、配布物の再build一致を確認した。
認証なしで配信10ファイルを取得し、上記commitの `dist/web/` とbyte単位で一致した。
同commitのREADMEと固定Action `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` の
`action.yml`・`dist/bridge.mjs` も匿名取得し、Git内容との一致を確認した。
今回更新した配信ファイルは次の2点。他の8ファイルには同梱フォント・ロゴ・CSS・licenseを含む。

| ファイル | bytes | SHA-256 |
|---|---:|---|
| `index.html` | 14303 | `831abb0199018b611adf55cd76814cd03c8762ff2cfcf0a94fc0e76bcd1fdbff` |
| `app.js` | 644917 | `5588e765275bf2d9d761ea542ea9f5ebb860787eace98b8eb741b2dff43b38f0` |

公開URLを新規Chromeで開き、320 / 390 / 600 / 768 / 1024 / 1440pxの全4タブを確認した。
24通りで横溢れはなく、JavaScriptエラーと許可外の通信は0件。
ウォレットを持たないブラウザから「Try without a wallet」で実Sepoliaの推薦を取得し、
推薦者・対象・期限・公開取引リンクを確認した。ダウンロードは785 bytes、
SHA-256 `744713f4d8d2b1685054969db5358d527cb1c6c6a12bca362160f742ef744256` で原本に一致した。
RPCは読み取りのみ。本人walletの失効リハーサルは提出後の計画に従い、今回の公開では実施していない。

## 新デザインと初回公開

新デザインは2026-09-26に [PR #4](https://github.com/geeknees/devouch/pull/4) をmergeし、
`53afeae72e095a6c401c3df53708fbcb0bf28bb7` を [Pages run](https://github.com/geeknees/devouch/actions/runs/36180553637) で公開した。
同梱フォントを含む10ファイルの照合、公開画面とREADMEロゴの確認は [デザイン検証記録](design-verification.md#公開先の確認) を参照。
以下は初回公開時の検証記録であり、新デザインより前の配布commitとファイル数を記録している。

2026-09-26 JST、ユーザー承認に基づき [PR #1](https://github.com/geeknees/devouch/pull/1) をmergeし、
[geeknees/devouch](https://github.com/geeknees/devouch) をpublicへ変更、GitHub Pagesを公開した。
現在のファイルとGit履歴の検査を終え、既存の氏名・個人メール・画像のイニシャルについても公開可の確認を得た。

## 公開対象

| 項目 | 確認結果 |
|---|---|
| 公開画面 | https://geeknees.github.io/devouch/ |
| 公開・配信commit | `3214991e616e118d921ea9575d06d5e121b584f4` |
| mainのテスト | [Test run](https://github.com/geeknees/devouch/actions/runs/36170464968)、success |
| Pagesの配信 | [Publish workspace](https://github.com/geeknees/devouch/actions/runs/36170813639)、success |
| Pages設定 | workflow、public、HTTPS enforced |
| Action固定commit | `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` |

認証なしのHTTPでrepoを取得し、固定Action commitの `action.yml` と `dist/bridge.mjs` が
ローカルの検証済みファイルとbyte単位で一致することを確認した。
Pagesの5ファイルも認証なしで取得し、配信commitの `dist/web/` とbyte単位で比較した。

| ファイル | bytes | SHA-256 |
|---|---:|---|
| `index.html` | 13162 | `d38c1adf26163c8ed7526cd424eb3cf8c741712d76f2694578e4fa09630f56a0` |
| `style.css` | 12921 | `130544255144f82d354f6f1c2ef79b52e5f1511b60983a4f7a5102d9eae136b9` |
| `app.js` | 643482 | `c4a69d4b4e9026278c42ddfaa7fdd9b79a06bc67b7312f198b84772e30f551d6` |
| `devouch-logo.svg` | 769 | `16d075eee5f4e5a20c216d490335a1e15b84b23f31c5ddb3cdd094b1be8895d2` |
| `THIRD_PARTY_NOTICES.txt` | 17840 | `b54576604c8b543ed73ded98ba82811466350a828e4cfe5054c1697a8bcd139a` |

## 公開ブラウザでの確認

新規Chromeから公開URLを開き、Publish・Retrieve・Withdraw・ENS setupの4タブを確認した。
390px幅で横溢れはなく、page errorもなかった。
ウォレットを接続せずRetrieveで `masusanou-dev.eth` を読み、ダウンロードした
`github-287365775.json` が次の公開原本に一致した。

- 公開block: `11780510`
- 原本: 785 bytes
- SHA-256: `744713f4d8d2b1685054969db5358d527cb1c6c6a12bca362160f742ef744256`

RPCへの呼び出しは読み取りのみで、署名・取引の送信はなかった。
これは公開画面からの取得と配信の確認であり、推薦付きfork PRや実Sepolia失効の検証ではない。
推薦の署名・公開位置・方針比較と、その後のmasusanouの実fork PRでのvalid / acceptedは
[Sepolia検証記録](demo-evidence.md)を参照する。実Sepolia失効は未実施。
