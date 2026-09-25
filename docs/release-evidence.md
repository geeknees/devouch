# 公開と配信の検証記録

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
推薦の署名・公開位置・方針比較は [Sepolia検証記録](demo-evidence.md)を参照する。
