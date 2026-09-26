# ハッカソン版の実装と検証

開始: 2026-09-25 13:32 UTC（22:32 JST）。作業先: このリポジトリ。

開始時点は docs の12文書と `.gitignore` のみ。12文書を通読し、
`hackathon-planning.md` の優先順位に従って新規実装する。
過去の Devouch のコードは取り込まない。事前の設計資料を使用した事実を残し、
Building from Scratch の適格性を運営が確認したとは扱わない。

## 完成条件と証拠

| 条件 | 検証方法 | 状態 |
|---|---|---|
| Ruby CLI の request / fetch / verify / revoke | Minitest、実 CLI の JSON と終了コード | ローカルEVMで全コマンド確認。実Sepoliaでrequest・公開後fetch/verifyも確認 |
| EIP-712 署名、対象・期限・公開先・サイズの検査 | viem による正負のテスト | 実装・テスト済み |
| ENSv2 の実装固定、本文取得、履歴・snapshot 検証 | 公式 ABI、ローカル EVM と Sepolia の readback | ローカル通し確認、実Sepoliaの公開原本をvalidと検証 |
| 失効と再掲載拒否、リンク・実装変更の拒否 | 時系列を変えるテスト、実 EVM | ローカルEVMで確認 |
| 二つの repo 方針で再利用、片方だけ不採用 | 同じ署名を使う通しテスト | 実Sepoliaの同一原本・snapshotでaccepted / accepted / rejectedを確認 |
| 静的 Web の署名・公開・失効・復旧・ダウンロード | ブラウザとウォレット、receipt/readback | Chrome＋ローカルEVMで確認。本人walletの実Sepolia公開も確認、実失効は未実施 |
| 推薦者自身による resolver 準備とキー権限 | 公式 Factory と実コントラクトによるテスト | ローカルEVMで配備・接続・キー限定・grant撤回後の本人失効を確認 |
| 読み取り専用 Action、base/head 固定、PR 作者照合 | API/CLI 境界テスト、実 fork PR | masusanouの [PR #2](https://github.com/geeknees/devouch/pull/2) でvalid / accepted。作者・base/head・原本・方針digestを照合済み |
| 運営者不在でローカル UI と別 RPC から操作 | ローカル配布物での通し確認 | ローカルUI経由の本人公開、2社RPCで同じ原本の検証を確認。別ホストからの実操作は未実施 |
| README、導入手順、ライセンス、提出・デモ資料 | コマンド再実行とリンク検査 | 作成・更新済み。提出画像草案5点。動画は完成済みとユーザー確認（2026-09-26）。提出サイトへ直接アップロードするため、別の公開URLは不要 |
| 公開コード・配布 SHA・静的 live URL | 公開先の readback | repoとPagesを公開。操作改善版の配信10ファイルと固定Actionの匿名取得・一致、全タブ、ウォレットなしでの実ENS原本取得を確認。[公開記録](release-evidence.md) |

## 採用範囲

Ruby CLI、TypeScript/viem の検証補助、静的ウォレット UI、GitHub Action。
既存 ENSv2 Permissioned Resolver を使い、独自台帳・共通秘密鍵・運営者 API は置かない。
同時に一記録一推薦。World、委任、Git 全履歴、複数推薦の同時保持は含めない。
`human_verification: not_included` を常に明示する。
2026-09-26のユーザー確認に従い、動画制作は完了扱い。後続のデザイン改修も同日に実装・検証・公開を完了した。
52テスト、同梱フォント、キーボード・画面幅・コントラストと公開先の確認は [デザイン検証記録](design-verification.md) を参照。
同日のユーザー指定により、PRで失効は検証しない。PRの実機確認は有効な推薦の照合までとし、
masusanouのPRは完了扱い。人間名義の実PR検証も同日のユーザー指定で今回の対象から外す。
失効の機能とウォレット・CLIの確認範囲は別に記録する。
公開前に実装の最終確認と、追跡ファイル・Git履歴のプライバシー検査を完了する。

## 提出前の操作確認（2026-09-26 04:55 JST）

- CLI依頼の読み込みでENS名・対象ID・期限を入力欄へ反映する。秒を含む期限も保持する。
- 入力を変えた場合や別の依頼を読み込む場合は、古い確認・同意・署名を解除する。読み込みが失敗しても、以前の依頼を署名・公開できる状態へ戻さない。
- ウォレット待機中は入力を固定する。署名・接続のキャンセルも取引キャンセルと同じ案内を出し、再操作できる。
- ウォレットなしで取得へ進む入口を追加した。取得結果には推薦者・対象・用途・期限・公開先とSepoliaの取引リンクを表示する。別の取得に失敗した場合は、以前のダウンロードを新しい結果として残さない。
- Ruby 17 tests / 68 assertions、Bun単体25 tests / 74 assertions、結合15 tests / 67 Bun assertionsが成功。結合テスト内で追加のブラウザ操作も検査した。新規5ケースは修正前の失敗を確認し、修正後に成功した。
- strict型検査・Ruby構文検査・buildが成功。320 / 390 / 600 / 768 / 1024 / 1440pxの全4タブで横溢れなし。
- ローカルの修正版をChromeで開き、ウォレットなしで実Sepoliaの785 bytesの原本を取得。記録済みdigestと一致し、JavaScriptエラーと許可外の通信は0件。CLIの現在状態の比較は [再確認記録](demo-evidence.md#提出前の読み取り再確認)を参照。

続くCLI入力の確認で、Rubyの日時parserが存在しない日付・24時・範囲外の時差・うるう秒を自動補正することを確認した。
`request --expires-at` はこれらを保存前に `invalid_expiry` / 終了4で拒否するよう修正した。
5種類の不正入力がRPCを呼ばずファイルを残さないこと、うるう日と5種類の正しい時差表記が同じUnix秒になることを検査した。
Rubyは19 tests / 113 assertionsとなり、構文検査・結合15 tests / 67 Bun assertionsも再度成功。実CLIでも不正日付の終了4を確認した。
CLI・導入・送信者向けの文書に残っていた旧版コマンド、RPC未確認、ダウンロード未実装の説明を現在の実装へ合わせた。

[PR #6](https://github.com/geeknees/devouch/pull/6) の全チェックと、merge commit
`e514d40d7baf78c6e5a387423c90450836c95b48` の [main CI](https://github.com/geeknees/devouch/actions/runs/36203712016) が成功した。
同commitを [Pages run](https://github.com/geeknees/devouch/actions/runs/36203893579) で公開し、
09:12 JSTに配信10ファイルの一致、全24レイアウト、ウォレットなしでの実ENS原本取得を確認した。[公開記録](release-evidence.md) を参照。
今回の作業で実Sepoliaの取引は送信していない。本人walletの失効リハーサルは、提出後に行う既存の [当日計画](presentation/script.md)に従う。

外部の公開・push・ホスティング・Sepolia 取引は、成果物と操作対象を準備した後に
許可された範囲で実行する。ローカル EVM の成功を Sepolia や実 fork PR の成功には数えない。

## 実機の公開情報

2026-09-26 JST: デモ先はユーザー訂正により `geeknees/devouch`。ユーザー承認後にpublicへ変更済み。
送信者は `masusanou`、GitHub数値ID `287365775`。
ENS名はユーザー指定の `masusanou-dev.eth`、取得先は https://app.ens.dev/。
World sandboxは https://sandbox.auth.world.org/。World認証は未統合。

名前owner: `0x894108DC5640e36c478523228addA22b58Eeb79c`（EOA）。
resolver: `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160`、recordId 1、
配備block 11780025、固定した公式PermissionedResolverImplと一致。
本人walletの公開取引 `0xfa33b82bd93b8296b6866107328acf4b3ace32a876c7763c4cbd10ddb9141c96` が
block `11780510` で成功し、785 bytesの原本を取得できた。実gasUsedは `642290`。
同じ原本を2社RPC・同じsnapshotで検証し、二つの方針でaccepted、推薦者を不採用にした方針でrejectedを確認した。
原本・方針digest、block hash、期限、再取得用の公開位置は [Sepolia検証記録](demo-evidence.md)に記録した。

以下は公開前に行ったRPCとresolverの準備確認。

Tenderlyではblock `11780029` / hash
`0xb0f81c893af154c317bdd3579aab96c41cfaeb1b9e84e68b8d3dbbda84eba391`
を含む照会で準備状態を確認。実Ruby CLIで未送信requestを作成した。
PublicNodeでも探索修正後、block `11780085` / hash
`0xc3009f9257dca03112a5d0e8c41643d913e59baa8e08ce82d1e33318cede7cff`
の照会で同じowner・resolver・配備・空値を確認した。
古い無関係なstateはPublicNodeで取得不能だったため、現在から配備を探索する方法へ修正した。
既定は実名の履歴を読めた `https://sepolia.gateway.tenderly.co`。
どちらも公開推薦・失効の実取引を実施した証拠ではない。

追加確認ではPublicNodeの `eth_getCode` がblock 11780079で `historical state ... is not available` を返し、実名のprepareが失敗した。
直近状態を読めた時点の成功だけでは、時間経過後の履歴検証を保証できない。
Tenderlyにも一時的な取得失敗があったが、再確認ではprepareが成功した。
代替の `https://rpc.sepolia.ethpandaops.io` は実名のprepareが成功し、推薦欄は空だった。
さらに両RPCでblock `11780240` / hash
`0xe83ee69127edcc38dc13b67c96772778eaae97e04d89be473d4e32fac776bd07`
をsnapshotに配備直前・配備時のproxy検証と当時のowner照会を確認した。
同じ形式の785 bytesのデータは両者で664,611 gasの見積もり。署名はplaceholderで、公開原本や実取引の証拠ではない。
loopback画面を開いたChromeから両RPCへ接続し、CORS経由でもSepoliaのchain IDが返ることを確認した。

## ローカル検証

- Ruby: `bundle exec rake test` は17 tests・68 assertions成功。`bundle exec rake lint` の構文検査も成功。
- TypeScript: `bun test test/ts` は25 tests・74 assertions成功。strict `bun run typecheck` も成功。
- 通し確認: `bun run test:integration`。9 tests、53 Bun assertions、Chrome内の追加操作検査。
- 配布: `bun run build`。Node用verifier、静的UI、13 production packagesとENSのlicense notices。
- UI: 1440pxと390pxの画面確認、mobileの横溢れなし。ロゴ・カバー・3画面を生成。

確認環境はRuby 4.0.6 / Node 24.14.1 / Bun 1.3.13。
追加でRuby 3.4.8 / Bundler 4.0.20の空の一時環境へfrozen installを行い、Ruby 17 testsと結合9 tests、構文検査を確認した。
配布物の再buildによる差分はなかった。

GitHubの [Test run](https://github.com/geeknees/devouch/actions/runs/36155612207) はcommit `66973289d637db0ae4e3eb549aa62cb88233e0ac` を対象に実行され、空のgemチェックサムによりテスト前のbundle installで失敗した。
同じfrozenエラーを手元で再現し、依存バージョンを変えずGemfile.lockのチェックサムを補完した。
上記のクリーンなインストールとテストは修正後に成功。
commit `5e1afca6aa3d72567e4c7ab70f9b8d851544aca2` の [push Test](https://github.com/geeknees/devouch/actions/runs/36159498575) と [PR Test](https://github.com/geeknees/devouch/actions/runs/36160022026) も成功した。
PR Testは依存の固定インストール、Ruby/Bun/結合テスト、型・構文検査、配布物の再build一致まで全stepのsuccessを確認した。

その後のロゴ更新commit `cf4c159a6da946466146313ef0e5d5897e6d6110` の
[Test run](https://github.com/geeknees/devouch/actions/runs/36167692283) は、最後の配布物一致検査で失敗した。
`assets/devouch-logo.svg` に対し `dist/web/devouch-logo.svg` が古かったため、既存のbuildで配布用SVGを再生成した。
機能実装やデザイン案は変更せず、採用済みの元データと配布物を一致させた。

## 公開準備

`.github/workflows/devouch.yml` はローカル検証済みcommit `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` を固定した。
`.github/workflows/pages.yml` はmainの手動実行で `dist/web/` だけを公開する。
3 workflowの構文・外部ActionのSHA固定・権限・公開対象を検査した。
予定の `/devouch/` 配下でChromeを使い、配布物・操作タブ・walletなしの表示・mobile表示・console errorなしを確認した。
ユーザー承認後、private repoへ `codex/demo-release-20260926` をpushし、[draft PR #1](https://github.com/geeknees/devouch/pull/1) をgeeknees名義で作成した。
本文一致、draft状態、base main、head `5e1afca6aa3d72567e4c7ab70f9b8d851544aca2` を読み戻して確認した。
その後、ユーザー承認に基づきPR #1をmerge、repoをpublicへ変更し、Pagesを公開した。
公開commit `3214991e616e118d921ea9575d06d5e121b584f4` のCIとPages配信が成功。
固定Actionの匿名取得、公開した5ファイルの一致、公開画面からの785 bytesの推薦原本取得を確認した。
URL・run・digestは [公開の検証記録](release-evidence.md)、再配信は [公開手順](release-runbook.md)を参照する。

準備PRの [Devouch run](https://github.com/geeknees/devouch/actions/runs/36160022078) は成功。
PR作者 `github:701242`、base `66973289d637db0ae4e3eb549aa62cb88233e0ac`、head上記SHAに対し、
`credential_missing`、`missing / not_evaluated`、CLI終了2・Action終了0を確認した。
これは同じprivate repo内の推薦ファイルなしのPRであり、masusanouのfork PR・有効推薦・失効後の再実行を確認した証拠ではない。

## エージェント名義の実fork PR

masusanouの [PR #2](https://github.com/geeknees/devouch/pull/2) は公開forkから送信され、
[Devouch run](https://github.com/geeknees/devouch/actions/runs/36172488074) で `valid / accepted` を確認した。
GitHub APIの実作者 `github:287365775`、base `3214991e616e118d921ea9575d06d5e121b584f4`、
head `7ac246f17c441833cb3ece244cdf1377fe35e003` とレポートの参照先が一致した。
原本の785 bytesとdigest、baseのpolicy digestも一致し、CLIとActionの終了コードはともに0。
[通常CI](https://github.com/geeknees/devouch/actions/runs/36172488028) も全step成功。
初回forkの実行承認は差分とworkflowの確認後、2 runだけに行い、保護設定は変更していない。
snapshotと確認範囲は [Sepolia検証記録](demo-evidence.md#masusanouの実fork-pr)に記録した。
この時点ではPRはopen。本人walletによる実失効は未実施で、PRでの失効検証はユーザー指定により行わない。

## 公開前の検査

privacy-checkのパターンで追跡中・未追跡の対象ファイルと既存履歴を検査した。
秘密鍵・API token・個人の実行パスの検出はなかった。
第三者ライセンスの公開連絡先と、公式GitHub docs URLの一部は誤検知として区別した。
発表台本の氏名は現在placeholderだが、追加・削除した既存コミットの差分には残っている。
Gitのauthor・committer情報にも氏名と個人メールアドレスがある。
現在のPNG 10点と履歴の旧版3点を目視し、提出フォーム画像5点にログインアイコンのイニシャルを確認した。
全13点にtext・Exifメタデータはなく、秘密鍵などを保存する典型的なファイル名も現在・履歴ともに見つからなかった。
過去の台本の氏名、Gitの作者・committerの個人メール、提出フォーム画像のイニシャルは、
2026-09-26にユーザーから公開してよい旨の確認を得た。既存履歴は維持する。
スキャンはパターン照合であり、秘密情報がないことの数学的保証ではない。

本人walletによる実失効とCLIでの確認が残る。
この記録を「ハッカソンの実機デモ全体が完成」とは扱わない。
