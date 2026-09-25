# 提出文とピッチの草案

現状: ローカル実装・検証済み。公開URLと実Sepolia・fork PRの証拠は未取得。
下記は提出用の草案であり、提出済み・受賞要件充足とは扱わない。

## フォーム入力

提供された提出フォーム画像を確認した。実フォームへの保存・送信は行っていない。

| Field | Draft |
|---|---|
| Project name | devouch |
| Category | Developer Tool |
| Emoji | 🤝 |
| Demo URL | 公開後のHTTPS URLを入力。未公開 |
| Short description | Portable, revocable contributor endorsements on ENSv2. Each repository keeps its own policy. |
| GitHub repository | https://github.com/geeknees/devouch （デモ時に公開する方針） |
| Images | [ロゴ・カバー・3枚の画面草案](submission-assets/README.md) |
| Ethereum tools | viem, ENSv2, Hardhat |
| Network | Ethereum Sepolia |
| Languages | Ruby, TypeScript, JavaScript, HTML, CSS |
| Web framework / Database | None / None |
| Other tools | Bun, Node.js, GitHub Actions, Playwright, Minitest |
| Prizes | ENSv2を主候補。Worldは未統合のため適合を主張しない |
| Track / judging choice | 事前設計資料を開示して適格性確認。Top 10 + Partner / Partner only は未指定 |

Short descriptionは100文字以内。DescriptionとHow it's madeはそれぞれ280文字以上の下記原稿を使う。
提供フォームでは動画は任意だが推奨、2〜4分、720p以上、音声あり・音楽なし。
5分の操作リハーサルをそのまま提出動画にせず、3分30秒を目安に別途収録する。倍速化はしない。
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

## ENSv2 usage

- Complete signed endorsements are ENS text records, retrievable independently of Devouch hosting.
- Official factory-created Permissioned Resolvers give issuers direct ownership of publication and withdrawal.
- The optional helper grant is limited to the endorsement text key; the issuer retains direct withdrawal.
- Resolver/link/upgrade histories are checked alongside current values so temporary changes cannot silently restore trust.
- The same endorsement works with different repository policies.

The implementation uses pinned official Sepolia artifacts and unmodified contract code.
It introduces no custom endorsement registry.
Current tests run real official bytecode on a disposable local EVM; real Sepolia write evidence must be added before claiming a public demo.

## How it's made

The command-line interface is Ruby and uses the standard library for bounded file handling, policy evaluation, and read-only GitHub API access.
A bundled TypeScript helper uses viem for EIP-712 recovery, ENS normalization, contract reads, and event decoding.
The static HTML/CSS workspace connects to an injected wallet and sends transactions directly to the official ENSv2 factory, registry, and dedicated resolver.
The complete signed JSON is stored in devouch.vouch, so another verifier can retrieve it without our website.

Verification checks a pinned chain snapshot, the resolver's deployment origin, exact publication bytes, subsequent text updates, and transient binding or upgrade changes.
A composite GitHub Action uses the PR author's numeric ID, the base commit's policy, and the head commit's endorsement without checking out PR code.
Tests combine Minitest, Bun, Playwright, and a disposable Hardhat EVM running pinned official ENS bytecode.
No new smart contract, backend service, database, or shared signing key was added.

## AI tool disclosure

OpenAI Codex assisted with reading the existing planning documents, researching official protocol interfaces, implementing the CLI, verifier, wallet UI and Action, writing tests, and drafting documentation.
The human owner set the product direction, corrected the demo destination, and controls the wallet and publication decisions.
The planned contributor demonstration uses a separate agent account, masusanou.
Generated work is checked with local tests and browser runs; unperformed public-chain and GitHub checks are listed explicitly.

## 90-second pitch

Open-source maintainers need context about unfamiliar contributors, including agents.
That context should travel with a contributor, while each community keeps its own judgment.

With Devouch, someone who knows a contributor signs a recommendation and publishes it to their own ENS name.
The contributor carries the same small JSON into different repositories.
Each repository checks the evidence and applies its own policy.
One may accept the issuer; another may decline. The signed recommendation stays the same.

When the issuer withdraws the record, every repository can discover the change on its next verification.
An old file or a restored ENS value does not bring the recommendation back.
Our website can disappear: the issuer can run the static workspace locally, choose another RPC, and operate with their own wallet.

ENSv2 supplies the shared record and fine-grained update permissions.
GitHub supplies the PR account identity. Humans still review the contribution.
Devouch carries a reference; it does not turn that reference into automatic approval.

## 提出前に埋めるもの

| 項目 | 状態 |
|---|---|
| 公開コード / license / 配布SHA | MITあり、Actionのローカル固定SHAは [公開手順](release-runbook.md)。公開取得は未確認 |
| ライブデモURL | 手動Pages workflowを準備、未公開 |
| 動画URL | 実機・本人音声の提出動画は未完成。別作業でローカルEVMの無音素材を作る録画ツールが追加された |
| ENSv2の実txと失効後のreadback | 未取得 |
| 人間・agent名義の実PRとAction run | 未取得 |
| 別RPC・別ホストからの実操作 | 読み取りは確認、実取引は未確認 |
| World Agents統合・失敗経路・feedback | 未実装、条件付き候補 |
| イベント期間・Building from Scratch適格性 | 運営未確認 |

作業開始時は設計文書12件と.gitignoreのみ。過去のDevouchアプリはコピーせず新規実装した。
事前の設計資料とサードパーティの公式ENSコントラクト・ライブラリを使ったことを開示する。
募集条件は提出時に公式ページで再確認する。
