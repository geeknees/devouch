<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouchのロゴ：縦線が二股に分かれた小文字のd" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

Devouchは、推薦者自身がENSv2上で公開・失効できる、貢献者への推薦を扱う仕組みです。
一つの署名済み推薦を複数のリポジトリで検証でき、誰を信頼するかは各メンテナーが決めます。

着想元は [Mitchell Hashimotoのvouch](https://github.com/mitchellh/vouch) です。
メンテナーがレビューに時間を使う前に、信頼する人がその貢献者を推薦しているかを確かめます。
vouchはすでにリポジトリ間での貢献者リストの共有に対応しています。Devouchでは、推薦者の署名、期限、ENSv2上の失効履歴を持つ推薦を扱い、
各リポジトリが独立した採用方針を保てる仕組みを探っています。
vouchを組み込んだものではなく、別の実装です。[比較と出典](docs/hackathon-research.md#vouch-が扱っている信頼)を参照してください。

Ruby CLI、[静的Webワークスペース](https://geeknees.github.io/devouch/)、読み取り専用のGitHub Actionを提供します。
推薦者は自分のENS名の下で推薦とエージェントの識別情報を管理し、リポジトリは独自の方針で採否を決めます。
Sepoliaの公式Permissioned ResolverとUserRegistryを使い、Devouch専用のAPI、データベース、共有の公開用鍵、独自の推薦コントラクトは置きません。

## 試してみる

**[ウォレット不要の検証ページ](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify)** を開くと、
ENSv2サブネーム上の推薦の署名とENS階層を、新しいSepoliaのブロックで検証できます。
推薦者のENS名、対象アカウント、用途、期限、証拠の状態を表示します。
同じ推薦でも、サンプルrepo Aは **accepted**、Bは **rejected**（`issuer_not_trusted`）になります。
Bの **Trusted issuers** に推薦者を追加するとacceptedに変わります。この操作は実際のrepo方針を変更しません。

| ワークスペースの画面 | できること |
|---|---|
| [PRの検証](https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify) | 公開PRの推薦をbase側の方針と照合し、信頼マップで関係を確認する。 |
| [My endorsements](https://geeknees.github.io/devouch/#manage) | 最大8件のENS名をブラウザに保存し、推薦・期限までの残り日数・エージェントの権限を確認する。検証結果は再読み込み時にリセットされる。 |
| [Namespaces](https://geeknees.github.io/devouch/#namespaces) | ウォレットを使い、サブネーム作成やエージェントのプロフィール権限を管理する。 |
| Connection settings | RPCを診断し、接続先を明示的に切り替える。 |

公開・失効にはウォレットを使います。検証には不要です。ダークモードとライトモードを切り替えられます。
詳しい操作、ローカル起動、RPC設定は[利用ガイド](docs/usage.md)にまとめています。

## CLI

Ruby 3.4以上とNode.js 24を使います。配布物を同梱しているため、CLIの実行にJavaScript依存パッケージのインストールは不要です。
このリポジトリ内で、デモの推薦を新しいファイルに取得し、repoの方針で検証できます。

```sh
./exe/devouch fetch --name masusanou-dev.eth --output vouch.json \
  --publication-output publication.json --json

./exe/devouch check --repo geeknees/devouch --credential vouch.json \
  --subject github:287365775 --json
```

自分のPRでは、投稿先repoと、実際に投稿するアカウントのGitHub数値IDを指定してください。
`check`は推薦とrepo方針を検証するコマンドで、PRを送信しません。終了コード **0** の場合だけ、別途許可された投稿へ進みます。
同じ検証器を、下記の **GitHub Action** や、CLIを使えるエージェント向けの **[devouch-check SKILL](skills/devouch-check/SKILL.md)** から利用できます。
全コマンド、原本の扱い、終了コード、接続設定は[CLI利用ガイド](docs/usage.md#cli)を参照してください。

## リポジトリへ導入する

メンテナーが承認した `.devouch/policy.json` と、公開済みDevouchコミットのSHAに固定したworkflowを追加します。
貢献者は推薦原本を `.devouch/vouches/github-ID.json` としてPRに含めます。
**[Maintainers](https://geeknees.github.io/devouch/#maintainers)** 画面では、信頼する推薦者を選び、方針とworkflowをダウンロードできます。
ActionはPRのbase SHAから方針、head SHAからPR作者の推薦を読み取ります。PRのコード実行やマージ承認は行いません。
[メンテナー向け導入ガイド](docs/adoption-guide.md)と[エージェント管理者向けガイド](docs/agent-operator-guide.md)に手順があります。

## ENSv2の名前空間

- **推薦ごとにサブネームを分ける。** `masusanou.vouches.geeknees.eth` のような名前ごとに、専用のresolverレコードと失効履歴を持ちます。読みやすい名前のラベルと、署名するGitHub数値IDは別の値です。
- **エージェントにも名前空間を持たせる。** 管理者が宣言したGitHubアカウントとウォレットを、そのエージェントの識別情報として名前に記録できます。ENSv2 Enhanced Access Controlでプロフィールの各項目の編集権限を付与・撤回し、推薦と名前空間の管理権限は推薦者が保持します。
- **階層をたどって検証する。** 各親名、registry、所有権、関連する権限の変更履歴を確認します。変更した権限を元に戻しても、古い推薦は再び有効になりません。

推薦の公開・個別失効と、エージェントのプロフィール権限の付与・更新・撤回を、Sepolia上で実際のウォレットを使って確認済みです。
[名前空間の操作ガイド](docs/namespaces.md)と[実機確認記録](docs/sepolia-namespace-check.md)を参照してください。

## 設計上の選択

理由と出典は[企画・準備状況](docs/hackathon-planning.md)にまとめています。

- **共通の信頼スコアを作らない。** 誰を信頼するかは、それを判断する側によって変わります。各repoが受け入れる推薦者を選ぶため、同じ推薦でも採用と不採用に分かれます。一つのスコアにまとめると、メンテナーからその判断を奪ってしまいます。
- **トークン報酬を出さない。** 推薦や活動への報酬は、判断より量を優先させ、その負担をメンテナーへ押しつけるおそれがあります。[What happened to Tea?](https://nesbitt.io/2026/06/11/what-happened-to-tea.html) は、件数に基づく報酬がパッケージレジストリで悪用された経緯を扱っています。Devouchは報酬を出さず、推薦の価値は各プロジェクトがその推薦者をどれだけ信頼するかに委ねます。
- **中央サーバーを置かない。** 公開・取得・検証・失効にDevouch運営のサービス、鍵、データベースを必要としません。推薦者がENSレコードを所有し、誰でも静的ページ、CLI、ActionとRPCを使って検証できます。Devouch運営は推薦を偽造したり、操作を止めたり、ひそかに書き換えたりできません。

## Roadmap

次の導入目標は、独立した第三者のリポジトリでの試用です。
現在のAction試用はプロジェクト自身のrepoで行っています。World IDは以下の条件で引き続き保留しています。

## 保証すること・しないこと

Devouchは貢献をレビューするための参考情報です。人間性、アカウント所有権、著作者、コード品質、代理権、マージ許可を証明しません。
`human_verification` は常に `not_included` です。
[World sandbox](https://sandbox.auth.world.org/) は調査しましたが、World認証は実装しておらず、対応をうたってもいません。

**World IDをまだ統合していない理由：** 上記の **中央サーバーを置かない** 選択とのトレードオフです。
今回のイベント向けに調べた統合経路では、アプリ側が秘密情報を管理する必要があります。調査したagent sign-inはconfidential OIDC clientを前提とし、
[IDKit 4.0では検証を要求するアプリ（relying party）が証明要求へ署名します](https://docs.world.org/world-id/idkit/signatures)。
Devouch運営が共通の統合サービスを提供すると、その利用者は運営の鍵とサービスに依存します。
各利用者が自分で運用すれば責任を分散できますが、その経路全体はここでは検証できていません。
[オンチェーンでの証明検証はすでに可能](https://docs.world.org/world-id/idkit/onchain-verification)ですが、
検証できることだけでは、証明要求への署名が必要という条件はなくなりません。
人間性の証明と貢献者への推薦は異なる問いに答えるもので、組み合わせることができます。
Devouch運営のサービスを必須としない一連の統合経路を検証できるまで、World IDは保留します。
詳細は[賞の計画と統合条件](docs/ethglobal-tokyo-2026-prize-plan.md#world-を追加する場合の条件)を参照してください。

対応する名前・署名、履歴検証、snapshotの限界、公開される情報については、
[対応範囲](docs/usage.md#support-boundaries)と[検証契約](docs/protocol.md)にまとめています。

## 開発と検証

RubyとNode.jsに加え、Bun 1.3.13、Bundler、Chrome/Chromiumを使います。ランタイムがPATHにない場合はmiseを使ってください。

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run test:integration
```

結合テストは `dist/` を再ビルドし、固定した公式ENSコントラクトをローカルEVMで動かします。公開チェーンへの書き込みは行いません。
ブラウザの準備と配布物の確認は[開発手順の補足](docs/usage.md#development)を参照してください。

## 開発履歴

実装と公開の経緯は[検証記録](docs/implementation-status.md)、AIツールの使い方は[AI利用の開示](docs/submission.md#ai-tool-disclosure)に記載しています。

MITライセンス。[ENS artifactの出典](vendor/ens-v2/README.md)と配布物のライセンス表記に、利用した第三者コードを記載しています。
