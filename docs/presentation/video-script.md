# Devouch: Demo Video Script

`tools/video/` で作るベース動画（3分36秒）に合わせた、録音用の台本。
各場面の長さは `tools/video/out/EDIT-LIST.md` の値で、英語は1分あたり約130語で収まる分量にしている。
ライブ審査用の [トークスクリプト](script.md) とは別物で、こちらは審査員が後から一人で見る前提で書いている。

- 声は本人が録る。合成音声は ETHGlobal の規約で禁止。
- アプリと端末の場面はローカル EVM で録画している。ナレーションでは Sepolia で動かしたとは言わない。
- `[Name]` は録音時に自分の名前に置き換える。

## 場面と尺

| 時刻 | クリップ | 画面 | 英語の目安 |
| --- | --- | --- | --- |
| 0:00–0:47 | `01-zoom` | OSS のグラフ → repo → PR → 推薦 JSON → ENS → 履歴へズーム | 約100語 |
| 0:47–1:11 | `02-idea` | カバー（一つの推薦が二つの repo へ） | 約50語 |
| 1:11–1:47 | `03-publish` | Web で発行：接続 → 入力 → 確認 → 署名 → 公開 | 約75語 |
| 1:47–2:10 | `04-verify` | CLI：repo A は accepted、repo B は rejected | 約50語 |
| 2:10–2:30 | `05-action-slot` | 差し替え枠：実 fork PR の Action Summary | 約40語 |
| 2:30–2:51 | `06-revoke` | Web で失効 | 約45語 |
| 2:51–3:10 | `07-revoked` | CLI：両方 revoked | 約40語 |
| 3:10–3:36 | `08-closing` | 作らなかったもの三つ → 決め台詞 | 約55語 |

---

## English

### 01-zoom

> Hi, I'm [Name], and this is Devouch.
>
> Open source is a huge graph of people and projects. Today, AI can write pull requests faster than any maintainer can read them.
> Code got cheap. A maintainer's attention did not.
>
> Mitchell Hashimoto's vouch has a good answer: before you review, ask whether someone you trust has vouched for this contributor.
> But that trust lives in one repository's list. Move to a new project, and you start from zero.
>
> So let's zoom in on what a portable vouch looks like: a small signed file in the pull request, published on ENS.

### 02-idea

> Devouch makes a vouch portable and verifiable.
> A recommender signs an endorsement for a GitHub account and publishes it to their own ENSv2 name.
> Any repository can check it. But each repository decides for itself whether it trusts that recommender.
> Endorse once. Let each community decide.

### 03-publish

> This is the issuer workspace. It's a static page: no Devouch server, no API key, no database.
> For this recording we run it on a local chain with the official ENSv2 contracts.
> I enter my ENS name and the contributor's numeric GitHub ID, and review exactly what I'm about to sign.
> Signing and publishing are two separate steps.
> The signed JSON goes into a text record on my own resolver, and I download the original.

### 04-verify

> Now two repositories check the same endorsement with the Ruby CLI.
> Repo A trusts this recommender: valid, accepted.
> Repo B doesn't: the evidence is still valid, but the policy says rejected.
> The evidence is shared. The judgment stays with each project.

### 05-action-slot

> For maintainers, setup is two files: a policy and a workflow.
> On every pull request, the GitHub Action matches the endorsement to the actual PR author and reports the result.
> It never checks out or runs the PR's code, and it needs no secrets.

### 06-revoke

> Trust has to be withdrawable.
> I load the same endorsement, confirm, and clear the record from my own wallet.
> Only the issuer can do this. Devouch can't do it for them, and can't stop them either.

### 07-revoked

> The old JSON is still sitting in both repositories.
> But verification reads the record's history on ENS, so both now say revoked.
> One transaction, and every repository sees it. Writing the old JSON back to ENS won't revive it either.

### 08-closing

> We deliberately did not build a global reputation score, token rewards for endorsing, or a central service you must trust.
> Devouch doesn't prove that someone is human, and it doesn't replace code review.
> It shows who vouched for you, in a record anyone can check.
> Endorse once. Let each community decide.

---

## 日本語

英語版と同じ構成。意味の確認用、または日本語で録る場合に使う。日本語は英語より尺が伸びやすいので、録ってから場面の長さを確認する。

### 01-zoom

> [Name] です。Devouch を紹介します。
>
> オープンソースは、人とプロジェクトがつながった巨大なグラフです。いま AI は、メンテナーが読み切れない速さで PR を書けます。
> コードは安くなりました。でも、メンテナーの注意力は安くなっていません。
>
> Mitchell Hashimoto の vouch は良い答えを示しています。レビューの前に、信頼できる誰かがこの貢献者を推薦しているかを見る。
> ただ、その信頼は一つのリポジトリのリストの中にあります。新しいプロジェクトに移れば、ゼロからやり直しです。
>
> では、持ち運べる推薦がどんなものか、ズームして見てみましょう。PR の中の小さな署名付きファイルが、ENS に公開されています。

### 02-idea

> Devouch は、推薦を持ち運べて、検証できるものにします。
> 推薦者が GitHub アカウントへの推薦に署名し、自分の ENSv2 の名前に公開します。
> どのリポジトリでも確認できます。ただし、その推薦者を信頼するかは、各リポジトリが自分で決めます。
> 推薦は一度。判断は各コミュニティで。

### 03-publish

> これが推薦者のワークスペースです。静的なページで、Devouch のサーバーも API キーもデータベースもありません。
> この録画では、公式の ENSv2 コントラクトを入れたローカルのチェーンで動かしています。
> 自分の ENS 名と、貢献者の GitHub 数値 ID を入れて、署名する内容をそのまま確認します。
> 署名と公開は、別々の手順です。
> 署名した JSON は自分の resolver の text record に入り、原本をダウンロードします。

### 04-verify

> 二つのリポジトリが、同じ推薦を Ruby の CLI で確認します。
> repo A はこの推薦者を信頼しているので、valid、accepted。
> repo B は信頼していないので、証拠は valid のまま、方針は rejected です。
> 証拠は共有し、判断は各プロジェクトに残ります。

### 05-action-slot

> メンテナーの導入は、方針ファイルと workflow の二つだけです。
> PR のたびに、GitHub Action が推薦を実際の PR 作者と照合して、結果を表示します。
> PR のコードは checkout も実行もせず、secret も要りません。

### 06-revoke

> 信頼は、取り消せなければいけません。
> 同じ推薦を読み込んで確認し、自分のウォレットから記録を空にします。
> これができるのは推薦者だけです。Devouch が代わりにすることも、止めることもできません。

### 07-revoked

> 古い JSON は、両方のリポジトリに残ったままです。
> でも検証は ENS 上の記録の履歴を読むので、どちらも revoked になります。
> 一回のトランザクションで、すべてのリポジトリに届きます。古い JSON を ENS に書き戻しても、推薦は復活しません。

### 08-closing

> あえて作らなかったものがあります。全体共通の信用スコア、推薦へのトークン報酬、そして信頼を強いる中央サービスです。
> Devouch は、人間であることを証明しませんし、コードレビューの代わりにもなりません。
> 示すのは、誰があなたを推薦したか。それを、誰でも確かめられる記録で示します。
> 推薦は一度。判断は各コミュニティで。
