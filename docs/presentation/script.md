# Devouch: Finalist Talk Script

ETHGlobal Tokyo 2026 finalist judging: **7 minutes = 4 min demo + 3 min Q&A.**
Target pace: ~130 words/min in English, so the 4-minute part is kept under ~500 words.

`[DEMO]` marks a screen action. `[FALLBACK]` is what to show if the live step fails.
Before going on stage, check which steps actually run on Sepolia versus the local EVM, and only say "on Sepolia" for steps that ran there.

## Timeline

| Time      | Section                | Screen                                 |
| --------- | ---------------------- | -------------------------------------- |
| 0:00–0:15 | Self-introduction      | Title slide                            |
| 0:15–0:50 | Problem                | 1 slide                                |
| 0:50–1:20 | Idea                   | 1 slide (diagram)                      |
| 1:20–3:30 | Live demo              | Web app → CLI → GitHub Action → revoke |
| 3:30–4:00 | Why it matters / close | Closing slide                          |
| 4:00–7:00 | Q&A                    | —                                      |

---

## English

### 0:00 — Self-introduction (15s)

> Hi, I'm Masumi Kawasaki. I built Devouch solo, with a coding agent, here at ETHGlobal Tokyo. Let's go straight in.

### 0:15 — Problem (35s)

> AI can now write pull requests faster than any maintainer can read them.
> A friend of mine who maintains the Hono web framework wrote about drowning in AI slop PRs.
> The code is cheap. The maintainer's time and trust are not.
>
> Mitchell Hashimoto's **vouch** shows a good answer: before reviewing, ask "has someone I trust vouched for this contributor?"
> But today that trust sits in one repository's list. Every new project starts from zero.

### 0:50 — Idea (30s)

> Devouch makes a vouch **portable and verifiable**.
>
> A recommender signs an endorsement for a GitHub account, and publishes it to **their own ENSv2 resolver**, straight from their wallet.
> Any repository can then verify it: the signature, the expiry, and whether it is still published on-chain.
> But **each repository decides** whether it trusts that recommender.
>
> Endorse once. Let each community decide.

### 1:20 — Demo (2m10s)

**1. Issue (≈35s)**

`[DEMO]` Open the static web app. Enter the contributor's GitHub numeric ID, scope `oss-contribution`, and expiry. Sign with the wallet, then publish to the recommender's ENS name.

> This is a static page. There is no Devouch server and no API key.
> I sign the endorsement with my own wallet, and write it to a text record on my own ENSv2 resolver. I own this record, not us.

**2. Verify in two repositories (≈35s)**

`[DEMO]` Run `devouch verify --credential ... --policy repo-a/policy.json --subject github:<id>` and the same command with `repo-b/policy.json`.

> Now two different repositories check the **same** endorsement.
> Repo A trusts this recommender: `valid`, `accepted`.
> Repo B doesn't: still `valid`, but `rejected`.
> The evidence is shared. The judgment stays with each project.

**3. GitHub Action on a real fork PR (≈30s)**

`[DEMO]` Show the PR's Devouch check summary.

> For maintainers, setup is two files: a policy and a workflow.
> The Action reads the PR author's ID, reads the endorsement from ENS, and reports the result.
> It never checks out or runs the PR's code, and it needs no secrets.

**4. Revoke (≈30s)**

`[DEMO]` In the web app, revoke the endorsement from the wallet. Re-run verify for both repos, then re-run the Action.

> Trust has to be withdrawable. I clear the record on ENS.
> The old JSON is still sitting in both repositories — but verification reads the on-chain history, so now both say `revoked`.
> One transaction, and every repository sees it.

`[FALLBACK]` If Sepolia is slow, show the recorded run of the same step and say so.

### 3:30 — Why it matters / close (30s)

> Three things we deliberately did **not** build:
> no global reputation score, no token rewards for endorsing, and no central service you must trust.
> We also don't claim "verified human" — Devouch shows who vouched for you, not who you are.
>
> ENSv2 gives us exactly what trust needs: a public record, owned by the person who endorses, and revocable at any time.
>
> AI can multiply code. It can't multiply a maintainer's trust. Devouch lets that trust travel. Thank you.

---

## 日本語

英語版と同じ構成・時間配分です。練習時の意味確認用、または日本語で発表する場合に使います。

### 0:00 — 自己紹介（15秒）

> Masumi Kawasakiです。Devouch は、このハッカソンで一人とコーディングエージェントで作りました。早速本題に入ります。

### 0:15 — 課題（35秒）

> AI によって、メンテナーが読み切れない速さで PR が作れるようになりました。
> Hono のメンテナーをしている友人も、AI slop の PR に悩まされていると記事に書いています。
> コードは安くなりました。でも、メンテナーの時間と信頼は安くなっていません。
>
> Mitchell Hashimoto の **vouch** は良い答えを示しています。レビューの前に「信頼できる誰かが、この貢献者を推薦しているか」を見る。
> ただ今は、その信頼が一つのリポジトリのリストに閉じています。新しいプロジェクトでは毎回ゼロからです。

### 0:50 — アイデア（30秒）

> Devouch は、推薦を **持ち運べて、検証できる** ものにします。
>
> 推薦者が GitHub アカウントへの推薦に署名し、**自分の ENSv2 resolver** へ、自分のウォレットから直接公開します。
> どのリポジトリでも、署名・期限・今もオンチェーンで公開されているかを検証できます。
> ただし、その推薦者を信頼するかは **各リポジトリが決めます**。
>
> 推薦は一度。判断は各コミュニティで。

### 1:20 — デモ（2分10秒）

**1. 発行（約35秒）**

`[DEMO]` 静的 Web アプリを開く。貢献者の GitHub 数値 ID、用途 `oss-contribution`、期限を入力。ウォレットで署名し、推薦者の ENS 名へ公開する。

> これは静的ページです。Devouch のサーバーも API キーもありません。
> 自分のウォレットで推薦に署名し、自分の ENSv2 resolver の text record に書き込みます。この記録を持っているのは私たちではなく推薦者です。

**2. 二つのリポジトリで検証（約35秒）**

`[DEMO]` `devouch verify --credential ... --policy repo-a/policy.json --subject github:<id>` を実行し、`repo-b/policy.json` でも同じコマンドを実行する。

> 二つのリポジトリが **同じ** 推薦を確認します。
> repo A はこの推薦者を信頼しているので `valid`・`accepted`。
> repo B は信頼していないので、`valid` のまま `rejected`。
> 証拠は共有し、判断は各プロジェクトに残ります。

**3. 実際の fork PR で GitHub Action（約30秒）**

`[DEMO]` PR の Devouch チェックの Summary を見せる。

> メンテナーの導入は、方針ファイルと workflow の2ファイルだけです。
> Action は PR 作者の ID を読み、ENS から推薦を読んで結果を表示します。
> PR のコードは checkout も実行もせず、secret も不要です。

**4. 失効（約30秒）**

`[DEMO]` Web アプリでウォレットから推薦を失効させる。両リポジトリで verify を再実行し、Action も再実行する。

> 信頼は取り消せなければいけません。ENS の記録を空にします。
> 古い JSON は両方のリポジトリに残ったままです。でも検証はオンチェーンの履歴を読むので、どちらも `revoked` になります。
> 一回のトランザクションで、すべてのリポジトリに反映されます。

`[FALLBACK]` Sepolia が遅い場合は、同じ手順の録画を見せ、録画であることを伝える。

### 3:30 — 意義とまとめ（30秒）

> あえて作らなかったものが三つあります。
> 全体共通の信用スコア、推薦へのトークン報酬、そして信頼を強いる中央サービスです。
> 「人間であることの確認済み」とも表示しません。Devouch が示すのは、あなたが誰かではなく、誰があなたを推薦したかです。
>
> ENSv2 は、信頼に必要なものをそのまま提供してくれます。公開された記録、推薦者自身が持つ所有権、そしていつでもできる取り消しです。
>
> AI はコードを増やせる。メンテナーの信頼は増やせない。Devouch は、その信頼を持ち運べるようにします。ありがとうございました。

---

## Q&A Preparation / Q&A 準備

Keep each answer to ~20 seconds. / 各回答は20秒程度に収める。

### What inspired your project? / 着想のきっかけは？

- **EN:** A friend who maintains Hono wrote about being overwhelmed by AI-generated PRs. vouch already had the right model — trust the contributor, not each PR — so I wanted to make that trust portable across projects without a central operator.
- **JA:** Hono のメンテナーをしている友人が、AI 生成の PR に困っていると書いていました。vouch は「PR ごとではなく貢献者を信頼する」という正しいモデルを持っているので、その信頼を中央の運営者なしにプロジェクト間で持ち運べるようにしたいと考えました。

### What tools did you use, and why? / 何を使い、なぜ？

- **EN:** ENSv2 on Sepolia for publishing and revoking, because the recommender owns the record and can delegate a limited key. EIP-712 signatures via viem. A Ruby CLI for verification, a GitHub Action for maintainers, and a static wallet page. I built it with a coding agent; the AI usage is documented in the repo.
- **JA:** 公開と失効に Sepolia の ENSv2。推薦者が記録を所有し、限定したキー権限を委任できるからです。署名は viem による EIP-712。検証は Ruby CLI、メンテナー向けに GitHub Action、操作用に静的なウォレットページ。開発にはコーディングエージェントを使い、AI の利用範囲はリポジトリに記載しています。

### What challenges did you solve? / どんな課題を解決した？

- **EN:** Revocation. A copied JSON file can't revoke itself, so verification reads the resolver's history and rejects an endorsement that was cleared — even if someone re-publishes the old one. Also keeping "evidence is valid" separate from "this repo accepts it."
- **JA:** 失効です。コピーされた JSON は自分では失効できないので、検証時に resolver の履歴を読み、一度消された推薦は、古いものを再掲載されても拒否します。また「証拠が有効」と「この repo が受け入れる」を分けて扱いました。

### Why a blockchain? Why not a JSON file on GitHub? / なぜブロックチェーン？GitHub の JSON では駄目？

- **EN:** GitHub can distribute copies, but it can't tell you whether the recommender still stands behind them. ENS is the one shared place every repository can check for the current state and revocation, without asking us.
- **JA:** GitHub はコピーを配れますが、推薦者が今もそれを支持しているかは分かりません。ENS は、各リポジトリが私たちに問い合わせずに、現在の状態と失効を確認できる共通の場所です。

### Does this prove the contributor is human? / 人間であることを証明する？

- **EN:** No, and we say so in every result (`human_verification: not_included`). Being human and being trustworthy are different things. We looked at World ID, but only want to add it if it doesn't require a central service.
- **JA:** しません。結果にも毎回明示しています（`human_verification: not_included`）。人間であることと信頼できることは別です。World ID も検討しましたが、中央のサービスを必須にしない形で組み込める場合のみ追加します。

### What about AI agents opening PRs? / AI エージェントの PR は？

- **EN:** An agent with its own GitHub account can be endorsed directly, like a person. The endorsement is about the account that sends the PR.
- **JA:** 専用の GitHub アカウントを持つエージェントも、人と同じように直接推薦できます。推薦の対象は PR を送るアカウントです。

### Costs and privacy? / コストとプライバシーは？

- **EN:** Only the recommender pays gas, to publish or revoke. Maintainers' Actions only read. Endorsements are public and stay in the history after revocation, so the recommender should publish knowingly.
- **JA:** ガスを払うのは公開・失効する推薦者だけで、メンテナーの Action は読み取りのみです。推薦は公開され、失効後も履歴に残るので、推薦者はそれを理解した上で公開します。

### What's next? / 今後は？

- **EN:** Multiple endorsements per recommender (today it's one record, one endorsement), easier resolver setup for maintainers, and trying it on a real OSS project.
- **JA:** 一人の推薦者が複数人を推薦できる構成（現状は一記録一推薦）、メンテナーの resolver 設定の簡略化、実際の OSS での試用です。
