# Devouch: Finalist Talk Script

ETHGlobal Tokyo 2026 finalist judging: **7 minutes = 4 min demo + 3 min Q&A.**

英語が母語でない発表者向けに書いている。

- 1文は短く（ほぼ10語以内）。ゆっくり話しても4分に収まるよう、英語は約320語（1分あたり約100語）にしている。
- `/` は息継ぎの位置。**太字** は強く言う語。
- 大事な言葉はスライドにも出す。詰まったらスライドを読めばよい。
- `[DEMO]` は画面の操作。`[FALLBACK]` は本番の操作が失敗したときに見せるもの。
- 「on Sepolia」と言うのは、実際に Sepolia で動かした操作だけにする。

## 当日の段取り

**本番のデモは録画で行う（2026-09-26 決定）。** 台本を見ながら PC を操作するのは負担が大きいため。デモの部分だけ、音声なし・字幕付きの動画 `tools/video/out/devouch-demo-cut-captions.mp4`（約2分10秒）を流す。字幕を読み上げてもよいし、黙って字幕に任せてもよい。

- 動画の中の発行と取り消しはローカルのチェーン（公式 ENSv2 コントラクト）での録画で、画面にもそう出ている。Action の場面は GitHub 上の実際の PR #2。
- 本番では取引を送らないので、推薦を公開し直す必要はない。Sepolia の推薦（QR が指す `masusanou.vouches.geeknees.eth`、予備の `masusanou-dev.eth`）はそのまま残し、最後に QR で審査員に確かめてもらう。
- 手でライブ操作する版は、下の「ライブ操作版（予備）」に残してある。使うときだけ、その段取りに従う。

準備するもの:

1. スライド（表紙から順に。「Live demo」のスライドで動画に切り替える）。
2. 動画 `devouch-demo-cut-captions.mp4` を全画面で再生できる状態にしておく（音声はない。字幕が会場の後ろからも読めるか確認）。予備に声入りの `devouch-demo-cut.mp4` も置いておく。
3. 念のため、完成版 `devouch-demo-voiced.mp4` と、検証ページ（https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify）もすぐ開けるようにしておく。

### 9/27 の流れ（リハーサルは提出後）

| 時刻（JST） | やること |
| --- | --- |
| 09:00 まで | 提出を終える |
| 09:00 以降 | リハーサル。スライドと動画の切り替えまで通し、時間を計る |
| 14:30 | 決勝の審査 |

- リハーサルで見つかった問題は、台本と操作だけで直す。提出済みの資料は変えない。
- 検証ページの推薦が `valid` のままかを、審査の直前に一度確かめる（QR を読んでもらうため）。

## 録画デモ版（本番はこちら）

| Time | Section | Screen |
| --- | --- | --- |
| 0:00–1:15 | 自己紹介・課題・アイデア | スライドで話す（下の English の該当部分） |
| 1:15–1:20 | 動画への橋渡し | 「Live demo」のスライド |
| 1:20–3:30 | デモ | 動画 `devouch-demo-cut-captions.mp4` を流す（字幕を読み上げるか、黙る） |
| 3:30–4:00 | 試してもらう・まとめ | 「Try it on your phone」→ まとめ → 最後のスライド |

動画の前に（5秒）:

> Here is a two-minute demo.

> 2分のデモをお見せします。

動画の後は、English の「3:30 — Close」をそのまま話す（QR のスライドから）。
動画の中でもローカルのチェーンで録ったことを話しているので、ここで繰り返さなくてよい。
QR のスライドでは「This one is live on Sepolia.」と一言添えると、録画との違いがはっきりする。

## 読み方の手がかり

| 語 | 読み | 強勢 |
| --- | --- | --- |
| repository | リ**ポ**ジトリー | po |
| verify | **ヴェ**リファイ | ve |
| accepted | アク**セ**プティッド | cep |
| rejected | リ**ジェ**クティッド | jec |
| revoked | リ**ヴォ**ークト | vo |
| vouch | **ヴァ**ウチ（一音節） | vouch |
| ENS | イー・エン・**エ**ス | S |
| maintainer | メイン**テ**イナー | tai |
| contributor | コン**トリ**ビューター | tri |

## 発音の注意（録音の文字起こしから）

動画用の録音（2026-09-26）を whisper.cpp（英語の小さめのモデル base.en）で書き起こし、台本と食い違った語をまとめた。モデル側の聞き違いもあり得るので、「見直す候補」として使う。「static page, no API key, no database」「Two repositories check the same endorsement」などは台本どおりに書き起こされていて、全体はよく伝わっている。上の表にある語の読み方はそちらを見る。

| 優先 | 台本 | 書き起こされた言葉 | 直し方 |
| --- | --- | --- | --- |
| 1 | Endorse **once**. Let each **community** **decide**. | and those ones / commentate the side | once は「ワンス」で s で止める（ones にしない）。community は「コ**ミュー**ニティ」。decide は「ディ**サイ**ド」を切らずに一続きで。決め台詞なので一番練習する |
| 2 | **Devouch** / **vouch** | the Verge, diverge, The voice, voted | 「ディ**ヴァウ**チ」。ouch（アウチ）に v を付け、最後の「チ」まで言う |
| 3 | R と L | run → land、clear → create、Ruby → lib | R は舌をどこにも付けず唇を少し丸める。L は舌先を上の歯の裏に付ける。台本では repo・record・rejected・revoked が R、clear・pull が L |
| 4 | maintainer | mentors, maintenance | 「メンテナンス」の感覚にしない。2音節目の「**テイ**」を伸ばす |
| 5 | Repo **A** trusts | repo way draws | A は「エイ」と、repo から少し離す。trusts は語尾の「スツ」まで |
| 6 | issuer / resolver | issue / reservoir | 「**イ**シューアー」と最後の「アー」まで。「リ**ゾ**ルヴァー」 |
| 7 | 長い音・短い音 | cheap → chip、sees → says、sitting → setting、stays → states | ee（イー）はしっかり伸ばす。短い i（イ）は「エ」に寄せない。stays は濁った z で終える |
| 8 | ENSv2 | ENSA video, ENS virtual | 「イー・エン・エス・**ヴィー・トゥー**」と1文字ずつ区切る |

## 動画の字幕（読み上げの練習用）

決勝とブースで流す `devouch-demo-cut-captions.mp4`（音声なし、2:10）の字幕。動画に合わせて読み上げる練習に使う。時刻は動画の中の時刻で、字幕は操作の場面に合わせて出る。字幕の元は `tools/video/captions.ts`。ブースで一言足す例は [booth-script.md](booth-script.md) の表にある。

| 時刻 | 字幕（`/` は息継ぎ） |
| --- | --- |
| 0:00 | A static page. / No Devouch server. |
| 0:08 | Recorded on a local chain / with the official ENSv2 contracts |
| 0:15 | Enter my ENS name / and the contributor's GitHub ID, / then review |
| 0:26 | Sign, then publish: / two separate steps |
| 0:30 | The signed JSON goes / to my own ENSv2 resolver |
| 0:38 | Two repositories / check the same vouch |
| 0:44 | Repo A trusts me: / valid · accepted |
| 0:49 | Repo B doesn't: / valid · rejected |
| 0:57 | Same evidence. / Different decisions. |
| 1:02 | Maintainers add two files: / a policy and a workflow |
| 1:08 | On every PR, / the Action checks / the author's vouch |
| 1:16 | A real run on fork PR #2. / Read-only, / no PR code runs, / no secrets. |
| 1:26 | Trust must be / easy to take back |
| 1:30 | Load the vouch, / confirm, / and clear the record |
| 1:37 | Only the issuer / can do this |
| 1:45 | The old file / is still in both repositories |
| 1:50 | Devouch reads / the record's history / on ENS |
| 1:55 | Both now say / revoked |
| 2:03 | Putting the old JSON back / won't revive it |

黙って字幕に任せる場合も、少なくとも「Repo A trusts me」「Repo B doesn't」「Both now say revoked」の3か所は声に出すと、要点が伝わりやすい。

## Timeline

| Time      | Section           | Screen                                   |
| --------- | ----------------- | ---------------------------------------- |
| 0:00–0:10 | Self-introduction | Title slide                              |
| 0:10–0:45 | Problem           | 1 slide                                  |
| 0:45–1:15 | Idea              | 1 slide (diagram)                        |
| 1:15–3:30 | Demo              | Recorded video (see 録画デモ版); live operation is the backup |
| 3:30–4:00 | Close             | Closing slide                            |
| 4:00–7:00 | Q&A               | —                                        |

---

## English

### 0:00 — Self-introduction (10s)

> Hi, I'm [Name]. / I built **Devouch** / with a coding agent.

### 0:10 — Problem (35s)

> AI writes pull requests / very fast.
> Maintainers / **can't read them all.**
> My friend maintains **Hono**. / He has this problem / every day.
>
> Mitchell Hashimoto made **vouch**. / The idea is simple:
> before a review, / ask one question. / "Does **someone I trust** / vouch for this person?"
> Vouch already / shares lists across projects. / Devouch adds / **signatures, expiry, and withdrawal history.**

### 0:45 — Idea (30s)

> Devouch makes a vouch / **portable.**
> I sign a vouch / for a GitHub account.
> I publish it / on **my own ENS name.**
> Any repository / can check it.
> But **each repository decides** / if it trusts me.
>
> **Endorse once. / Let each community decide.**

### 1:15 — Demo (2m15s) · ライブ操作版（予備）

**1. The vouch on ENS (≈25s)**

`[DEMO]` Web app → **Retrieve** tab → `masusanou-dev.eth` → show the endorsement.

> I published this vouch / **before the talk.**
> It lives / on my ENS name, / **on Sepolia.**
> No Devouch server. / No database. / Only my wallet / and ENS.

**2. Two repositories, one vouch (≈35s)**

`[DEMO]` Run commands 2 and 3 from [Live demo commands](#live-demo-commands).

> Two repositories / check the **same** vouch.
> Repo A / trusts me. / **Valid. Accepted.**
> Repo B / does not. / Still valid, / but **rejected.**
> Same evidence. / **Different decisions.**

**3. GitHub Action (≈30s)**

`[DEMO]` Show the PR's Devouch check summary.

> For maintainers, / setup is **two files.**
> The Action checks / the PR author.
> It does **not** run / the PR's code. / It needs **no secrets.**

**4. Take it back (≈30s)**

`[DEMO]` Web app → **Withdraw** → load `vouch.json` → confirm → send from the wallet.

> Trust must be / **easy to take back.**
> I clear the record / from my wallet. / **No Devouch approval needed.**

While waiting for two blocks (about 24 seconds):

> The old file / is still in both repositories.
> But Devouch reads / the **history** on ENS.

**5. Check again (≈15s)**

`[DEMO]` Run commands 2 and 3 again.

> Now both say / **revoked.**
> One transaction. / Each repository sees it / **on its next check.**

`[FALLBACK]` If Sepolia is slow, say "This is a recording of the same steps," and play the matching clip from the demo video.

### 3:30 — Close (30s)

Follow the slide order: "Try it on your phone" → "What I did not build" → the last slide.

`[DEMO]` Slide "Try it on your phone" (QR).

> Scan this. / **Try it yourself.** / It's **live on Sepolia.**

`[DEMO]` Slide "What I did not build".

> No global score. / No token rewards. / No central server. / The reasons / are **in the repo.**

`[DEMO]` Last slide.

> **Endorse once. / Let each community decide.** / Thank you.

"Devouch shows who vouches for you" and "AI can make more code. It can't make more trust." stay on the slides as text; you don't need to say them.
---

## 日本語

英語版と同じ構成。意味の確認用、または日本語で発表する場合に使う。

### 0:00 — 自己紹介（10秒）

> [Name] です。コーディングエージェントと一緒に Devouch を作りました。

### 0:10 — 課題（35秒）

> AI は、とても速く PR を書きます。
> メンテナーは、全部は読み切れません。
> 友人の Hono のメンテナーも、毎日この問題を抱えています。
>
> Mitchell Hashimoto の vouch は、シンプルな考え方です。
> レビューの前に、一つだけ問う。「信頼している誰かが、この人を推薦しているか？」
> vouch には、別のリポジトリのリストを参照する機能もあります。Devouch は、署名・期限・取り消しの履歴を加えます。

### 0:45 — アイデア（30秒）

> Devouch は、推薦を持ち運べるものにします。
> 私が、GitHub アカウントへの推薦に署名します。
> それを、自分の ENS の名前に公開します。
> どのリポジトリでも確認できます。
> でも、私を信頼するかは、各リポジトリが決めます。
>
> 推薦は一度。判断は各コミュニティで。

### 1:15 — デモ（2分15秒）· ライブ操作版（予備）

**1. ENS 上の推薦（約25秒）**

`[DEMO]` Web アプリ → **Retrieve** タブ → `masusanou-dev.eth` → 推薦を表示する。

> この推薦は、発表の前に公開しておきました。
> 私の ENS の名前にあります。Sepolia 上です。
> Devouch のサーバーも、データベースもありません。私のウォレットと ENS だけです。

**2. 二つのリポジトリ、一つの推薦（約35秒）**

`[DEMO]` [本番のコマンド](#live-demo-commands)の 2 と 3 を実行する。

> 二つのリポジトリが、同じ推薦を確認します。
> repo A は私を信頼しています。valid、accepted。
> repo B は信頼していません。valid のまま、rejected。
> 証拠は同じ。判断は別々です。

**3. GitHub Action（約30秒）**

`[DEMO]` PR の Devouch チェックの Summary を見せる。

> メンテナーの導入は、ファイル二つだけです。
> Action は、PR の作者を確認します。
> PR のコードは実行しません。secret も要りません。

**4. 取り消す（約30秒）**

`[DEMO]` Web アプリ → **Withdraw** → `vouch.json` を読み込む → 確認 → ウォレットから送信する。

> 信頼は、簡単に取り消せなければいけません。
> 自分のウォレットから、記録を空にします。Devouch 運営者の承認は要りません。

2ブロック（約24秒）待つ間に:

> 古いファイルは、両方のリポジトリに残ったままです。
> でも Devouch は、ENS の履歴を読みます。

**5. もう一度確認（約15秒）**

`[DEMO]` コマンド 2 と 3 をもう一度実行する。

> どちらも revoked になりました。
> 各リポジトリが次に検証した時に、取り消しが反映されます。

`[FALLBACK]` Sepolia が遅いときは「同じ手順の録画です」と言って、デモ動画の該当場面を流す。

### 3:30 — まとめ（30秒）

スライドの順番どおりに進める：「Try it on your phone」→「What I did not build」→ 最後のスライド。

`[DEMO]` スライド「Try it on your phone」（QR）。

> これを読み取って、試してみてください。Sepolia の本物のデータです。

`[DEMO]` スライド「What I did not build」。

> 全体共通のスコア、トークン報酬、中央のサーバーは作りませんでした。理由は repo にあります。

`[DEMO]` 最後のスライド。

> 推薦は一度。判断は各コミュニティで。ありがとうございました。

「Devouch が示すのは、誰があなたを推薦しているか」と「AI はコードを増やせるが、信頼は増やせない」は、スライドに文字として残してあるので、話さなくてよい。
---

## Live demo commands

本番で端末に打つコマンド。repo のルートで実行する。推薦の原本と公開位置は `.devouch/local/demo/`（Git 管理外）に置き、方針は `examples/demo/` のファイルを使う。

| ファイル | 用意するとき |
| --- | --- |
| `examples/demo/policy-a.json` | Git管理済み。`.devouch/policy.json` と同じ推薦者・resolver を信頼する |
| `examples/demo/policy-b-reject.json` | Git管理済み。別repoの方針例で、`trustedIssuers` は空 |
| `vouch.json` | 審査の前に公開した推薦の原本。公開後に Web の **Download endorsement** で保存するか、下の `fetch` で取り出す |

推薦は失効すると復活しない。同じ ENS 名に新しく公開すると前の推薦は置き換わる。リハーサルで失効させたら、審査の前に新しく公開し直し、`vouch.json` とデモ用 PR のファイルも差し替える。
既定の RPC は Tenderly（`https://sepolia.gateway.tenderly.co`）。取得できないときは各コマンドに `--rpc-url https://rpc.sepolia.ethpandaops.io` を付ける（[実機デモの手順](../demo-runbook.md)）。

```sh
mkdir -p .devouch/local/demo

# 審査の前：公開した原本を置く
mv ~/Downloads/github-287365775.json .devouch/local/demo/vouch.json

# 2. repo A：valid / accepted
./exe/devouch verify --credential .devouch/local/demo/vouch.json --policy examples/demo/policy-a.json --subject github:287365775

# 3. repo B：valid / rejected（失効後は 2 と 3 とも revoked / not_evaluated）
./exe/devouch verify --credential .devouch/local/demo/vouch.json --policy examples/demo/policy-b-reject.json --subject github:287365775
```

ダウンロードがうまくいかないときは、チェーンから原本を取り出す。Web の **Save publication position** で保存した `publication.json`（公開したブロックとトランザクション）を使う。

```sh
# 代替：チェーン上の公開位置から原本を取り出す（取引は送らない）
mv ~/Downloads/publication.json .devouch/local/demo/publication.json
./exe/devouch fetch --name masusanou-dev.eth --publication .devouch/local/demo/publication.json --output .devouch/local/demo/vouch.json
```

`--output` の先に同名のファイルがあると失敗するので、古い `vouch.json` は先に退避する。
`publication.json` がなくても `--publication` を外せば現在の公開値を取り出せるが、失効後は取り出せない。

Web は `github-<数値ID>.json` という名前で保存する。同名のファイルがあるとブラウザが `(1)` を付けるので、`mv` の元を合わせる。原本の JSON は整形し直さない。
失効の直後は2ブロック（約24秒）待ってから検証する。台本の「待つ間に」のセリフでつなぐ。
これは待ち時間の目安。snapshotが取引のblock以降になったことを結果で確認する。過去のAction結果は自動で更新されない。

比較の根拠は [vouchの調査記録](../hackathon-research.md#vouch-が扱っている信頼)。他repoのリストを参照できることを前提に、署名・期限・失効履歴の違いを説明する。

## Q&A Preparation / Q&A 準備

答えは短く、2〜3文で。分からなければ、無理に英語で長く話さない。

### 困ったときの一言

| 場面 | 英語 |
| --- | --- |
| 聞き取れない | "Sorry, could you say that again, / more slowly?" |
| 考える時間がほしい | "Good question. / Let me think." |
| 画面で見せたい | "Let me show you / on the screen." |
| 答えられない | "I'm not sure. / I'll check / and follow up." |
| 質問を確かめたい | "Do you mean / … ?" |

### What inspired your project? / 着想のきっかけは？

- **EN:** My friend maintains Hono. / He gets too many AI pull requests. / Vouch had a good idea. / I wanted to make that trust **portable.**
- **JA:** Hono のメンテナーの友人が、AI の PR に困っていました。vouch の考え方は良い。その信頼を持ち運べるようにしたかったのです。

### What tools did you use, and why? / 何を使い、なぜ？

- **EN:** ENSv2 on Sepolia. / The person who vouches / **owns the record.** / I use viem for signatures, / a Ruby CLI, / and a GitHub Action. / I used AI coding agents. / It's written in the README.
- **JA:** Sepolia の ENSv2 です。推薦する人が記録を持つからです。署名に viem、Ruby の CLI、GitHub Action を使いました。AI コーディングエージェントを使い、README に書いてあります。

### What challenges did you solve? / どんな課題を解決した？

- **EN:** Taking trust back. / A copied file can't delete itself. / So Devouch reads the **history** on ENS. / A removed vouch / never comes back.
- **JA:** 信頼の取り消しです。コピーされたファイルは自分では消えません。だから ENS の履歴を読みます。一度消した推薦は、戻りません。

### Why a blockchain? Why not a JSON file on GitHub? / なぜブロックチェーン？GitHub の JSON では駄目？

- **EN:** GitHub can copy the file. / But it can't tell you / if I **still** trust this person. / ENS is one shared place / to check that.
- **JA:** GitHub はファイルをコピーできます。でも、私が今も信頼しているかは分かりません。ENS は、それを確かめられる共通の場所です。

### Does this prove the contributor is human? / 人間であることを証明する？

- **EN:** No. / That's a different question. / Proof of personhood, / like World ID, / answers **"is this a human?"** / Devouch answers / **"who vouches for you?"**
- **JA:** しません。別の問いだからです。World ID のような人間性の証明は「人間か？」に答えます。Devouch が答えるのは「誰があなたを推薦しているか？」です。

### What about AI agents opening PRs? / AI エージェントの PR は？

- **EN:** An agent with its own GitHub account / can get a vouch, / **just like a person.** / An agent can also have / its own **ENS subname,** / with only the permissions / I give it.
- **JA:** 自分の GitHub アカウントを持つエージェントも、人と同じように推薦を受けられます。エージェントは自分の ENS のサブネームも持てて、私が渡した権限だけを使えます。

### Costs and privacy? / コストとプライバシーは？

- **EN:** Only the person who vouches / pays gas. / Maintainers only **read.** / A vouch is public, / and it stays in the history.
- **JA:** ガスを払うのは推薦する人だけです。メンテナーは読むだけです。推薦は公開され、履歴に残ります。

### What's next? / 今後は？

- **EN:** Each vouch / already has / **its own subname,** / and agents / have their own names. / Taking back one vouch / works on Sepolia. / Next: / try it / with a **real** open-source project.
- **JA:** 推薦ごとのサブネームと、エージェントの名前空間はもう動いています。1件だけの取り消しも、Sepolia で動いています。次は、実際の OSS で試すことです。
