# ETHGlobal Tokyo 2026 提出フォームの補足

このフォルダの PNG は、提出フォームの画面の原本。
**貼り付ける文章の正本は [提出文の草案](../submission.md)。** ここには文章を置かず、フォームの画面ごとの操作だけを書く。

## 画面と正本の対応

| フォームの画面 | 欄 | 使うもの |
| --- | --- | --- |
| Project details | Project name / Category / Emoji | `devouch` / Developer Tool / 🤝 |
| | Demonstration link | GitHub Pages の URL（公開後）。[公開手順](../release-runbook.md) |
| | Short description | [submission.md](../submission.md) の「フォーム入力」表（100文字以内） |
| | Description | 「Project description」（280文字以上） |
| | How it's made | 「How it's made」（280文字以上） |
| | GitHub Repositories | `geeknees/devouch`（提出前に public にする） |
| Images | Logo / Cover / Screenshots | [submission-assets](../submission-assets/README.md) の `logo.png`、`cover.png`、画面3枚 |
| Tech stack | 各選択肢 | 「フォーム入力」表の Ethereum tools・Network・Languages・Other tools |
| | AI tools | 「AI tool disclosure」 |
| Select prizes | Track | Building from Scratch |
| | Submission type | Top 10 Finalist & Partner Prizes（想定。最終判断は提出者） |
| | Partner prizes | **ENS のみ**。World は未統合なので選ばない |
| | ENS への説明・フィードバック | 「ENS partner prize: why it applies」。フィードバック欄は提出者が記入 |
| Video | Demo video | `tools/video/out/devouch-demo-voiced.mp4`（完成後）。2〜4分・720p以上・本人の声・音楽なし・早送りなし |
| Future | 今後 | 「Future」 |

## 提出前チェックリスト

- [ ] repo を public にする（規約で必須）
- [ ] GitHub Pages を公開し、Demonstration link に入れる
- [ ] 実 fork PR の Action run を取り、URL を submission.md に記録する
- [ ] 失効を Sepolia で行い、readback を submission.md の「Sepolia evidence」に追記する
- [ ] ENS へのフィードバックを書く
- [ ] 新デザイン適用後に画面を撮り直す（`node scripts/capture-assets.ts`）
- [ ] 動画を完成させる（Action の枠を実映像に差し替え、4分以内を確認）
