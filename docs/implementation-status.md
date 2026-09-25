# ハッカソン版の実装と検証

開始: 2026-09-25 13:32 UTC（22:32 JST）。作業先: このリポジトリ。

開始時点は docs の12文書と `.gitignore` のみ。12文書を通読し、
`hackathon-planning.md` の優先順位に従って新規実装する。
過去の Devouch のコードは取り込まない。事前の設計資料を使用した事実を残し、
Building from Scratch の適格性を運営が確認したとは扱わない。

## 完成条件と証拠

| 条件 | 検証方法 | 状態 |
|---|---|---|
| Ruby CLI の request / fetch / verify / revoke | Minitest、実 CLI の JSON と終了コード | ローカルEVMで確認、実名のrequestも確認 |
| EIP-712 署名、対象・期限・公開先・サイズの検査 | viem による正負のテスト | 実装・テスト済み |
| ENSv2 の実装固定、本文取得、履歴・snapshot 検証 | 公式 ABI、ローカル EVM と Sepolia の readback | ローカル通し確認、実名の配備・現在値まで確認 |
| 失効と再掲載拒否、リンク・実装変更の拒否 | 時系列を変えるテスト、実 EVM | ローカルEVMで確認 |
| 二つの repo 方針で再利用、片方だけ不採用 | 同じ署名を使う通しテスト | 実CLIで確認、実機用policy例を用意 |
| 静的 Web の署名・公開・失効・復旧・ダウンロード | ブラウザとウォレット、receipt/readback | Chrome＋ローカルEVMで確認。実walletは未実施 |
| 推薦者自身による resolver 準備とキー権限 | 公式 Factory と実コントラクトによるテスト | ローカルEVMで配備・接続・キー限定・grant撤回後の本人失効を確認 |
| 読み取り専用 Action、base/head 固定、PR 作者照合 | API/CLI 境界テスト、実 fork PR | 境界テスト済み、実GitHub runは未実施 |
| 管理者・エージェント両名義の実 fork PR と失効後再実行 | 対象 PR と Action run の URL | 公開情報・外部操作待ち |
| 運営者不在でローカル UI と別 RPC から操作 | ローカル配布物での通し確認 | ローカルUIと2社RPCの実名読み取りまで。実取引は未確認 |
| README、導入手順、ライセンス、提出・デモ資料 | コマンド再実行とリンク検査 | 作成・更新済み。提出画像草案5点。録画用ツールは別作業で追加済み、提出用の実機動画は未完成 |
| 公開コード・配布 SHA・静的 live URL | 公開先の readback | Action固定SHAと手動Pages workflowを準備。公開・配布・hostingは未実施 |

## 採用範囲

Ruby CLI、TypeScript/viem の検証補助、静的ウォレット UI、GitHub Action。
既存 ENSv2 Permissioned Resolver を使い、独自台帳・共通秘密鍵・運営者 API は置かない。
同時に一記録一推薦。World、委任、Git 全履歴、複数推薦の同時保持は含めない。
`human_verification: not_included` を常に明示する。

外部の公開・push・ホスティング・Sepolia 取引は、成果物と操作対象を準備した後に
許可された範囲で実行する。ローカル EVM の成功を Sepolia や実 fork PR の成功には数えない。

## 実機の公開情報

2026-09-26 JST: デモ先はユーザー訂正により `geeknees/devouch`（現状private、デモ時に公開）。
送信者は `masusanou`、GitHub数値ID `287365775`。
ENS名はユーザー指定の `masusanou-dev.eth`、取得先は https://app.ens.dev/。
World sandboxは https://sandbox.auth.world.org/。World認証は未統合。

名前owner: `0x894108DC5640e36c478523228addA22b58Eeb79c`（EOA）。
resolver: `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160`、recordId 1、
配備block 11780025、固定した公式PermissionedResolverImplと一致、推薦欄は空。

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
上記のクリーンなインストールとテストは修正後に成功。修正を含むremote CIの成功はまだ未確認。

## 公開準備

`.github/workflows/devouch.yml` はローカル検証済みcommit `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` を固定した。
`.github/workflows/pages.yml` はmainの手動実行で `dist/web/` だけを公開する。
3 workflowの構文・外部ActionのSHA固定・権限・公開対象を検査した。
予定の `/devouch/` 配下でChromeを使い、配布物・操作タブ・walletなしの表示・mobile表示・console errorなしを確認した。
公開先へのpush・Pages有効化・deployは未実施。[公開手順](release-runbook.md)を参照する。

## 公開前の検査

privacy-checkのパターンで追跡中・未追跡の対象ファイルと既存履歴を検査した。
秘密鍵・API token・個人の実行パスの検出はなかった。
第三者ライセンスの公開連絡先、説明用の数値ID、並行して追加された発表台本の自己紹介にヒットした。
後者は他作業の原稿として保全し、履歴の変更・削除はしていない。
スキャンはパターン照合であり、秘密情報がないことの数学的保証ではない。

固定Action commitの公開取得、実PR、静的公開先、walletによる署名・公開・失効が残る。
この記録を「ハッカソンの実機デモ全体が完成」とは扱わない。
