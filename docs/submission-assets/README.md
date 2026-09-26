# 提出画像の草案

- `logo.png`: 512 × 512。縦線の先が二つに分かれた小文字 d。右の枝だけマゼンタ。元データは [SVG](../../assets/devouch-logo.svg)。
- `cover.png`: 1280 × 720、16:9。推薦の流れ。元データは [SVG](../../assets/devouch-cover.svg)。
- `verify.png`、`verify-mobile.png`: 公開中の検証ページ（https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify）を撮影。Sepolia の実際の推薦を読み、Vouched by masusanou-dev.eth、repo A は accepted、repo B は rejected と表示された状態（2026-09-26、block 11783017）。
- `workspace.png`、`ens-setup.png`、`withdraw.png`: 実際の静的アプリをChromeで撮影した操作画面。

workspace・ENS setup・Withdraw の画面はウォレット未接続で撮影したUIの紹介で、Sepoliaで取引が成功した証拠ではない。検証ページの2枚は、公開中の推薦を読んだ実際の結果。
実機の公開・失効・Action runの画像は、その操作を確認した後に追加する。
提出フォームの原本スクリーンショットは別の `project-submit-form/` に保全している。

再生成: `bun run build` の後に `node scripts/capture-assets.ts`（検証ページの2枚は含まない。公開ページから別途撮影した）。
Chrome / PlaywrightのChromiumとローカルloopbackでの待受が必要。
