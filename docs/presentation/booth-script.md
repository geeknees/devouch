# Devouch: Partner Booth Script

スポンサー（主に ENS）のブースで見せる、**PC を操作しない**デモの台本。
字幕付きの録画デモと、審査員のスマホで開く検証ページだけで進める。取引は送らないので、同じ推薦で何回でも繰り返せる（推薦の期限は 2026-10-02 16:45 UTC）。

- 基本は約3分。時間がなければ「短縮版」にする。審査員の関心に合わせて「深掘り」を足す。
- 英語の書き方は [決勝の台本](script.md) と同じ（`/` は息継ぎ、**太字** は強く言う語）。読み方の表もそちらを見る。
- 動画の中の発行と取り消しはローカルのチェーン（公式 ENSv2 コントラクト）での録画で、画面にもそう出ている。Action の場面は GitHub 上の実際の PR #2。
- 「on Sepolia」と言ってよいのは、検証ページ（QR）と CLI で Sepolia の推薦を読むときだけ。

## 準備

| もの | 状態 |
| --- | --- |
| 字幕付きの動画 | `tools/video/out/devouch-demo-cut-captions.mp4`（2分10秒、音声なし）。全画面ですぐ再生できるようにしておく |
| QR | スライドの「Try it on your phone」か、印刷した QR。検証ページ（https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify）を開く |
| 予備 | 同じ検証ページを自分の PC でも開いておく（審査員がスマホを出さないとき用） |

審査の直前に、検証ページで推薦が `valid` のままかを一度確かめる。

## 流れ

| 時間 | 内容 | 見せるもの |
| --- | --- | --- |
| 0:00–0:15 | つかみ | なし（または表紙のスライド） |
| 0:15–2:25 | デモ | 字幕付きの動画 |
| 2:25–2:50 | 自分で試してもらう | QR → 審査員のスマホ |
| 2:50–3:00 | まとめ | なし |

**短縮版（約1分30秒）:** つかみ → QR で試してもらう → 動画は「Action」と「取り消し」の場面（1:03〜2:10）だけ → まとめ。

---

## English

### 1. Hook (15s)

> Hi, I'm [Name]. / This is **Devouch.**
> Maintainers get / too many AI pull requests.
> Devouch lets trust / **move between projects.**

### 2. Demo video (2m10s)

`[DEMO]` Play `devouch-demo-cut-captions.mp4` full screen.

> Here is a two-minute demo. / It's a recording, / so you can see / every step.

Then let the captions speak. If the judge looks at you, read the caption aloud or add one line:

| When the caption says | You can add |
| --- | --- |
| "The signed JSON goes to my own ENSv2 resolver" | The **whole signed JSON** / is a text record / on **my own resolver.** |
| "Repo B doesn't: valid · rejected" | Same evidence. / **Each project decides.** |
| "A real run on fork PR #2" | This part is **real,** / on GitHub. |
| "Load the vouch, confirm, and clear the record" | **Only I** can take it back. |
| "Both now say revoked" | One transaction. / Every repository / sees it. |

### 3. Try it yourself (25s)

`[DEMO]` Show the QR. Let the judge open it on their phone.

> Please scan this. / **Try it yourself.**
> No wallet. / This one is **live on Sepolia.**
> It says / "Vouched by masusanou-dev.eth."
> Add me to repo B, / and it changes / to **accepted.**

### 4. Close (10s)

> **Endorse once. / Let each community decide.** / Thank you.

---

## Deep dives（聞かれたら足す）

### Why ENSv2? (ENS judges)

> The vouch lives / **on ENS,** / not on a Devouch server.
> I own the resolver. / I can publish or clear it / **without Devouch approval.**
> I can give a helper wallet / permission / for **one text key only.**
> Devouch reads / the **history** of that record. / So an old vouch / can't come back.

`[DEMO]` If asked, open [`vendor/ens-v2/README.md`](../../vendor/ens-v2/README.md) and show where the pinned official Sepolia contracts come from. No new contract was written.

### What's next with ENS?

> Next, / one **subname** / per endorsement.
> And AI agents / as **namespaces,** / each with its own permissions.

（詳しくは [README の Roadmap](../../README.md#roadmap)）

### How does verification work?

> Devouch checks / the signature, / the expiry, / and the record on ENS.
> It reads a block / **two blocks behind** the head.
> Then the repository's policy / decides.

### What if a website disappears?

> The web page is **static.**
> You can run it / on your own computer, / with any RPC.
> The CLI reads ENS / **directly.**

### What's not included?

> It does not replace / code review.
> It shows / **who vouches for you.**

---

## 日本語

英語版と同じ構成。意味の確認用、または日本語で説明する場合に使う。

### 1. つかみ（15秒）

> [Name] です。Devouch です。
> メンテナーは、AI の PR が多すぎて困っています。
> Devouch は、信頼をプロジェクトの間で持ち運べるようにします。

### 2. デモ動画（2分10秒）

`[DEMO]` `devouch-demo-cut-captions.mp4` を全画面で流す。

> 2分のデモをお見せします。録画なので、全部の手順が見られます。

あとは字幕に任せる。審査員がこちらを見たら、字幕を読み上げるか、次の一言を足す。

| 字幕 | 足せる一言 |
| --- | --- |
| 「The signed JSON goes to my own ENSv2 resolver」 | 署名付きの JSON 全体が、私の resolver の text record に入ります。 |
| 「Repo B doesn't: valid · rejected」 | 証拠は同じ。判断は各プロジェクトです。 |
| 「A real run on fork PR #2」 | ここは GitHub 上の本物です。 |
| 「Load the vouch, confirm, and clear the record」 | 取り消せるのは私だけです。 |
| 「Both now say revoked」 | 一回のトランザクションで、すべての repo に届きます。 |

### 3. 自分で試してもらう（25秒）

`[DEMO]` QR を見せて、審査員のスマホで開いてもらう。

> これを読み取って、ご自身で試してみてください。
> ウォレットは要りません。こちらは Sepolia の本物のデータです。
> 「Vouched by masusanou-dev.eth」と出ます。
> repo B に私を追加すると、accepted に変わります。

### 4. まとめ（10秒）

> 推薦は一度。判断は各コミュニティで。ありがとうございました。

### 深掘り（聞かれたら）

- **なぜ ENSv2？:** 推薦はサーバーではなく ENS にあります。resolver は私のもので、Devouch 運営者の承認なしに公開も取り消しもできます。補助のウォレットに、一つの text key だけの権限を渡せます。記録の履歴を読むので、古い推薦は戻りません。聞かれたら `vendor/ens-v2/README.md` で、固定した公式コントラクトの出どころを見せる。新しいコントラクトは書いていない。
- **ENS での次の一手:** 推薦ごとにサブネームを作ること、AI エージェントを名前空間として扱い、それぞれに権限を持たせること（README の Roadmap）。
- **検証の仕組み:** 署名・期限・ENS の記録を確認します。最新から2ブロック前の状態を読みます。そのあと、リポジトリの方針が判断します。
- **サイトがなくなったら？:** Web は静的なので、自分のパソコンで、好きな RPC で動かせます。CLI は ENS を直接読みます。
- **含まないもの:** コードレビューの代わりにはなりません。示すのは、誰があなたを推薦しているかです。

---

## 付録：CLI で見せる場合（聞かれたときだけ）

端末を repo のルートで開いておく。どれも読むだけで、取引は送らない。取得できないときは `--rpc-url https://rpc.sepolia.ethpandaops.io` を付ける。

```sh
mkdir -p .devouch/local/demo

# A. ENS から原本を取り出す（Devouch のサイトを使わない）
rm -f .devouch/local/demo/booth-fetched.json
./exe/devouch fetch --name masusanou-dev.eth --output .devouch/local/demo/booth-fetched.json

# B. repo A：valid / accepted
./exe/devouch verify --credential .devouch/local/demo/booth-fetched.json --policy examples/demo/policy-a.json --subject github:287365775

# C. repo B：valid / rejected
./exe/devouch verify --credential .devouch/local/demo/booth-fetched.json --policy examples/demo/policy-b-reject.json --subject github:287365775
```
