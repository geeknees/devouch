# 提出画像の草案

- `logo.png`: 512 × 512。一つの推薦が二つの repo へ分かれるマーク。元データは [SVG](../../assets/devouch-logo.svg)。
- `cover.png`: 1280 × 720、16:9。推薦の流れ。元データは [SVG](../../assets/devouch-cover.svg)。
- `workspace.png`、`ens-setup.png`、`withdraw.png`: 実際の静的アプリをChromeで撮影した操作画面。

画面画像はウォレット未接続で撮影したUIの紹介。Sepoliaで取引が成功した証拠ではない。
実機の公開・失効・Action runの画像は、その操作を確認した後に追加する。
提出フォームの原本スクリーンショットは別の `project-submit-form/` に保全している。

再生成: `bun run build` の後に `node scripts/capture-assets.ts`。
Chrome / PlaywrightのChromiumとローカルloopbackでの待受が必要。
