# 提出文とピッチの草案

現状: ローカル実装・GitHub CI、本人walletのSepolia公開・CLI方針比較、repoとPagesの公開、masusanouの実fork PRでvalid / acceptedを検証済み。実Sepolia失効とCLIでの確認は未実施。失効のPR検証と人間名義の実PR検証は2026-09-26のユーザー指定で対象外。
提出文の正本はこのファイル。提出フォームの画面の原本は [project-submit-form/](project-submit-form/) にある。
下記は提出用の草案であり、提出済み・受賞要件充足とは扱わない。

## フォーム入力

[提出フォームの画面](project-submit-form/)を確認した。実フォームへの保存・送信は行っていない。下の表の順に、フォームの画面（Project details → Images → Tech stack → Select prizes → Video → Future）を埋める。

| Field | Draft |
|---|---|
| Project name | devouch |
| Category | Developer Tool |
| Emoji | 🤝 |
| Demo URL | https://geeknees.github.io/devouch/ |
| Short description | Portable, revocable contributor endorsements on ENSv2. Each repository keeps its own policy. |
| GitHub repository | https://github.com/geeknees/devouch （公開済み） |
| Images | [ロゴ・カバー・3枚の画面草案](submission-assets/README.md) |
| Ethereum tools | viem, ENSv2, Hardhat |
| Network | Ethereum Sepolia |
| Languages | Ruby, TypeScript, JavaScript, HTML, CSS |
| Web framework / Database | None / None |
| Other tools | Bun, Node.js, GitHub Actions, Playwright, Minitest |
| Prizes | **ENS のみ**選ぶ。ENS の欄は「ENS prize form fields」を使う。World は未統合なので選ばない |
| AI tools | 「AI tool disclosure」を貼る |
| Video | 別エージェントの作業で完成済み（ユーザー確認）。提出URLは未記録 |
| Future | 「Future」を貼る |
| Track / judging choice | Building from Scratch。事前設計資料を開示。Submission type は Top 10 Finalist & Partner Prizes を想定（決勝用の [台本](presentation/script.md) を用意済み）。最終判断は提出者 |

Short descriptionは100文字以内。DescriptionとHow it's madeはそれぞれ280文字以上の下記原稿を使う。
提供フォームでは動画は任意だが推奨、2〜4分、720p以上、音声あり・音楽なし。
提出動画は別エージェントの作業で完成済みとユーザー確認（2026-09-26）。本作業での再収録は不要。
公式の対面審査は4分デモ＋3分Q&A。[本番台本](presentation/script.md)と [提供されたルール](info/rules.md)を参照する。

## Project description

Devouch lets an issuer recommend an open-source contributor once, then lets independent repositories decide whether to accept that recommendation.
The issuer signs a GitHub numeric account ID, purpose, expiry, and publishing location using EIP-712.
They publish the complete signed JSON to their own ENSv2 Permissioned Resolver on Sepolia.
Contributors carry the original JSON in their pull requests.

A Ruby CLI and a read-only GitHub Action verify the signature, the actual PR author's account, the publication history, and the receiving repository's policy.
Withdrawing the ENS record invalidates the endorsement on the next check.
Restoring an old JSON cannot resurrect it.
The static wallet workspace handles setup, publication, key permissions, withdrawal, and transaction recovery.

No Devouch-operated API, database, signing service, publisher key, or unique storage service is required.
The project still depends on Ethereum/ENS, name maintenance, a wallet, GitHub for PR identity, and a reliable historical RPC provider.
Recommendations do not prove humanity, code quality, delegation, or merge approval.

## How it's made

The command-line interface is Ruby and uses the standard library for bounded file handling, policy evaluation, and read-only GitHub API access.
A bundled TypeScript helper uses viem for EIP-712 recovery, ENS normalization, contract reads, and event decoding.
The static HTML/CSS workspace connects to an injected wallet and sends transactions directly to the official ENSv2 factory, registry, and dedicated resolver.
The complete signed JSON is stored in devouch.vouch, so another verifier can retrieve it without the Devouch website.

Verification checks a pinned chain snapshot, the resolver's deployment origin, exact publication bytes, subsequent text updates, and transient binding or upgrade changes.
A composite GitHub Action uses the PR author's numeric ID, the base commit's policy, and the head commit's endorsement without checking out PR code.
Tests combine Minitest, Bun, Playwright, and a disposable Hardhat EVM running pinned official ENS bytecode.
No new smart contract, backend service, database, or shared signing key was added.

## AI tool disclosure

Two AI coding agents were used. The human owner set the product direction, chose the scope and designs, controls the wallet, and made every publication decision.

- **OpenAI Codex** assisted with reading the existing planning documents, researching official protocol interfaces, implementing the CLI, verifier, wallet UI and Action (`src/`, `lib/`, `web/`, `scripts/`, `action.yml`), writing tests (`test/`), and drafting documentation.
- **Claude Code (Anthropic)** wrote the presentation materials and demo tooling: the talk and video scripts (`docs/presentation/`), the zoom animation (`docs/presentation/devouch-zoom.html`), the demo-video recorder, narration aligner and mixer (`tools/video/`), the logo and cover (`assets/`), the design handoff (`docs/design-handoff.md`), and submission-form drafts (`docs/project-submit-form/`).
- **whisper.cpp** (speech-to-text, run locally) is used only to find when each script phrase is spoken, so the screen follows the presenter's own recorded voice. No text-to-speech or AI voice is used.

The planning documents written before the event are included in `docs/` as the planning artifacts that directed the agents.
The contributor demonstration uses the separate agent account masusanou; its fork PR has a verified endorsement result.
Generated work is checked with local tests and browser runs; unperformed public-chain and GitHub checks are listed explicitly.

## ENS usage

ENS をどう使っているかの詳しい控え。フォームの ENS 欄には下の「ENS prize form fields」の2文を貼り、ここはブースや Q&A、repo を読みに来た審査員のために使う。

ENSv2 is where the endorsement lives, not a display name.

- Each recommender publishes the complete signed endorsement JSON to the `devouch.vouch` text record on their own ENSv2 Permissioned Resolver, created through the official factory. Anyone can retrieve it from ENS without a Devouch service.
- Publishing and withdrawing are direct wallet transactions by the issuer.
- An optional helper wallet can be granted permission for only the endorsement text key, while the issuer keeps direct withdrawal.
- Verification reads the resolver's history (text, link and implementation changes) alongside the current value, so a withdrawn or temporarily replaced record never silently restores trust.
- The same endorsement works with different repository policies: the evidence is shared, and each repository decides.

I use pinned official Sepolia artifacts and unmodified contract code, and add no custom endorsement registry.
Tests run the real official bytecode on a disposable local EVM. One publication on Sepolia has been read back and verified against two policies (see "Sepolia evidence" below); withdrawal on Sepolia is still to be recorded.

### ENS prize form fields

ENS を選ぶと出てくる欄。画面は [project-submit-form/](project-submit-form/) の 2026-09-26 03:25 のスクリーンショット。

**How are you using this Protocol / API?**

> Each recommender publishes the complete signed endorsement JSON as the `devouch.vouch` text record on their own ENSv2 Permissioned Resolver, and withdraws it by clearing that record. Devouch's CLI and GitHub Action read the record and its resolver history straight from ENS on Sepolia, so any repository can verify an endorsement without a Devouch server.

**Link to the line of code where the tech is used**

https://github.com/geeknees/devouch/blob/3214991e616e118d921ea9575d06d5e121b584f4/web/wallet.ts#L52-L53

（推薦の JSON を ENSv2 の `setText` で公開する行。読み取り側は [src/chain.ts#L97-L100](https://github.com/geeknees/devouch/blob/3214991e616e118d921ea9575d06d5e121b584f4/src/chain.ts#L97-L100)）

**How easy is it to use the API / Protocol? (1–10)**

提出者が選ぶ。

**Additional feedback for the Sponsor**（下書き。開発中の記録 [gotchas.md](../gotchas.md) から。提出者が確認・修正する）

> - The ENSv2 text setter takes a DNS wire-format name (`setText(bytes name, …)`), while ENSv1 resolvers take a node hash. A short migration note with an example call would have saved time.
> - A current text value alone cannot tell whether a record was cleared and restored. We had to read resolver history, link and implementation changes. A documented recipe for "was this record ever changed since block N" would help apps that treat records as revocable claims.
> - Public Sepolia RPCs differ in how much historical state they keep; one provider stopped returning the state we needed. Guidance on RPC requirements for ENSv2 history reads would help.
> - A setter grant on a Permissioned Resolver applies to that key for every name on the resolver, not to one name. This is reasonable, but easy to miss; we now require a dedicated resolver per issuer.
> - Registry token IDs carry a 32-bit generation in the low bits, so matching events to a label needs care. An example in the docs would help.
> - The Sepolia ENSv2 app notes that its state may be reset during development, which is a risk for hackathon demos; a note on expected stability would help planning.

## Future

Next: support several active endorsements per recommender (today one resolver record holds one endorsement), copy-paste policy setup so maintainers don't handle resolver addresses by hand, a published Action release pinned by commit SHA, and a trial on a real open-source project. I will add proof of personhood such as World ID only if it can be verified without making a central service mandatory.

## Sepolia evidence

| Item | Value |
|---|---|
| ENS name | `masusanou-dev.eth` |
| Issuer | `0x894108DC5640e36c478523228addA22b58Eeb79c` |
| Resolver | `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160` |
| Subject / scope / expiry | `github:287365775` / `oss-contribution` / 2026-10-02 16:45 UTC |
| Publication tx | `0xfa33b82bd93b8296b6866107328acf4b3ace32a876c7763c4cbd10ddb9141c96` (block 11780510) |
| Read back | `devouch fetch --publication` returned the original JSON (2026-09-25 17:15 UTC) |
| Policy A | `valid / accepted` at block 11780652 |
| Policy B (issuer not trusted) | `valid / rejected`, reason `issuer_not_trusted`, at block 11780653 |
| Agent fork PR | [masusanou's PR #2](https://github.com/geeknees/devouch/pull/2), subject `github:287365775` |
| GitHub Action | [Devouch run](https://github.com/geeknees/devouch/actions/runs/36172488074): `valid / accepted` at block `11780996`; [normal CI](https://github.com/geeknees/devouch/actions/runs/36172488028) also passed |
| Withdrawal | Not yet performed; planned during the live demo |

RPC: `https://sepolia.gateway.tenderly.co` (the CLI default).

An earlier comparison used the same original and block `11780543` across Tenderly and ethPandaOps: two policies accepted it, while the policy declining the issuer rejected it. The [verification record](demo-evidence.md) includes the original digest, policy digests, block hash, and public position for retrieving it again.

## 90-second pitch

Open-source maintainers need context about unfamiliar contributors, including agents.
That context should travel with a contributor, while each community keeps its own judgment.

With Devouch, someone who knows a contributor signs a recommendation and publishes it to their own ENS name.
The contributor carries the same small JSON into different repositories.
Each repository checks the evidence and applies its own policy.
One may accept the issuer; another may decline. The signed recommendation stays the same.

When the issuer withdraws the record, every repository can discover the change on its next verification.
An old file or a restored ENS value does not bring the recommendation back.
The Devouch website can disappear: the issuer can run the static workspace locally, choose another RPC, and operate with their own wallet.

ENSv2 supplies the shared record and fine-grained update permissions.
GitHub supplies the PR account identity. Humans still review the contribution.
Devouch carries a reference; it does not turn that reference into automatic approval.

## 提出前に埋めるもの

| 項目 | 状態 |
|---|---|
| 公開コード / license / 配布SHA | MITあり、固定Actionの匿名取得を確認済み。[公開の検証記録](release-evidence.md) |
| ライブデモURL | 公開済み：https://geeknees.github.io/devouch/ （2026-09-26 03:03 JST に HTTP 200 を確認）。配信5ファイルの一致と公開画面からのENS取得も確認 |
| 動画URL | 別エージェントの作業で完成したとユーザー確認（2026-09-26）。提出URLは未記録 |
| ENSv2の実txと失効後のreadback | 公開txと2方針の検証は取得（上記）。失効後は未取得 |
| agent名義の実PRとAction run | masusanouのPR #2とvalid / acceptedのActionは確認済み。人間名義の実PRと失効のPR検証は対象外 |
| 別RPC・別ホストからの実操作 | ローカルUI経由の本人公開、2社RPCの検証を確認。別ホストの実操作は未実施 |
| ENS の欄（使い方・コード行・評価・フィードバック） | 下書き済み（「ENS prize form fields」）。評価の1〜10とフィードバックの最終確認は提出者 |
| 新デザインの画面画像 | 適用・公開済み。`node scripts/capture-assets.ts` で画面3枚を更新。同梱フォントでの撮影と公開URLの確認は [デザイン検証記録](design-verification.md) |
| repo の公開 | public。ユーザー承認後に公開（2026-09-26 03:03 JST に確認） |
| World Agents統合・失敗経路・feedback | 未実装、条件付き候補 |
| イベント期間・Building from Scratch適格性 | 運営未確認 |

作業開始時は設計文書12件と.gitignoreのみ。過去のDevouchアプリはコピーせず新規実装した。
事前の設計資料とサードパーティの公式ENSコントラクト・ライブラリを使ったことを開示する。
募集条件は提出時に公式ページで再確認する。
