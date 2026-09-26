# Roadmap 実装の完了条件

開始: 2026-09-26。基準は公開タグ `v0.1` / `4fc4407a3778aad9d0b71db2e1f3e8e58051570a`。
作業ブランチは `codex/roadmap-20260926`。ユーザー添付のRoadmap全体を対象にする。

## 合意した範囲

1. 推薦先ごとに `287365775.vouches.name.eth` のようなサブネームと独立した記録を持ち、複数の推薦を同時に保持して個別に失効できる。
2. エージェント用サブネームに公開identityを持たせ、推薦者がEnhanced Access Controlで限定した権限だけを付与・撤回できる。
3. rootから対象名までの名前・subregistry・所有者・関連権限・実装の履歴を検証する。変更後の復元によって古い推薦が再び有効にならない。
4. メンテナーが信頼する推薦者を選び、policyと公開済みSHA固定のActionを設定して、実際のPRで判定を確認できる導入経路を仕上げる。
5. 試用先はユーザーの2026-09-26の指定に従い `geeknees/devouch` とする。自repoでの導入試験として記録し、第三者による独立導入の実績には数えない。
6. World ID等は中央サービスを必須にしない検証が可能な場合にのみ追加する。公式仕様と実行可能な検証経路を確認し、条件の充足・不充足と証拠を記録する。

2026-09-26の追加合意: World ID 4.0 のオンチェーン検証は存在するが、標準のproof要求はRP署名鍵を扱うバックエンドを前提とする。利用者ごとに運用する案も未実証で、ユーザーは「それであれば引き続き見送ります」と指定した。今回の実装対象からWorld IDを外し、`human verification: not included`を維持する。調査の根拠は[オンチェーン検証](https://docs.world.org/world-id/idkit/onchain-verification)と[RP signatures](https://docs.world.org/world-id/idkit/signatures)。World ID全体に中央のDevouchサーバーが不可避だと結論したものではない。

## 維持するもの

- v0.1のタグ・公開サイト・既存のdirect ENS推薦・PR #2・公開済みの原本を維持する。
- 署名、原本bytes、失効履歴、snapshot、evidenceとrepo policyの分離、読み取り専用のCLI/Action/検証ページを維持する。
- 管理者の署名や取引は本人のwalletから行う。開発用の実EVMテストは使い捨てローカルアカウントを使う。
- 未検証・取得不能・未知実装は成功にしない。人間性・GitHubアカウント所有権・コード品質を推薦から推定しない。
- 既存の外部サービスへの書き込みと新しい公開は、具体的な差分と検証結果が揃った状態で扱う。

## 実装と検証の追跡

| 要件 | 完了を示す証拠 | 現在 |
|---|---|---|
| 階層registryの作成・接続・子の登録 | 固定した公式UserRegistry/Factoryを使う実EVMテスト、wallet UIのreceipt/readback、復旧 | 実装済み。公式コントラクトのローカルEVMと390pxブラウザで確認 |
| 同時に複数推薦・個別失効 | 二つ以上のサブネームでvalid、片方を失効・再掲載してももう片方はvalid | `hierarchy.test.ts`で確認 |
| エージェントidentityと権限 | 実walletの許可操作成功、未許可キー・兄弟・親・推薦操作失敗、権限撤回後失敗 | wallet serviceとブラウザで確認。共用resolverも拒否 |
| 階層履歴の検証 | 親の移転・復元、registry変更・復元、権限撤回・再付与、再登録、期限、同一block内変更、未知実装と欠損履歴の負例 | 14件の実EVM階層テストで確認 |
| CLI・Web・Actionの共通判定 | 公開原本の取得・検証、PR作者照合、方針のRuby/TypeScript一致、既存direct名の回帰確認 | 全統合・共有方針fixtureが成功。公開ActionはPR #17でvalid / accepted |
| メンテナー導入 | 信頼する推薦者の選択、設定出力、SHA固定workflow、説明と失敗時の案内、操作テスト | 実装・390pxブラウザ確認済み。固定SHAの匿名取得、実repoの同一Actionと明示RPCでの試用が成功 |
| 指定repoでの試用 | `geeknees/devouch` の具体的なcommit・PR・Action判定と原本・policyの照合記録 | PR #17で実施済み。下記の日時・block・commit・runを照合 |
| 中央サービス不要の人間性証明 | 公式仕様の調査結果、条件を満たす場合は任意の証明と正負の検証テスト | 再調査済み。ユーザー指定により引き続き対象外 |
| 配布・文書の一致 | build、unit、integration、Ruby、型・構文検査、dist再build一致、privacy検査、要求別の最終監査 | ローカル検査・公開ファイル照合・GitHub全CIが成功。RPC設定修正後もpush/PR双方のCIが成功 |

## 現在確認した設計上の前提

- 公式ENSv2 sourceは既存と同じ `71a3b7339dbc55ab47667abdfe8303bac4f4c24e` に固定する。
- 同commitの `UserRegistryImpl` は公式Factoryから作るUUPS proxyを初期化できる。既存のABI・bytecodeの出典管理を拡張する。
- `EACRolesChanged` のresource、registryのmutable token ID、`ParentUpdated`、各階層の`SubregistryUpdated`を区別して検証する。
- resolverのtext-key権限は複数recordへ作用するため、エージェントへの委譲には独立したresolverを使い、兄弟の名前へ権限を広げない。

## 進捗と確認済みの証拠

- `UserRegistryImpl` を同じ固定sourceから取り込み、実コントラクトの階層fixtureを追加した。
- サブネームを拒否する旧検証器で新テストが失敗することを確認してから、root→ETHRegistry→UserRegistryの経路検証を実装した。
- 最初の階層・既存境界の21テスト / 61 assertionsが成功。個別失効、親の移転・復元、再登録、subregistry・parent pointer・権限の復元、実装変更、祖先の最短期限、公開と同一block内の変更、未知実装、必要な履歴の取得失敗を確認した。
- 異なるregistryにある同じラベルを取り違える旧direct名前用チェックが新テストで失敗したため、イベントをregistryと名前の組で照合する共通判定へ整理した。
- TypeScript単体92 tests / 207 assertionsと型検査が成功。これはウォレット画面や最終配布物の完成を示すものではない。
- 新しいsourceの検証器から既存Sepolia推薦を読み取り確認した。masusanouは `2026-09-26T03:52:34.189Z`、block `11783683`、geekneesは `2026-09-26T03:52:42.110Z`、block `11783684` でいずれもvalid。既存の公開原本やチェーン状態への書き込みなし。
- この段階ではnamespace作成・接続・登録のwallet操作と復旧、エージェントidentityと限定権限、ブラウザからの一連の操作が残っていた。以下で完了を確認した。

### 2026-09-26 13時台の確認

- 上記のwallet操作と復旧、agent identity・プロフィール権限、Namespaces / Maintainers画面を実装した。`namespace_browser.test.ts`は390px幅で応答消失→再読込→取引復旧→二階層作成→resolver接続→agent作成・権限付与・プロフィール更新・撤回まで実コントラクトを使って成功した。
- 全統合45 testsが成功。その後に追加したagent resolver共用の拒否、階層名の`check-name.ts`診断は、失敗を確認して修正し、対象テストで成功した。親名の既存推薦を維持する確認を含むnamespace serviceは3 tests / 34 assertions。TypeScript単体98 tests / 300 assertions、Ruby70 tests / 378 assertions、型検査とRuby構文検査が成功。
- 全13配布ファイルのSHA-256をbuild前後で照合し、完全一致した。`.devouch/policy.json`と`.devouch/local/demo/`の保存済み6ファイルのdigestも変更なし。
- コミット対象のprivacy検査は問題なし。全追跡ファイルと履歴の18件は既存の著作権表記、公開済み発表者名、テスト用URL、公式ドキュメントURLへの一致であり、新しい秘密情報・私的な実行パスは含まれない。staged差分の空白検査も成功。
- `check-name.ts masusanou-dev.eth` は `2026-09-26T04:21:19.430Z`、Sepolia block `11783823` / `0x05422888bbd20aac7407b605b857c5e33679f0d1d6d8d71d124e795661b74193` でowner・親経路・既存resolverを取得し、ready true / record 1 / 原本785 bytesを確認した。チェーンへの書込みなし。
- World sandbox discoveryを再読取りし、`token_endpoint_auth_methods_supported`は`client_secret_basic` / `client_secret_post` / `private_key_jwt`だった。READMEの説明を共通運用した場合の依存として限定し、オンチェーン検証の存在を否定しない表現にした。
- `main`のBoundaries追記 `dd4ffeb592bf78f08d1a6aac2d33293c7011d176` を取り込み、レビュー済みの表現に調整した。実装commitは `99e6466ce96e50a22a11a0205bb1d38dfbacfc81`。workflowとMaintainersの既定値をこのSHAへ固定した。現段階ではローカルcommitであり、公開済みとは扱わない。
- この時点では新ブランチの公開、固定Actionの匿名取得と実repo試用、外部結果のreadbackが残っていた。以下で公開と試用を確認した。

### 公開と自repoでの試用（2026-09-26 13:37 JST）

ユーザーの明示承認後に作業ブランチをpushし、[PR #17](https://github.com/geeknees/devouch/pull/17)を作成した。本文は準備したファイルと完全一致し、base/head・作者・宛先をGitHub APIで読み戻して確認した。公開Action `99e6466ce96e50a22a11a0205bb1d38dfbacfc81` の`action.yml`・`dist/bridge.mjs`・`lib/devouch/action.rb`・`src/hierarchy.ts`を匿名取得し、検証済みcommitのbytesと一致した。

| 項目 | 確認結果 |
|---|---|
| Action run | [36218361289](https://github.com/geeknees/devouch/actions/runs/36218361289)、success |
| base / head | `dd4ffeb592bf78f08d1a6aac2d33293c7011d176` / `d0f8198421b5d2f10accbf996d641a1b3b56c238` |
| 作者と推薦 | GitHub PR作者の数値ID `701242`、`github:701242`、`geeknees.eth`、`eth → geeknees.eth`の経路 |
| 結果 | `valid / accepted`、理由コードなし、CLI/Action終了コード0、`human_verification: not_included` |
| 確認日時 | `2026-09-26T04:37:11.504Z`（13:37:11 JST） |
| snapshot | Sepolia `11783899`、2 confirmations、hash `0x0c5129d08f18ff7e2887838c0694800a16ecb6934519969c52eb93c4dad4cd45` |
| 方針digest | `sha256:ce77f04b8a1679ab784528a7feec24e0d3779c0d3b045b25950cea939ee9f653` |
| 原本 | `.devouch/vouches/github-701242.json`、777 bytes、SHA-256 `cf93358054495ef9a50de1919456266be718dee9632be4f7b3e834a0db27e9a5` |
| RPC | `https://rpc.sepolia.ethpandaops.io` をworkflowへ明示。Maintainersの出力も同じ指定 |

初回の[run 36218152051](https://github.com/geeknees/devouch/actions/runs/36218152051)とその再実行は、Tenderlyから必要なRPC応答を得られず`unavailable / not_evaluated`、CLI終了コード3で停止した。原本・署名・方針・固定Actionを変更せず、代替RPCをworkflowへ明示すると成功した。ローカルではTenderly（04:32:07Z、block 11783876）とethPandaOps（04:35:10Z、block 11783889）の両方で同じ方針を満たした。取得できなかった具体的なRPC応答の原因までは特定していない。

初回head `639969f302664f5b8b053a31bba2832f8c6a1c32` の[push CI](https://github.com/geeknees/devouch/actions/runs/36218108594)と[PR CI](https://github.com/geeknees/devouch/actions/runs/36218152069)は全チェック成功。RPC設定修正後は導入の単体テスト・390pxブラウザテストを再実行し、成功した。

修正後のhead `d0f8198421b5d2f10accbf996d641a1b3b56c238` でも、[push CI 36218359032](https://github.com/geeknees/devouch/actions/runs/36218359032)と[PR CI 36218361299](https://github.com/geeknees/devouch/actions/runs/36218361299)が成功した。Ruby70 tests、TypeScript98 tests、統合45 tests、型・構文検査、dist再build一致をGitHub runnerで確認している。

この試用は自repoで既存のdirect ENS推薦を新しい検証器へ通したものである。新しい階層名・agent権限は固定した公式コントラクトのローカルEVMで検証した。実Sepoliaでの新サブネーム作成、独立した第三者による導入、Roadmap版のmainへの取り込みとPages更新はこの記録では実施済みと扱わない。既存Pages・PR #2・v0.1タグ・保存済みの推薦原本と方針を、この作業では変更していない。
