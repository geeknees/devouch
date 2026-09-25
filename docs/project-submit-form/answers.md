# ETHGlobal Tokyo 2026 提出フォーム記入案

フォームのスクリーンショット（このフォルダの PNG）に沿って、各欄に貼れる文面を用意した。
内容は [README](../../README.md)、[提出文の草案](../submission.md)、実装コードに基づく。
**`【要確認】` の欄は、事実が未確定または本人しか知らない情報。** 公開 URL・実 Sepolia 取引・fork PR の証拠が揃うまで、それらを達成済みとは書かない。

## 1. Project details

| 欄 | 記入案 |
| --- | --- |
| Project name | `devouch`（入力済み） |
| Category | Developer Tool（入力済み） |
| Emoji | 🤝（現在は 💯。推薦＝握手の意味で 🤝 を推奨） |
| Demonstration link | 【要確認】静的 Web の live URL。未公開なら公開 repo の URL を暫定で入れる |
| GitHub Repositories | `geeknees/devouch`【要確認】現在 private。ルール上「公開して誰でも検証できること」が必須なので、提出前に公開が必要 |

### Short description（最大100文字）

```text
Portable OSS contributor endorsements: sign once, publish to your own ENSv2 name, revoke anytime.
```

（97文字）

### Description（280文字以上）

```text
AI makes it easy to open pull requests, but a maintainer's time and trust don't scale. Mitchell Hashimoto's vouch showed a good answer: before reviewing, check whether someone you trust has vouched for the contributor. Today, though, that trust lives in one repository's list, and every new project starts from zero.

Devouch makes a vouch portable and verifiable. A recommender signs an EIP-712 endorsement of a contributor's GitHub numeric account ID, with a purpose and an expiry, and publishes the complete signed JSON to a text record on their own ENSv2 Permissioned Resolver on Sepolia, directly from their wallet. The contributor carries the same JSON into any repository's .devouch/ folder.

Each repository verifies the signature, the actual PR author, the ENS publication history, and its own policy. The same endorsement can be accepted by one repository and rejected by another: the evidence is shared, the judgment stays local. When the recommender clears the record, every repository sees "revoked" on its next check, and restoring an old JSON cannot bring it back.

There is no Devouch API, database, shared signing key, or custom registry. Endorsements do not prove humanity, code quality, or merge approval; they are a reference that helps a maintainer decide to start a review.
```

### How it's made（280文字以上）

```text
Devouch has three parts that share one verification core.

1. A static wallet workspace (TypeScript + viem, bundled with Bun, no framework). It creates a dedicated resolver through the official ENSv2 factory, connects it to the issuer's name, signs the EIP-712 endorsement, publishes it as an ENS text record, optionally grants a helper wallet permission for only the endorsement key, and withdraws it. Signing and publishing are separate, explicitly confirmed steps, with transaction recovery after reloads. It can run from any static host or locally.

2. A Ruby CLI (request / fetch / verify / revoke) that fetches the endorsement from ENS through any Sepolia RPC, verifies it, and applies a repository policy (trusted issuers, allowed scopes, allowed resolver implementations). Exit codes separate "valid but rejected by this repo" from "invalid, expired or revoked" and "unavailable".

3. A read-only composite GitHub Action. It reads the policy from the PR's base SHA and the endorsement from its head SHA through the GitHub API, matches it against the PR author's numeric ID, and writes a summary. It never checks out or executes PR code and needs no secrets.

The notable part is revocation. A copied JSON file can't revoke itself, so verification reads the resolver's event history at a snapshot two blocks behind head, including resolver, link and implementation changes. A record that was cleared, or temporarily changed and then restored, never counts as valid again.

We use pinned official ENSv2 Sepolia artifacts and wrote no new contracts. Integration tests run the real official bytecode on a disposable local EVM (Hardhat), plus Playwright browser tests for consent, cancellation, recovery and withdrawal, and Minitest for the CLI and Action.
```

## 2. Images

[`docs/submission-assets/`](../submission-assets/README.md) に一本化した。
ロゴとカバーの元データは `assets/devouch-*.svg`、再生成は `node scripts/capture-assets.ts`。

| 欄 | ファイル | 備考 |
| --- | --- | --- |
| Logo（512×512） | `submission-assets/logo.png` | 一つの推薦（上の丸）が二つの repo（下の輪）へ分かれるマーク |
| Cover image（16:9） | `submission-assets/cover.png` | 1280×720。キャッチコピーと推薦の流れの図 |
| Screenshots（3枚以上） | `submission-assets/workspace.png` | トップと発行画面 |
| | `submission-assets/ens-setup.png` | ENS セットアップ（専用 resolver 作成・接続） |
| | `submission-assets/withdraw.png` | 失効 |

画面はウォレット未接続で撮った UI の紹介。実機デモ後に、実 tx の Summary や `revoked` を示す CLI 出力のスクリーンショットへ差し替えるとより強い。

## 3. Tech stack

| 質問 | 選択 |
| --- | --- |
| Ethereum developer tools | viem, Hardhat |
| Blockchain networks | Ethereum Sepolia |
| Programming languages | TypeScript, Ruby |
| Web frameworks | なし（素の TypeScript + HTML/CSS）。選択肢に "None" がなければ空欄可否を確認 |
| Databases | なし |
| Design tools | 【要確認】使っていなければ "None" |
| Other technologies | ENSv2 Permissioned Resolver, EIP-712, GitHub Actions, Bun, Node.js, Playwright, Minitest |

### AI tools の利用

【要確認】実際に使ったツール名と範囲に合わせて直す。ルール上、使った spec・プロンプト・計画資料も repo に含める必要がある。

```text
Devouch was built by a solo developer working with an AI coding agent [TOOL NAME — confirm]. Before the event, the developer wrote planning and design documents (docs/hackathon-*.md, cli-interface.md, adoption-guide.md, agent-operator-guide.md) together with AI assistants; these are included in the repository as the planning artifacts that directed the agent. During the hackathon, the coding agent implemented most of the code under src/, web/, lib/, scripts/ and test/ from those documents, with the developer choosing the scope, reviewing the changes, and making the product decisions (decentralization over prize fit, no World integration without an independent verification path, one active endorsement per record). The AI also drafted the README, submission text, talk script and the logo/cover images. Official ENSv2 contract artifacts are third-party code, vendored unmodified under vendor/ens-v2.
```

## 4. Select prizes

| 欄 | 記入案 |
| --- | --- |
| Track | Building from Scratch（選択済み） |
| Submission type | Top 10 Finalist & Partner Prizes（決勝用のトークスクリプトを用意済み。ライブ審査は 2026-09-27 14:30 JST） |
| Partner prizes | **ENS** のみ |
| World | 選ばない。World 認証は未実装で、README でも主張していない |
| Other partners' technologies | なし |

### ENS への説明（パートナー向け）

```text
ENSv2 is the core of Devouch, not a display name. Each recommender publishes the complete signed endorsement JSON to a text record on their own ENSv2 Permissioned Resolver, created through the official factory, so the endorsement can be retrieved from ENS without any Devouch service. Publication and withdrawal are direct wallet transactions by the issuer. The optional helper wallet is granted permission for only the endorsement text key, using ENSv2's fine-grained access control, while the issuer keeps direct withdrawal. Verification reads the resolver's history (text, resolver link and implementation changes), so a withdrawn or temporarily replaced record can never silently restore trust. We use pinned official Sepolia deployments and wrote no custom registry.

Feedback: [記入 — 実際に詰まった点。例: resolver 作成から名前の接続までの手順、履歴取得に必要な RPC の要件、Sepolia の ENSv2 app のリセット]
```

## 5. Video

【要確認】収録は本人が行う。要件は2〜4分・720p以上・BGMなしで話す、早送り禁止、スマホ撮影禁止、合成音声禁止。
構成は [トークスクリプト](../presentation/script.md) の4分デモ部分をそのまま使える。

## 6. Future（画面未確認のため想定の文面）

```text
Next: support several active endorsements per recommender (today one resolver record holds one endorsement), copy-paste policy setup so maintainers don't handle resolver addresses by hand, a published Action release pinned by commit SHA, and a trial on a real open-source project. We will add proof of personhood such as World ID only if it can be verified without making a central service mandatory.
```

## 提出前チェックリスト

- [ ] repo を公開する（ルール上必須）
- [ ] live URL を用意して Demonstration link に入れる
- [ ] Sepolia で発行 → 検証 → 失効の実 tx を取り、tx hash を README / 提出文に追記する
- [ ] fork PR と Action run の URL を取得する
- [ ] AI 利用欄のツール名を確定する
- [ ] ENS へのフィードバックを書く
- [ ] 動画を収録する（任意だが推奨）
- [ ] 小さく頻繁なコミット履歴が見えるか確認する（現在の実装ファイルは未コミット）
