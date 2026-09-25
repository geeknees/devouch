# Devouch: Partner Booth Script

スポンサー（主に ENS）のブースで見せる、**失効させない**デモの台本。
取引を一切送らないので、同じ推薦で何回でも繰り返せる。推薦の期限は 2026-10-02 16:45 UTC。

- 基本は約2分。審査員の関心に合わせて「深掘り」を足す。
- 英語の書き方は [決勝の台本](script.md) と同じ（`/` は息継ぎ、**太字** は強く言う語）。読み方の表もそちらを見る。
- 失効は本番で行わず、[デモ動画](../../tools/video/README.md) の該当場面を見せる。その映像はローカル EVM での録画で、画面にもそう出ている。口頭でもそう言う。
- 「on Sepolia」と言ってよいのは、Sepolia の推薦を読む操作（下のコマンド）だけ。

## 準備

| もの | 状態 |
| --- | --- |
| `.devouch/local/demo/vouch.json` | Sepolia に公開済みの推薦の原本（[本番のコマンド](script.md#live-demo-commands)） |
| `examples/demo/policy-a.json`, `examples/demo/policy-b-reject.json` | Git管理済み |
| 端末 | repo のルートで開いておく |
| ブラウザ | Web アプリの **Retrieve** タブ、デモ用 PR の Devouch チェック、デモ動画（`clips/06-revoke.mp4` と `clips/07-revoked.mp4`） |

決勝の前にリハーサルで失効させた場合は、公開し直した新しい推薦に合わせて `vouch.json` を置き直す。

## コマンド

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

どれも読むだけで、取引は送らない。取得できないときは `--rpc-url https://rpc.sepolia.ethpandaops.io` を付ける。

---

## English

### 1. Hook (15s)

> Hi, I'm [Name]. / This is **Devouch.**
> Maintainers get / too many AI pull requests.
> Devouch lets trust / **move between projects.**

### 2. Where the vouch lives (35s)

`[DEMO]` Run command A. Then open the fetched JSON and point at `issuer`, `subject`, `scope`, `expiresAt`.

> I signed this vouch / with my wallet.
> The **whole signed JSON** / is a text record / on **my own ENSv2 resolver.**
> I just read it / **from ENS,** / on Sepolia. / No Devouch server.

### 3. Same vouch, two decisions (35s)

`[DEMO]` Run commands B and C.

> Two repositories / check the **same** vouch.
> Repo A trusts me: / **accepted.**
> Repo B does not: / **rejected.**
> The evidence is shared. / **Each project decides.**

### 4. GitHub Action (20s)

`[DEMO]` Show the PR's Devouch check summary.

> For maintainers, / it's **two files.** / A policy / and a workflow.
> It does not run / the PR's code.

### 5. Taking it back (15s)

`[DEMO]` Play `06-revoke` and `07-revoked` from the demo video.

> I can take a vouch back / from my wallet.
> This part is **a recording** / on a local chain.
> After that, / both repositories say / **revoked.**

### 6. Close (10s)

> **Endorse once. / Let each community decide.** / Thank you.

---

## Deep dives（聞かれたら足す）

### Why ENSv2? (ENS judges)

> The vouch lives / **on ENS,** / not on a Devouch server.
> I own the resolver. / I can publish or clear it / **without Devouch approval.**
> I can give a helper wallet / permission / for **one text key only.**
> Devouch reads / the **history** of that record. / So an old vouch / can't come back.

`[DEMO]` If asked, open [`vendor/ens-v2/README.md`](../../vendor/ens-v2/README.md) and show where the pinned official Sepolia contracts come from. No new contract was written.

### How does verification work?

> Devouch checks / the signature, / the expiry, / and the record on ENS.
> It reads a block / **two blocks behind** the head.
> Then the repository's policy / decides.

### What if a website disappears?

> The web page is **static.**
> You can run it / on your own computer, / with any RPC.
> The CLI reads ENS / **directly.**

### What's not included?

> It does not prove / someone is human.
> It does not replace / code review.
> It shows / **who vouches for you.**

---

## 日本語

英語版と同じ構成。意味の確認用、または日本語で説明する場合に使う。

### 1. つかみ（15秒）

> [Name] です。Devouch です。
> メンテナーは、AI の PR が多すぎて困っています。
> Devouch は、信頼をプロジェクトの間で持ち運べるようにします。

### 2. 推薦はどこにあるか（35秒）

`[DEMO]` コマンド A を実行し、取り出した JSON の `issuer`・`subject`・`scope`・`expiresAt` を指す。

> この推薦は、私のウォレットで署名しました。
> 署名付きの JSON 全体が、私自身の ENSv2 resolver の text record に入っています。
> 今、それを ENS から直接読みました。Sepolia 上です。Devouch のサーバーは使っていません。

### 3. 同じ推薦、二つの判断（35秒）

`[DEMO]` コマンド B と C を実行する。

> 二つのリポジトリが、同じ推薦を確認します。
> repo A は私を信頼しています。accepted。
> repo B は信頼していません。rejected。
> 証拠は共有し、判断は各プロジェクトが決めます。

### 4. GitHub Action（20秒）

`[DEMO]` PR の Devouch チェックの Summary を見せる。

> メンテナーの導入は、方針ファイルと workflow の二つだけです。
> PR のコードは実行しません。

### 5. 取り消し（15秒）

`[DEMO]` デモ動画の `06-revoke` と `07-revoked` を流す。

> 推薦は、自分のウォレットから取り消せます。
> ここはローカルのチェーンでの録画です。
> 取り消した後は、両方のリポジトリが revoked になります。

### 6. まとめ（10秒）

> 推薦は一度。判断は各コミュニティで。ありがとうございました。

### 深掘り（聞かれたら）

- **なぜ ENSv2？:** 推薦はサーバーではなく ENS にあります。resolver は私のもので、Devouch運営者の承認なしに公開も取り消しもできます。補助のウォレットに、一つの text key だけの権限を渡せます。記録の履歴を読むので、古い推薦は戻りません。聞かれたら `vendor/ens-v2/README.md` で、固定した公式コントラクトの出どころを見せる。新しいコントラクトは書いていない。
- **検証の仕組み:** 署名・期限・ENS の記録を確認します。最新から2ブロック前の状態を読みます。そのあと、リポジトリの方針が判断します。
- **サイトがなくなったら？:** Web は静的なので、自分のパソコンで、好きな RPC で動かせます。CLI は ENS を直接読みます。
- **含まないもの:** 人間であることは証明しません。コードレビューの代わりにもなりません。示すのは、誰があなたを推薦しているかです。
