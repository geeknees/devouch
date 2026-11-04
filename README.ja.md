<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouchのロゴ" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

貢献者への第三者推薦を複数のリポジトリで使い、採否は各リポジトリで決めるツールです。

**Ruby CLI**、**静的ウォレット画面**、**読み取り専用GitHub Action**を提供します。Sepolia上のERC-8004 Identity / Reputation Registryを使い、Devouch運営のAPI・DB・共有発行鍵・独自推薦コントラクトを必要としません。

**証拠の有効性とrepoの採否は別です。** 同じ推薦でも、repo Aでは `valid / accepted`、repo Bでは `valid / rejected` になり得ます。人によるレビューの参考情報であり、人間性・GitHubアカウント所有・著者・コード品質・代理権・マージ許可は証明しません。

## 目的から探す

| やりたいこと | ガイド |
|---|---|
| agent登録、推薦の発行・検証・撤回 | [利用方法](docs/usage.md) |
| 自分のrepoへ導入 | [メンテナー向けガイド](docs/adoption-guide.md) |
| 本人やエージェントのアカウントから投稿 | [投稿者向けガイド](docs/agent-operator-guide.md) |
| ENS版から移行 | [更新と切り戻し](docs/upgrading-0.3.md) |
| Devouchの開発・改善 | [開発と貢献](CONTRIBUTING.md) |
| 証拠形式と設計を理解 | [ドキュメント一覧](docs/README.md) |

## CLIで試す

Ruby 3.4以降とNode.js 24を用意し、このrepoをcloneします。JavaScript配布物は同梱済みで、CLIだけならJavaScript依存のインストールは不要です。

```sh
./exe/devouch --help
./exe/devouch verify --credential feedback.json --policy .devouch/erc8004-policy.json \
  --subject github:12345 --json
./exe/devouch check --repo OWNER/REPOSITORY --credential feedback.json \
  --subject github:12345 --json
```

独立した評価者から実際のfeedback参照ファイルを受け取り、投稿するアカウントの数値IDを使います。`check` は投稿先の方針を固定commitから取得し、PRは送信しません。登録・対応付け・発行・取得・撤回の操作は[利用方法](docs/usage.md)にまとめています。

画面をローカルで動かすには `bun install --frozen-lockfile`、`bun run build`、`node scripts/serve.ts` を実行し、表示されたURLを開きます。検証はウォレット不要、発行は対象ウォレットとSepoliaのガス代が必要です。[公開ワークスペース](https://geeknees.github.io/devouch/)はERC-8004 0.3を配信しており、配信ファイルとウォレット不要のPR検証を[2026-11-05（日本時間）に確認しました](docs/history.md)。Pagesの配信更新はソースのマージとは別に行います。

## repoへ導入する

[方針のひな型](examples/erc8004/policy.json)をコピーし、registryの固定値と投稿先repo IDを確認したうえで、信頼する評価者を選びます。ひな型の信頼リストは空です。投稿者は `.devouch/feedback/github-ID.json` を配置します。Actionは実際のPR作者IDとbase SHAの方針を使い、PR内のコードは実行しません。

Actionを確認済みのERC-8004 commitへ固定します。緑のジョブでも `missing`、`revoked`、`rejected` の場合があるため、証拠と採否の各欄を確認します。[導入ガイド](docs/adoption-guide.md)を参照してください。CLI対応エージェントには、許可済みの投稿作業向けに [devouch-checkスキル](skills/devouch-check/SKILL.md)を用意しています。

## 設計と現在の位置づけ

agentの管理者がGitHub IDを宣言し、独立した評価者が推薦します。agentの所有者と承認済みoperatorは自己推薦できません。信頼する評価者・用途・chain・registry実装はrepoごとに選びます。共通スコア、トークン報酬、自動承認・マージはありません。撤回しても公開履歴は残り、次回検証から判定へ反映されます。

[ERC-8004評価](docs/erc8004-evaluation.md)にENSからの移行理由と制約を記載しています。ローカルEVM・CLI・ブラウザの検証、[公開registryの読み取り結果](docs/erc8004-deployment.md)、[公開画面の動作確認](docs/history.md)は別の証拠です。実ウォレットでの公開feedback発行・撤回と、公開された投稿者推薦の受理は未検証です。テストネット向けで、`human_verification` は `not_included` です。

[Mitchell Hashimotoのvouch](https://github.com/mitchellh/vouch)を参考にした別実装です。vouchにもrepo間で推薦リストを共有する機能があります。[設計](docs/design.md)、[検証履歴](docs/history.md)、[ロードマップ](docs/roadmap.md)も参照してください。

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

Ruby・Node.jsに加えてBun 1.3.13とChrome/Chromiumを使います。結合テストは `dist/` を再生成し、使い捨てのローカルEVMで動きます。[開発と貢献](CONTRIBUTING.md)にブラウザの準備と配布物の一致確認手順があります。

MITライセンス。[ERC-8004 fixtureの出典](vendor/erc-8004/README.md)と同梱noticeに第三者コードの情報を記載しています。
