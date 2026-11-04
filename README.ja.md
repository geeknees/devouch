<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouchのロゴ" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

貢献者への推薦を複数のリポジトリで使い、採否は各リポジトリで決めるためのツールです。

**Ruby CLI**、**[静的Webワークスペース](https://geeknees.github.io/devouch/)**、**読み取り専用のGitHub Action**を提供します。現行版はSepoliaのENSv2を使い、Devouch運営のAPI・DB・共有発行鍵・独自推薦コントラクトを必要としません。

**証拠の有効性とrepoの採否は別です。** 同じ推薦でも、repo Aでは `valid / accepted`、repo Bでは `valid / rejected` になり得ます。人によるレビューの参考情報であり、人間性・アカウント所有・著者・コード品質・代理権・マージ許可を証明するものではありません。

## 目的から探す

| やりたいこと | ガイド |
|---|---|
| 推薦を確認・公開・撤回する | [利用方法](docs/usage.md) |
| 自分のrepoに導入する | [メンテナー向けガイド](docs/adoption-guide.md) |
| 本人やエージェントのアカウントから貢献する | [投稿者・エージェント向けガイド](docs/agent-operator-guide.md) |
| Devouchを開発・改善する | [開発と貢献](CONTRIBUTING.md) |
| データ形式・制約・設計を知る | [ドキュメント一覧](docs/README.md) |

## 試す

[ワークスペース](https://geeknees.github.io/devouch/#verify)でENS名か公開PRのURLを入力します。検証にはウォレットは不要です。推薦の公開・撤回には発行者のウォレットとSepolia ETHを使います。

[公開例](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify)もありますが、期限と現在の状態を再確認してください。画面のサンプルrepo方針を変えると、実際のrepoを変更せずに採否の違いを試せます。

CLIを使うにはRuby 3.4以降とNode.js 24を用意し、このrepoをcloneします。JavaScriptの配布物は同梱済みで、CLIの利用だけならJavaScript依存のインストールは不要です。

```sh
./exe/devouch --help
./exe/devouch fetch --name CONTRIBUTOR.vouches.ISSUER.eth --output vouch.json \
  --publication-output publication.json --json
./exe/devouch check --repo OWNER/REPOSITORY --credential vouch.json \
  --subject github:12345 --json
```

ENS名、repo、GitHub数値IDを実際の値へ置き換えます。`check` は投稿先の方針を取得して検証し、PRは送信しません。[CLIの使い方と終了コード](docs/usage.md#cli)を参照してください。

## repoへ導入する

メンテナーが `.devouch/policy.json` と、確認済みのDevouch commitへ固定したworkflowを追加します。投稿者は推薦原本を `.devouch/vouches/github-ID.json` に配置します。

Actionは実際のPR作者の数値IDを対象とし、base SHAの方針とhead SHAの証拠を読みます。PR内のコードは実行しません。workflowが緑色でも推薦が受理されたとは限らず、証拠と採否の各項目を確認します。[導入ガイド](docs/adoption-guide.md)に手順をまとめています。

CLIを使えるエージェントには [devouch-checkスキル](skills/devouch-check/SKILL.md)を配布できます。推薦の確認結果は投稿の許可にはなりません。

## 設計と現在の位置づけ

- 信頼する推薦者はrepoごとに選び、共通スコアやトークン報酬を作りません。
- 推薦者が公開・撤回を管理し、必須のDevouch運営サービスを置きません。
- 期限・履歴・RPC取得失敗を区別します。撤回しても公開履歴は残ります。
- レビューとマージの判断はメンテナーが行います。

[Mitchell Hashimotoのvouch](https://github.com/mitchellh/vouch)を参考にした別実装です。vouchにも他repoの推薦リストを参照する機能があります。[設計原則と負担の比較](docs/design.md)を参照してください。

現行版はテストネット向けです。[検証履歴](docs/history.md)は確認日付きの記録であり、現在の稼働を保証しません。[ロードマップ](docs/roadmap.md)ではERC-8004評価と独立した第三者による導入を未完了事項として扱います。World IDは未実装で、`human_verification` は `not_included` です。

## 開発する

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run test:integration
```

Ruby・Node.jsに加えてBun 1.3.13とChrome/Chromiumを使います。結合テストは `dist/` を再生成し、使い捨てのローカルEVM上で動作します。[開発と貢献](CONTRIBUTING.md)に環境構築と配布物の確認手順があります。

MITライセンス。[ENS artifactの出典](vendor/ens-v2/README.md)と同梱noticeに第三者コードの情報を記載しています。
