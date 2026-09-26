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

## 推薦とrepo方針の信頼マップ（2026-09-26）

ENS名検証とPR URL検証に、署名者・ENS公開先・署名されたGitHub subject・repo方針を結ぶ図を追加した。
既存の検証結果と方針判定をそのまま表示し、nodeの選択で署名者のアドレス、公開先のsnapshot、
期限、採否の理由を開く。Primary ENS NameとrecordNameは別nodeで表示する。
ENSモードの方針nodeは既存のTrusted issuers欄へ移動でき、同じ証拠のまま図の採否も更新する。
PRモードはbase SHA・policy digest・固定commitの方針リンクを表示する。

- 共有URL: https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify
- 実repoの共有URL: https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify
- 図は現在検証した一つの推薦を対象にする。未探索の推薦・逆引き名からの全推薦探索・推移的な信頼は表さない。
- 署名validでも証拠revoked/expiredなら、その状態とpolicy not_evaluatedを分ける。作者不一致でchain未検証なら公開先はNot checkedとする。
- 署名不正・推薦なし・入力変更・取得失敗では、以前の図を隠す。逆引き未設定・失敗はアドレス表示へ戻る。
- nodeはnative buttonで、Enter/Space・タッチで選択できる。詳細は最初は閉じ、選択時に開く。reduced motionでは登場animationを止める。
- SVGとDOMだけで実装。図の操作と例示方針編集は追加RPC/API 0回。依存・CDN・wallet権限・検証中核の変更なし。

### 自動検証

- 既存のENS/PR結合テストを拡張し、未実装の図に対して失敗することを先に確認した。
- node選択・keyboard・Primary Nameとの相違・方針編集・invalid_policy・作者不一致・失効・期限切れ・取得失敗・古い図の消去を実ローカルENSで検査した。
- Ruby 52 tests / 179 assertions、TypeScript 91 tests / 200 assertions、結合24 tests / 219 Bun assertionsが成功（合計167 tests）。Playwright assertionsも成功。
- strict型検査、Ruby構文検査、buildが成功。既存133個のHTML idを維持し、追加後の135個に重複なし。
- staged配布物の再build後、`git diff --exit-code -- dist/` が成功。privacy-checkの追加差分は0件、全体・履歴は既知の著作権表記・公開承認済み氏名・公式URLと拒否テストの誤検知18件のみ。
- `.devouch/policy.json` と `.devouch/local/demo/` の5つのJSONは作業前のSHA-256を維持。PR #2・公開推薦・Action固定先は変更していない。

### ローカル配布物から実Sepoliaを確認

- 確認日時: 2026-09-26 11:22 JST。Chromeの390px・タッチ端末エミュレーション。
- ENS名のchecked_at: `2026-09-26T02:22:36.374Z`、block `11783253`、hash `0x3c11950ad82bf5bdba3e0735f8adf27fd4b0189df3f84656ed4cd1d0be233003`。
- PR #2のchecked_at: `2026-09-26T02:22:46.367Z`、block `11783254`、hash `0x7050a259bc2951d739216665087c8364fb0ef20354a1e78d45777aa28a73d91f`。
- ENSはvalid・A accepted / B rejected → accepted、PRはvalid / accepted。両方で `Vouched by masusanou-dev.eth` と図の名前表示を確認。
- dark/light × 6幅 × 2モードの24レイアウトで、ページ・各nodeの横溢れなし。Enter/Space、タッチ、reduced motionを確認し、画像も目視確認した。
- 図の選択と方針編集による追加通信0回。二つの新規検証はGitHub GET 3回と読み取りRPC 79回で、wallet・署名・取引・JavaScriptエラーなし。
- この信頼マップの実スマートフォンでの確認は未実施。提出文・スライドQR・提出画像は引き続きClaude側の担当。

## PRのURLからの検証（2026-09-26）

Verify内に **ENS name / Pull request URL** の切り替えを追加した。
共有URL: https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify

公開PRの作者IDをGitHubから取得し、base SHAの `.devouch/policy.json` と、head SHAの
`.devouch/vouches/github-<author-id>.json` を読み取る。PR側の方針は採用しない。
`parseCredential`、`ChainReader.inspect`、Rubyとの共通fixtureを持つ `evaluatePolicy` をそのまま再利用し、
署名されたsubjectとPR作者の一致、ENS履歴・snapshot、repoの採否を確認する。
実際の方針、policy digest、base/head SHA、ENS名と公開名、署名、期限、ブロックを表示する。

GitHub通信は認証なしのGETだけ。公開repo専用で、token入力、PRコードの実行、GitHubへの書き込みはない。
PR未取得・方針未設定・不正方針・通信やrate limitの失敗では採否を出さない。
推薦がない場合は `missing / not_evaluated`、作者不一致は `invalid / not_evaluated` とし、理由コードを表示する。
過去のAction結果の更新やmerge承認ではなく、表示したコミットと現在のENS状態の新しい読み取りであることを明記する。
GitHubの[PR API](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request)と
[Contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content)の公開リソースを使う。
匿名APIの[レート制限](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)はIP単位の60回/時。
通常のPR検証は3回のGETで、CORSプリフライトの許可も実APIで確認した。

### ローカル配布物から実GitHub・Sepoliaを確認

- 確認日時: 2026-09-26 10:57 JST（画面のchecked_at: `2026-09-26T01:57:45.604Z`）。
- PR: https://github.com/geeknees/devouch/pull/2 。作者 `@masusanou` / `github:287365775`。
- base SHA: `3214991e616e118d921ea9575d06d5e121b584f4`、head SHA: `7ac246f17c441833cb3ece244cdf1377fe35e003`。
- policy digest: `sha256:ce77f04b8a1679ab784528a7feec24e0d3779c0d3b045b25950cea939ee9f653`。
- Sepolia block `11783136`、hash `0x23ff43e678b65ac4cb4be0e7bb14e2510fa7b9404838b23ad5207188d26cf2bf`。
- Chromeの390px・タッチ端末エミュレーションでURLから自動検証し、signature/evidence valid、subject一致、policy accepted、`Vouched by masusanou-dev.eth` を確認。
- PR検証はGitHub GET 3回・RPC 32回。署名・取引なし、walletなし、JavaScriptエラー0件。
- dark/light × 320 / 390 / 600 / 768 / 1024 / 1440pxの12レイアウトに横溢れなし。
- そのままENS nameへ切り替え、実推薦valid・A accepted / B rejected、Bへの追加でacceptedを確認。
- `.devouch/policy.json` と `.devouch/local/demo/` の5つのJSONは作業前のSHA-256を維持。PR #2への変更・Action再実行は行っていない。

### 自動検証

- Ruby 52 tests / 179 assertions、TypeScript 91 tests / 200 assertions、結合24 tests / 216 Bun assertionsが成功（合計167 tests）。結合テスト内のPlaywright assertionsも成功。
- 追加テストは固定SHAと作者照合、別repo方針の拒否、署名不正、失効・期限切れ、推薦なし、GitHubの失敗・サイズ・UTF-8、共有URLの不要情報除去を確認。
- ブラウザでは実ローカルENSの署名・履歴を使用し、GitHub応答と任意のENS逆引きだけをstubにする。方針による拒否、作者不一致、失効、rate limit、途中のモード切り替え、古い結果の消去を確認。
- unitの未実装moduleエラーと、結合の未実装UIエラーを先に確認。Chromeだけで起きるnative fetchのreceiverエラーも結合テストで検出・修正した。
- strict型検査、Ruby構文検査、buildが成功。新しい依存、CDN、wallet権限は追加していない。
- 再build後の `git diff --exit-code -- dist/` が成功。既存91個のidを維持し、追加後の133個にも重複がない。
- stagedのprivacy-checkはuserinfo付きURLの拒否テスト2行をメール形式と誤検知。実際の個人メールや秘密情報ではないと確認した。公開前の全体・履歴検査も、この2行と既知14件だけだった。

### 公開Pagesでの確認

[PR #11](https://github.com/geeknees/devouch/pull/11) のhead `34d630af826847b97c5faa576279f9d903b5da8f` は
[push CI](https://github.com/geeknees/devouch/actions/runs/36210332127)・[PR CI](https://github.com/geeknees/devouch/actions/runs/36210342674)とも成功。
取り込み後の `011c084de8d4d09a5a4f663451a49c835866c326` も [main CI](https://github.com/geeknees/devouch/actions/runs/36210444507) が成功し、
同commitを [Pages run](https://github.com/geeknees/devouch/actions/runs/36210518263) で公開した。

- 共有URL: https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify
- 確認日時: 2026-09-26 11:05 JST（画面のchecked_at: `2026-09-26T02:04:57.163Z`）。
- Sepolia block `11783169`、hash `0x1bd7481f39762665710caf8ecaecad48108b09d204e3c487a835b6be9d56771d`。
- Chromeの390px・タッチ端末エミュレーションでURLを開き、作者 `@masusanou`、subject一致、signature/evidence valid、policy accepted、`Vouched by masusanou-dev.eth` を確認。
- base/head SHA・policy digestは上記ローカル確認と一致。GitHub GETは3回、PR検証のRPCは32回で、読み取り6種類のみ。
- 両テーマ・6幅の12レイアウト、ENS名検証へ戻ってA accepted / B rejected → 追加でaccepted、walletなし、JavaScriptエラー0件を確認。
- 公開11ファイルのHTTP 200と、ローカル配布物とのbytes一致を確認。`app.js` SHA-256は `bab1b371ce1d2cc4577fa4caa41f91e04a2894ad893240275e7ccdcf185293e7`。

このPR URL機能の確認はChromeの端末エミュレーションであり、実スマートフォンでの確認は未実施。
提出文・スライドQR・提出画像の更新は引き続きClaude側の担当。

## ウォレット不要の検証ページと方針比較（2026-09-26）

共有URL: https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify

新しいVerifyタブは、名前と任意のpublication.jsonから既存の署名・ENS履歴・snapshot検証を実行する。
`ChainReader.verifyName` は従来のfetch内の検証結果を返し、既存fetchの返却形式・検証条件は維持する。
evidenceとpolicyを分け、同じ証拠に対してサンプルrepo Aはaccepted、Bはrejectedとなる。
BのTrusted issuersへ推薦者を追加すると、RPCを再実行せず同じsnapshotでacceptedへ変わる。
サンプル方針はブラウザ内だけで編集し、実repoの方針の取得・更新やPR作者の確認は行わない。
画面に `human verification: not included` を表示する。

推薦者名はviemの `getEnsName({ address, blockNumber })` で逆引きする。
Universal Resolverの正引き一致確認を使い、推薦の公開先recordNameと異なるPrimary Nameは区別して表示する。
未設定・逆引きの取得失敗はアドレス表示へ戻し、証拠や採否を変えない。
保存位置を含めた共有リンクも作成できる。URLから任意のRPCや外部JSONを読み込む機能は持たない。

### ローカル配布物から実Sepoliaを確認

- 確認日時: 2026-09-26 10:08 JST（画面のchecked_at: `2026-09-26T01:08:08.991Z`）。
- URL: `http://127.0.0.1:49782/?name=masusanou-dev.eth#verify`。
- snapshot: Sepolia block `11782895`、hash `0xf801d0ee9fb454c69855745d987cd955316e7e057023e0edd278fd44b664ee09`。
- Chromeの390×844px・タッチ端末エミュレーションで、URLを開くだけでsignature/evidenceともvalid、`Vouched by masusanou-dev.eth` を確認。
- 同じ証拠でA accepted、B rejected (`issuer_not_trusted`)。Bへ推薦者を追加してacceptedへ変化した。
- ウォレットなし、JavaScriptエラー0件、画面の横溢れなし。通信先はローカル配信元とTenderly RPCのみ。
- RPCはchain ID・block・code・call・logs・receiptの読み取りだけ。実Sepoliaへの署名・取引・失効操作は行っていない。
- PR #2は読み取りで既存のDevouch endorsement reportと通常CIの成功を確認。Actionの再実行・mergeはしていない。
- `.devouch/policy.json` と `.devouch/local/demo/` の5つのJSONは、作業開始時のSHA-256と一致する。

### 自動検証

- `test/fixtures/policy-cases.json` の33組を、Ruby CLIとTypeScriptの両方で実行。採否、理由の順序、証拠が非validのときのnot_evaluated、不正方針の拒否が一致。
- 共通fixtureでRuby JSONの重複キー検出漏れを発見し、既存の拒否仕様を `allow_duplicate_key: false` で明示した。方針のschema・受け入れ基準は変更しない。
- ENS名の取得成功・未設定・取得失敗を単体テスト。実ブラウザでは、Primary Nameと公開先が異なるケースも表示を確認。
- Ruby 52 tests / 179 assertions、TypeScript単体63 tests / 114 assertionsが成功。既存のPublish / Retrieve / Withdraw / ENS setupとテーマのテストを維持。
- ブラウザ結合テストは実ローカルENSコントラクトで推薦を公開し、名前表示だけをstubにして方針編集・失効・期限切れ・署名不正・推薦なし・RPC失敗を確認する。
- 結合23 tests / 195 Bun assertionsに加え、テスト内のPlaywright assertionsも成功。strict型検査・Ruby構文検査が成功。
- `bun run build` 後の `git diff --exit-code -- dist/` が成功し、staged配布物との再build一致を確認した。
- privacy-checkは今回のstaged差分0件。全ファイル・履歴の14件は既存の第三者著作権表示、公開承認済みの過去の氏名、GitHub公式URLへの誤検知であり、新しい混入はない。
- 初回のpush CIは既存wallet UIテストでタイムアウトし、同じcommitのPR CIは成功した。browser/themeの2ファイルのみでも後のブラウザが停止する現象を再現。[Bunのpipe寿命に関する既知報告](https://github.com/microsoft/playwright/issues/42692)と症状が一致するため、結合テストの実行をファイル単位のBunプロセス・EVMに分けた。依存バージョンやworkflowは変更せず、全23ケースと各assertionを維持する。
- 分離後の全8ファイル・23 tests / 195 Bun assertionsが成功。配布物の再build一致も成功した。

### 公開Pagesでの確認

[PR #8](https://github.com/geeknees/devouch/pull/8) の最終head `0c1ef8bc998bae5ed2ca6c86b60e27fec0e939ff` は
[push CI](https://github.com/geeknees/devouch/actions/runs/36208046809)・[PR CI](https://github.com/geeknees/devouch/actions/runs/36208049662)とも成功。
取り込み後の `3b3f82bbe47850b0513c97fa77ccb6fa438edd2e` も [main CI](https://github.com/geeknees/devouch/actions/runs/36208177699) が成功した。
同commitを [Pages run](https://github.com/geeknees/devouch/actions/runs/36208263191) で再公開した。

- 共有URL: https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify
- 確認日時: 2026-09-26 10:24 JST。画面のchecked_atは `2026-09-26T01:24:36.917Z`。
- snapshot: Sepolia block `11782978`、hash `0xce9ede1d772061b2943724e67d9008c10eebf51a12c78d6b9cc74ab0fa78671b`。
- 公開URLを新しいChromeの390×844px・タッチ端末エミュレーションで開き、walletなしでsignature/evidenceともvalid、`Vouched by masusanou-dev.eth` を確認した。
- 同じsnapshotでA accepted、B rejected (`issuer_not_trusted`)。BのTrusted issuersへ `0x894108DC5640e36c478523228addA22b58Eeb79c` を入力してacceptedになり、この編集に伴うRPCは0回。
- `human verification: not included` を表示。検証中のRPCは読み取り6種類・46回で、通信先はPagesとTenderly RPCのみ。JavaScriptエラー0件。
- dark/light × 320 / 390 / 600 / 768 / 1024 / 1440pxの12レイアウトに横溢れなし。公開した全5タブの表示切替を確認した。
- 公開11ファイル（HTML・CSS・app/theme JS・ロゴ・ライセンス・5フォント）はHTTP 200で、ローカル配布物のSHA-256とすべて一致。
- 配信 `app.js` SHA-256: `fc6f711924c4d0bf2dfdbb62252004a2088c3cee0ce80e6e77becdb30fa8e277`。

実スマートフォンでの確認を依頼し、2026-09-26 JSTにユーザーから「大丈夫そうです」と回答を得た。
機種・ブラウザの種類と操作ごとの詳細は未記録。上記の日時・ブロック・詳細結果は、こちらのChromeでの検証証拠として区別する。
スライドのQR、提出文、提出画像の撮り直しはClaude側の担当。
Future欄への引き継ぎ案: "Support multiple active endorsements through per-contributor subnames, such as
`github-287365775.issuer.eth`, with independent publication and withdrawal histories. This requires extending
the verifier beyond direct `name.eth` names and checking subname ownership and permissions; it is not part of this release."
PR URLからの検証と、現在検証した推薦の信頼マップは、その後のユーザー選択に従って追加した（上記記録）。

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
