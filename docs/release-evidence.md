# 公開と配信の検証記録

## 0.2.0の公開（2026-09-26）

[PR #17](https://github.com/geeknees/devouch/pull/17)で階層ENS・独立した複数推薦・agentの限定プロフィール権限・Maintainers画面を取り込み、承認済みの手順に従ってPagesを更新した。署名形式とreport_versionは1のまま、CLIと検証器の配布versionは0.2.0。[v0.1との実測比較と更新・切り戻し](upgrading-0.2.md)を参照。

| 項目 | 確認結果 |
|---|---|
| 検証したPR head | `af98bf9545c0373b65a9d9b28323cbcbf760cf64` |
| merge・配信commit | `046417f906852ae9432767a4f1872494c98047ee`。PR headと全ツリー一致 |
| 0.2.0固定Action | `4aa03f7f6bea64701a6bbab0ff6420df1457b2fb` |
| PR / push CI | [36219802274](https://github.com/geeknees/devouch/actions/runs/36219802274) / [36219799354](https://github.com/geeknees/devouch/actions/runs/36219799354)、success |
| main CI | [36219981222](https://github.com/geeknees/devouch/actions/runs/36219981222)、success |
| 実PR Action | [36219802283](https://github.com/geeknees/devouch/actions/runs/36219802283)、`valid / accepted`、`verifier_version: 0.2.0` |
| Pages配信 | [36220008983](https://github.com/geeknees/devouch/actions/runs/36220008983)、success |
| 公開画面 | [Namespaces](https://geeknees.github.io/devouch/#namespaces)、[Maintainers](https://geeknees.github.io/devouch/#maintainers) |

ローカルとCIでRuby70、TypeScript99、統合52の計221テスト、型・構文検査、配布物の再build一致を確認した。新しい7件の互換性テストは保存したv0.1配布物を同じ原本・同じ公式ENSコントラクトの状態へ通す。権限変更後の厳格化と、通常のdirect名の互換性を分けて確認している。

固定Actionの`action.yml`・`dist/bridge.mjs`・`lib/devouch/cli.rb`・`lib/devouch/github.rb`を匿名取得し、検証済みcommitとbytesが完全一致した。実PR Actionはauthor `701242`、base `dd4ffeb592bf78f08d1a6aac2d33293c7011d176`、上記headを照合し、既存の`geeknees.eth`の原本を受け入れた。snapshotは`2026-09-26T05:06:27.383Z`、Sepolia block `11784039` / `0x925b52b1b0319cb5e27214e6135165eff20e44016725b3798952f2a978c8ee34`、2 confirmations。方針digestは`sha256:ce77f04b8a1679ab784528a7feec24e0d3779c0d3b045b25950cea939ee9f653`で変更なし。

14:11:39 JSTにPagesの全11ファイルを認証なしで取得し、配信commitの`dist/web/`とbytesが完全一致した。外部CDNは追加していない。

| 配信ファイル | bytes | SHA-256 |
|---|---:|---|
| index.html | 37514 | `4ab55c7426bc19755a89a671a060a0a1b759e808a38681e336cf488304aab614` |
| app.js | 802393 | `f88ac2d8ece5c53df16e9d4a385129a58396cfb2b15f2e28be13aed8619830af` |
| style.css | 29085 | `1d81e95d7e6506f3ce02abd248c1a9c9170c7d316979a78519c4afee13ff1221` |

14:13 JST、新規Chromeの390px幅から実Sepoliaを読み取り、次を確認した。本人のウォレット拡張はこの自動確認には使っていない。

| 公開URL | 画面確認時刻（UTC） | block | 結果 |
|---|---|---:|---|
| [masusanou-dev.eth](https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify) | `2026-09-26T05:13:13.687Z` | 11784071 | 署名・証拠ともvalid、subject `github:287365775` |
| [geeknees.eth](https://geeknees.github.io/devouch/?name=geeknees.eth#verify) | `2026-09-26T05:13:26.213Z` | 11784072 | 署名・証拠ともvalid、subject `github:701242` |

両画面で`Vouched by geeknees.eth`、公開先との区別、`human verification: not included`を確認した。例示repo A accepted・B rejected（`issuer_not_trusted`）から、BのAdd this issuerでacceptedへ変わった。NamespacesのInspect parentはblock `11784075`で`geeknees.eth`の所有者`0x894108DC5640e36c478523228addA22b58Eeb79c`と、未接続の子registryを表示した。Maintainersで既存推薦を読み、明示選択後のworkflowに0.2.0固定SHAとethPandaOps RPCが含まれ、同意前のダウンロードは無効だった。

390 / 1280pxの全7タブ、計14通りで横溢れなし。page errorなし、通信先はPagesとTenderlyのみ、RPCは`eth_chainId`・`eth_getBlockByNumber`・`eth_getCode`・`eth_call`・`eth_getLogs`・`eth_getTransactionReceipt`だけだった。署名・取引・wallet接続は行っていない。

保存済みデモ・方針6ファイルと公開済み原本を維持した。remoteのv0.1 tag objectは`9fce3da74ea7e738ae7b5ce4265663a9d97ff407`、参照先は`4fc4407a3778aad9d0b71db2e1f3e8e58051570a`のまま。PR #2もOPEN、head `7ac246f17c441833cb3ece244cdf1377fe35e003`で不変。全ファイル・履歴のprivacy検査22件は、既知の帰属表記・公開承認済み発表者名・合成URL・公式docs URLと、保存した旧配布物に伴う同じ帰属表記であり、新しい秘密情報は含まれない。

14:13 JST時点で公開と読み取り確認が完了した。この時点では新しいサブネーム作成・公開・個別失効とagent権限操作の実Sepolia確認は未実施。その後、本人walletで新しい名前とresolver・agent identityを作成し、公開値を照合した。[PCでの実機確認記録](sepolia-namespace-check.md)に現在の進捗を記載する。ローカルEVMでの成功を実walletの成功には数えない。

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
