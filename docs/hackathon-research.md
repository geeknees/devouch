# Devouch：原典・公式仕様の確認結果

確認日：2026-09-25。一次資料、コード、公開の実行履歴を確認した結果であり、World の実認証、Sepolia への書き込み、Devouch のデプロイの動作確認は含まない。

企画の入口は [企画・準備状況](hackathon-planning.md)、開発着手時の採用候補は [ハンドオフプロンプト](hackathon-handoff.md)。

ENSv2 の役割と Devouch 側の設計を分けた説明、推薦ファイルの構造と保存場所は [データ構造と保存場所](hackathon-data-model.md)を参照する。

2026-09-22の訂正：Devouch 運営者のバックエンド・共有 DB・検証結果のサービス署名を必須にした提案は撤回した。ユーザーは分散性を優先し、World賞は両立できる場合の候補とした。以下の World OIDC の仕様確認は技術調査として残すが、必須構成への採用を意味しない。

## 身近な動機：yusukebe と Hono

ユーザーから、友人であり Hono の開発者でもある yusukebe が AI Slop に悩まされていたことが、Devouch を考える動機の一つだと共有された。

[「OSSにおけるAI Slop問題の何が問題なのか？」（2026-03-06）](https://zenn.dev/yusukebe/articles/3fd5bc6ea341c9)を確認した。本人は同一投稿者から30件の AI 生成と見られる PR が届いた経験を挙げ、文脈を確認するレビューの負荷や、投稿者を排除することの心理的負担を述べている。一方、自分も AI をレビューに利用していると記している。

ここからのプロダクト上の提案は、メンテナーの時間と、貢献者を受け入れられる関係を守ること。記事を AI 全般の否定や、すべてのセキュリティ報告が不要だという主張へ読み替えない。本人・Hono が Devouch の設計、導入、効果を承認した証拠としても扱わない。

## vouch が扱っている信頼

確認対象は [mitchellh/vouch](https://github.com/mitchellh/vouch/tree/d66fa29a64600490892131ad87597c30c91fcac4)。

- 推薦の対象は貢献者。参加できる範囲、推薦する人、拒否の扱いは各プロジェクトが決める。個別 PR の品質や、人間による全変更の確認を証明する仕組みではない。[README](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/README.md)
- 推薦された人が自動的に他者を推薦できるわけではない。マージ・push・release の権限も別である。新規参加者の自己紹介を入口にする運用例がある。[FAQ](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/FAQ.md)
- `vouched`、`denounced`、`unknown` を分け、`unvouch` はリストからの削除である。推薦の撤回と、悪質だという非難を同一視しない。[ライブラリ実装](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/vouch/lib.nu)
- Issue 経由の管理権限は設定可能。確認した Action の既定ロールは `admin,maintain,write,triage`。FAQ の簡略な権限説明だけから実装を推測しない。[管理 Action](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/action/manage-by-issue/README.md)
- 既に `--vouched-repo` で他リポジトリの推薦リストを参照できる。「vouch は共有できないからチェーンが必要」という説明は不正確。[GitHub 連携の実装](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/vouch/github.nu)
- ライセンスは MIT。コードを取り込む場合は元の著作権表示と許諾文を保持する。今回の調査でコードは取り込んでいない。[LICENSE](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/LICENSE)

**Devouch への提案**：貢献者への推薦、各リポジトリの採否、成果物の評価を分ける。追加価値は、発行者・対象・用途・期限が検証できる推薦と、その現在の有効性を持ち運べること。GitHub 上の一つのリストへの依存を減らす代わりに、鍵管理、RPC、ガス、公開記録の扱いという負担を引き受ける。

Devouch は vouch の設計・運用を参考にしている。現在の実装と企画案には、原典の CLI・Action を呼び出す処理や `VOUCHED.td` との連携はない。

## Ghostty の GitHub 離脱方針と vouch の稼働

**2026-09-22時点で、Ghostty は GitHub からの離脱方針を発表しているが、GitHub 上で vouch の運用を続けている。** 設定ファイルの存在に加え、次の実行履歴とリスト更新を確認した。時刻は日本時間。

| 日時 | 確認した事実 | 根拠 |
|---|---|---|
| 2026-04-28 | Mitchell Hashimoto が、GitHub への依存を段階的に解消し、現在の URL に読み取り専用ミラーを残す計画を公表 | [Ghostty Is Leaving GitHub](https://mitchellh.com/writing/ghostty-leaving-github) |
| 2026-09-22 17:04:15 | `Update VOUCHED list (#14341)` が取り込まれ、`.github/VOUCHED.td` が更新された | [commit `bd1c82b`](https://github.com/ghostty-org/ghostty/commit/bd1c82bc5306da32b16b5055ceff023d7ebc9edc) |
| 2026-09-22 17:04:16 | `Vouch - Check PR` が開始され、workflow と `mitchellh/vouch/action/check-pr@d66fa29a64600490892131ad87597c30c91fcac4` のステップがともに `success` で完了 | [実行記録](https://github.com/ghostty-org/ghostty/actions/runs/35702814705)、[ジョブ](https://github.com/ghostty-org/ghostty/actions/runs/35702814705/job/106664587606) |

この記事で本人が挙げる離脱理由は、頻発する障害によって開発・レビューが止まること。Git 自体が分散していても、Issue・PR・Actions などの周辺機能への依存は残ると説明している。記事は vouch の失敗や廃止を述べていない。[本人の説明](https://mitchellh.com/writing/ghostty-leaving-github)

上記の稼働記録から、この確認時点では GitHub への依存の解消は完了していないと判断できる。移行先や移行全体の進捗・完了予定は、本調査では確認していない。将来、公開 repo がミラーとして残る場合もあるため、利用状況の再確認では設定だけでなく実行日時と結果を見る。

### Devouch への示唆

現在の案で持ち運べるものと、GitHub に依存するものを分ける。以下は設計上の評価であり、他サービスでの動作実績ではない。

| 対象 | 現在の案と残る条件 |
|---|---|
| 推薦本文・署名・失効状態 | `.devouch/` の JSON は別の Git ホストへ移せる。ENS からも本文と失効状態を取得する案だが、chain・ENS・RPC への依存は残る |
| 検証の実行場所 | Ruby CLI を中心にし、GitHub Actions から同じ検証を呼ぶ。別の CI での利用には、投稿者や repo 方針を取得する連携が必要 |
| 推薦対象の識別 | `subject: github:<数値 ID>` は GitHub アカウントへの推薦。移行先のアカウントと同じ貢献者だと証明する方法は未設計で、同じ推薦がそのまま通用するとは言えない |

GitHub Actions から手軽に導入する方針と Ruby CLI 中心の構成を維持しつつ、データの移動と、移行先で推薦を利用できることを区別する。8時間版への他サービス対応や新しい本人識別方式の追加を決定したものではない。現在の再利用デモは、同じ GitHub アカウントの推薦を複数 repo の方針で評価する範囲である。

この記事だけでブロックチェーンが必要とは結論できない。複数の場所で推薦の発行者・失効状態を確認できる便益が、鍵管理・ガス・RPC の負担に見合うかで評価する。詳細な保存先と依存は [データ構造と保存場所](hackathon-data-model.md#8-停止紛失時と残る依存)を参照する。

## Tea から確認できたこと

[Andrew Nesbitt の記事](https://nesbitt.io/2026/06/11/what-happened-to-tea.html)は、報酬設計、パッケージ大量登録、その処理負担を結びつけて論じている。価格下落・資金調達・組織活動の分析は今回の設計根拠に使わず、以下の一次資料と照合した。

| 資料 | 確認できた範囲 |
|---|---|
| [RubyGems の調査報告（2024-04-14）](https://blog.rubygems.org/2024/04/14/the-implications-of-crypto-rewards-on-rubygems_org.html) | 内容の乏しい gem が増え、既存パッケージへの参照と tea のランキング操作との関係を調査した。運営に調査・対処の負担が発生した |
| [Tea 自身の説明](https://tea.xyz/blog/owning-the-fallout-fixing-the-incentives-how-tea-is-responding-to-the-npm-token-farming-campaign) | 件数・登録中心の初期インセンティブが悪用可能だったと認め、該当ポイントから報酬への経路停止と設計変更を説明している |
| [現行 white paper](https://docs.tea.xyz/tea-white-paper/white-paper) | 貢献・依存関係の評価と報酬を結びつける構想を確認。現在の記述を過去の実装そのものの証拠にはしない |

スパムを作る誘因があったことと、攻撃者全員が実際に報酬を受け取ったことは別である。Tea の改善策が有効になったかも本調査では実証していない。

**Devouch への提案**：PR 数、推薦数、登録数へのトークン報酬・順位付けを MVP に入れない。評価するのは「誰を何の用途で推薦しているかをメンテナーが理解できる」「一度の推薦を別の受け入れ方針でも評価できる」「撤回が次の判断に反映される」の三点とする。World の認証を通った人も不要な投稿はできるため、人間性の確認だけをスパム対策として売らない。

| 関係者 | 設計上の利益と負担の仮説 |
|---|---|
| メンテナー | 判断材料を得られる一方、未知の推薦者やウォレットを評価する負担が増える。受け入れる発行者を限定し、理由を表示する |
| 新規貢献者 | 信頼履歴を再利用できる一方、推薦者や対応する World ID を持たない人がいる。通常の参加経路を残す |
| 推薦者 | 推薦する範囲と期限を選べる。推薦はコード品質の保証ではなく、撤回も理由のない非難へ変換しない |
| サービス・レジストリ運営者 | 認証要求、公開記録、問い合わせの負荷を負う。自動大量発行を成功指標にしない |

## World ID for Agents

[公開概要](https://auth.worldcoin.dev/docs)、[OIDC discovery](https://auth.worldcoin.dev/.well-known/openid-configuration)、[公式 MCP](https://auth.worldcoin.dev/mcp) の公開ガイドを取得した。MCP は `list_idp_guides` → `get_idp_guide` で `getting-started`、`oidc`、`step-up` を読む。`worldid://guides/oidc` 等は MCP の resource URI であり、ブラウザ用 URL ではない。

確認した契約：

- issuer は `https://auth.worldcoin.dev`。OIDC は confidential client を前提とする。配布 CLI やブラウザに共有 client secret を置かない。
- authorization code と device code のフローを提供する。scope は `openid` のみ。OIDC refresh token、UserInfo、XAA、暗黙のクロスアプリ委任は提供されない。
- device grant は CLI と相性がよく、新しい World proof とユーザーの明示的な承認を必要とする。要求はバックエンドで開始・保持し、CLI には `user_code` と公式の `verification_uri_complete` を返す。`device_code` や token は返さない。
- バックエンドで署名・issuer・audience・期限・必要な認証条件を検証する。device grant の ID token に nonce はない。browser code flow の場合は state・nonce・S256 PKCE が必要であり、二つのフローの条件を混ぜない。
- device poll は返された interval に従い、`slow_down` では以降の間隔を延ばす。拒否・期限切れ・その他のエラーでは保護操作へ進まない。利用可能な認証フローがあることと、このアプリで通し確認できたことは別。
- `(iss, sub)` はサービス側で扱う識別子。GitHub アカウント、ウォレット、ENS の所有者とは自動的に一致しない。公開の推薦関係の ID として流用しない。
- 新しい token の `iat` は新しい本人確認の証拠ではない。必要な鮮度は `auth_time` で判断する。World credential の possession と、生体認証による「その場に本人がいる」保証を混同しない。
- ローカルの操作内容、承認者の権限、対象の署名、認証結果を同じ要求に結びつけるのは Devouch の役割。認証成功だけで推薦内容に同意したと扱わない。

当日に残る確認は、イベント環境での client 登録可否、対応 World App / credential、実際の成功・拒否経路である。ガイドには portal の参加資格制限や World ID 3.0 Orb 互換性への言及があり、一般ドキュメントだけで参加者の利用可否は確定しない。

## World と分散性の追加確認

中央サービス案では、推薦者の登録、World の結果の解釈、受領証への署名、公開 tx、本文の保管を私たちが管理していた。発行済みの証拠を持ち運べても、新規発行と再取得はそのサービスに依存する。今回の要求では、発行・取得・検証・失効まで Devouch 運営者を必須にしないことが必要である。

追加で公式の [IDKit integration](https://docs.world.org/world-id/idkit/integrate)、[RP signatures](https://docs.world.org/world-id/idkit/signatures)、[On-chain Verification](https://docs.world.org/world-id/idkit/onchain-verification)を読んだ。

- IDKit の現行ガイドは、アプリの署名鍵で proof 要求へ署名する経路を案内している。オンチェーンで proof を検証できても、要求のたびに私たちの鍵を必須にする構成なら発行の入口に依存が残る。
- 公式には Solidity で proof を直接検証する経路がある。World ID 3.0 の Router は Ethereum Sepolia も記載されている。World ID 4.0 の掲載先は World Chain 等であり、この資料だけでは ENSv2 と同じ Ethereum Sepolia の v4 接続を確認できない。
- proof の検証に加え、対象の署名者・操作との結び付け、適切な nullifier の扱い、要求署名、対応アプリ・credential が必要。旧版の例と現行 SDK を混ぜて、バックエンド不要が実証されたとは扱わない。

World 全体が分散した構成に使えないと結論したわけではない。今回の8時間版へ入れられる具体的な経路は未実証であり、ユーザーの選択に従って World賞は条件付きとする。Agents と IDKit の賞要件も別である。共通 secret の配布や、私たちの自己申告の受領証でこの未確定部分を埋めない。

## ENSv2

[Overview](https://docs.ens.domains/ensv2/overview/) は Sepolia beta と未確定のインターフェースを明示している。名前を表示するだけでなく、推薦の公開状態・更新権限を検証に使う用途を検討する。

**確認した版を混ぜない。** 取得した `main` のコードと公式 [Deployments](https://docs.ens.domains/learn/deployments/) のリンク先には差があった。デプロイ一覧が指す Permissioned Resolver は、確認時点で [commit `71a3b73` のコード](https://github.com/ensdomains/contracts-v2/blob/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/src/resolver/PermissionedResolver.sol)。この版と [Resolver の文書](https://docs.ens.domains/ensv2/permissioned-resolver/)で次を照合した。

- `setText(bytes name, string key, string value)` は DNS encoded name を受ける。旧版の `setText(bytes32 node, …)` を混ぜない。
- `grantSetterRoles` による text の権限はキー単位であり、同じ resolver が扱うすべての名前に届く。名前ごとに分離したい場合は resolver instance を分ける。
- `grantRoles` をそのまま呼ぶ方式はこの resolver では無効。レジストリの EAC と resolver の EAC を同じ呼び方・同じ権限範囲と考えない。
- read は Universal Resolver / `resolve` を通す。古い resolver の直接 getter を前提にしない。
- text の更新は `TextUpdated` に record ID・キー・更新後の値を記録する。失効後に古い値を戻した履歴の検出に利用できる。[イベント定義](https://github.com/ensdomains/contracts-v2/blob/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/src/resolver/interfaces/setters/ITextSetter.sol)
- setter の権限を外しても、既存の記録は消えない。公開済み推薦の失効と、今後の書き込み権限の撤回は別の操作にする。
- 公式の構成では、各 account が Verifiable Factory から既存の実装を参照する resolver proxy を作り、初期権限を設定して名前へ紐付ける。独自の Solidity 実装を作ることと、自分用 instance をデプロイすることは区別する。[デプロイ手順](https://docs.ens.domains/ensv2/permissioned-resolver/#deploying-a-permissioned-resolver)

ここまでの確認は静的照合であり、chain 上の proxy・実装・ABI の一致は未検証。着手時には公式 deployment のアドレス・ABI・実装版を一組として固定し、許可された書き込み、別キーへの書き込み拒否、readback を確認する。名前の移転・resolver 差し替えを過去の推薦者と同一視しない。

修正案では各推薦者が自分の名・専用 resolver を管理し、小さい署名付き推薦 JSON を text record へ直接保存する。ハッシュだけを置いて本文を私たちの DB から取る前案を変更し、本文の取得先も chain にする。これはプロダクト上の提案であり、本文サイズ・ガス・ライブ操作は未確認。公開履歴とコストのトレードオフは [保存方式の比較](hackathon-data-model.md#7-保存方式のトレードオフ)に記す。

この範囲なら独自の推薦台帳コントラクトを新規実装せずに構成できる、という設計上の評価である。推薦の署名・期限・失効の意味は CLI が検証する。責任分担と、chain 上での追加ルールが必要になる条件は [データ構造の説明](hackathon-data-model.md#既存コントラクトの利用とデプロイ)を参照する。

## GitHub Actions からの導入と JSON 保存

2026-09-22、導入マニュアル作成に合わせて GitHub 公式資料と既存の Action を確認した。

- `pull_request` は fork PR の secret に制約があり、実行承認が必要になる場合がある。競合がある PR では動かない。新案は手動 secret を必須にせず、公開 RPC を使う読み取り処理にする。[イベント仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)
- `permissions` を列挙すると、未指定の権限は `none` になる。新案は `contents: read` と `pull-requests: read` に限定する。[workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
- `pull_request` の workflow は PR の merge 側から実行されるため、PR による workflow 変更も考慮する必要がある。新案の report 表示を、そのまま強制的なマージ制御には使わない。[イベントの信頼境界](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- Action は full-length commit SHA に固定する。新しい Action の配布先・SHA は未定であり、マニュアルのプレースホルダーを公開済み release として扱わない。[固定方法](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)
- workflow の再実行は元の SHA / ref を使用する。再実行で chain の現在状態を読むのは Devouch 側の実装要件であり、policy の新しい版を自動で読むという意味ではない。[再実行仕様](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

既存の [action.yml](../action.yml) は委任・Git 来歴版の `verify` を実行し、入力は `policy-path`。既存 CLI が生成する workflow は RPC の repository secret を参照する。今回提案する `mode: report`、PR 作者の数値 ID と推薦 JSON の照合、checkout なしの取得、手動 secret 不要の動作は実装済みではない。

ユーザーはリモートの構造化データを GitHub repo の `.devouch/` に置く案を提示した。保存形式は Git で差分を確認できる通常の JSON とし、推薦の配布と repo ごとの受け入れ方針に使う。

[導入マニュアル](adoption-guide.md)には、この保存方式、必要な操作、実装との差分を記載した。新しい Action の実行、RPC の履歴取得、第三者による導入の容易さは未検証である。

## 募集要項と提出

[Tokyo 2026 募集要項](https://ethglobal.com/events/tokyo2026/prizes)を直接取得し、保存メモの World / ENS 要件を確認した。World は検証後の有意味な操作と失敗経路、統合フィードバックが必要。ENS は ENSv2 Sepolia の中心的利用、動作するライブデモ、公開コードが必要である。通常の ENS 賞は総額 $6,000（$3,000 / $2,000 / $1,000）、World Agents は $7,500。既存プロジェクト向け ENS 賞は Continuity 限定。

[Tokyo 固有の提出ガイド](https://ethglobal.com/events/tokyo2026/info/details)も確認した。

- 提出締切：2026-09-27 09:00 JST。
- 応募は最大3パートナー。同一パートナー内の複数トラックは1パートナーと数える。これだけでは同一パートナー内の重複受賞を保証しない。
- デモ動画は任意・推奨の2〜4分。Finalist の発表枠はデモ4分＋質疑3分。
- AI 利用の説明を含める。spec-driven の開発では使った仕様・プロンプト・計画資料も提出リポジトリに含める。

[一般規約](https://ethglobal.com/rules)と Tokyo ガイドは From Scratch の事前の project-specific code / designs / assets を制限している。ユーザーの方針は、今回の資料を採用任意の企画案・ハンドオフ候補として作り、開発開始時に採用を判断すること。運営確認を得たとは記録しない。資料の作成時期と実際に使った範囲を残し、新規実装と既存の調査・コードを提出時に区別する。

## 既存 Devouch との境界

今回読んだ現在の実装には、Sepolia の推薦・失効を扱う [契約](../contracts/DevouchTrustRegistry.sol)、[台帳照会](../lib/devouch/ledger.rb)、[リポジトリ方針](../lib/devouch/policy.rb)、[人間からエージェントへの委任](../lib/devouch/delegation.rb)、[コミット検証](../lib/devouch/verifier.rb)がある。World / ENSv2 への接続はこれらの確認範囲に含まれない。

新しいハッカソン版の最小機能と、既存版が持つ機能を明示的に分ける。特に署名付きの推薦が検証できることだけをもって、エージェントへの委任や Git 履歴まで検証したと表示しない。既存実装の動作テスト・デプロイ確認は今回実施していない。
