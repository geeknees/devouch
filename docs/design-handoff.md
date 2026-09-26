# デザイン適用の引き継ぎ

実装とローカル検証の記録は [design-verification.md](design-verification.md) を参照。

作成：2026-09-26。対象：静的ワークスペース `web/`。
[ズームアニメーション](presentation/devouch-zoom.html) のデザインを、アプリと提出素材に揃えるための資料。
初回はアプリの振る舞い・ID・文言の意味を保ち、見た目を置き換えた。
同日の追加依頼でダーク／ライトの切り替えを実装した。署名・公開・失効の流れは共通とする。

## 担当の分け方

| 対象 | 担当 | 状態 |
| --- | --- | --- |
| `web/` と `dist/web/` の再ビルド | 開発エージェント | 初回適用済み。ダーク／ライトの切替を追加し、ローカル検証済み |
| `assets/devouch-logo.svg` | デザイン側 | 「枝分かれする d」に変更済み |
| `assets/devouch-cover.svg` | デザイン側 | 新デザインに変更済み |
| `scripts/capture-assets.ts` | デザイン側 | フォント読み込み待ちを1行追加済み |
| `docs/submission-assets/*.png` | どちらでも | `web/` 適用後に `node scripts/capture-assets.ts` で撮り直す |

**`assets/` の2つの SVG は古い版に戻さないこと。** ロゴはユーザーが選んだ「枝分かれする d」：ライムの四角の上に、縦線の先が二つに分かれた太い小文字 d を置き、右の枝だけマゼンタにしている。一つの推薦に対して、各コミュニティが別々に判断することを表す。

## デザインの方向

深い緑がかった黒の上に、読み物のようなセリフ体の見出しと、データを表すモノスペースを置く。
強調はライムを主に使い、ロゴの右の枝などごく一部だけマゼンタを差す。「公開された記録を誰でも確かめられる」ことを、記録や計測器のような静かな画面で表す。

### 色（CSS 変数）

`web/style.css` の `:root` を次に置き換える。既存の変数名（`--ink`、`--paper` など）は役割が逆転するため、使っている箇所を新しい名前へ移す。

```css
:root {
  color-scheme: dark;
  --void: #0b0e0a;      /* ページ背景 */
  --panel: #151a13;     /* ワークスペース・カード */
  --panel-2: #1b2118;   /* 入力欄・選択中のタブ */
  --line: #2b3326;      /* 罫線・枠 */
  --bone: #e8ecdd;      /* 本文 */
  --dim: #8e9a82;       /* 補足・ラベル */
  --faint: #5d6755;     /* 無効・目盛り */
  --moss: #7f9a66;      /* 小見出し・副次の強調 */
  --lime: #d5f594;      /* 主の強調。主ボタン・有効・選択 */
  --magenta: #d6246e;   /* ブランドの第二色。ロゴの右の枝と、ごく一部の強調だけ。状態表示には使わない */
  --ember: #e08a6d;     /* 失効・拒否・危険な操作 */
  --serif: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --sans: "IBM Plex Sans", -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
body { background: var(--void); color: var(--bone); font-family: var(--sans); }
```

初回はダーク単独で公開した。その後のユーザー指定により、現在はダーク／ライトを切り替えられる。
`index.html` の `color-scheme` metaは `dark light` とし、実際の配色はrootの `data-theme` とCSSで決める。
初期表示はダーク。ライトはアイボリーの背景と深い緑の主操作を使い、ロゴと書体は共有する。
ヘッダーの太陽／月ボタンで切り替え、選択は `devouch.theme.v1` に保存する。
同梱の `theme.js` をheadで同期読み込みし、保存済みの配色を描画前に復元する。
保存できない環境でもそのページでは切り替えられ、ウォレット待機中の同意・入力状態には影響しない。
追加分の検証と公開状況は [デザイン確認](design-verification.md#ダークライト切替の追加)を参照。

### 文字

| 役割 | 書体 | 使う場所 |
| --- | --- | --- |
| 見出し | Instrument Serif 400 | `h1`、`h2`、`.panel-heading h3`、`.context h3` |
| 見出し内の強調 | Instrument Serif italic、`--lime` | `h1 span` を `<em>` にし、斜体ライムにする |
| 本文・フォーム | IBM Plex Sans 400/500 | 本文、ラベル、ボタン |
| データ・ラベル | IBM Plex Mono 400/500 | `.eyebrow`、タブ番号、`.scope-label`、アドレス・ハッシュ・ID、レビューの `dl`、状態表示 |

`h1` は `clamp(40px, 5.6vw, 72px)`、行間 1.02。`.eyebrow` はモノスペースの 11px、大文字、字間 `.16em`、色 `--moss`。

### フォントは同梱する（重要）

**Google Fonts などの外部 CDN から読み込まないこと。** このアプリは「運営者のサイトなしに、ローカル配布物だけで操作できる」ことを要件にしている。外部 CDN を使うと、その要件を損なう。利用者の IP も外部へ送られる。

- 3書体とも SIL Open Font License 1.1。`woff2` を `web/fonts/` に置き、`@font-face` で読み込む。
- 必要なウェイト：Instrument Serif 400 / 400 italic、IBM Plex Sans 400 / 500、IBM Plex Mono 400 / 500。
- `scripts/build.ts` で `dist/web/fonts/` へコピーする。ライセンス文を `THIRD_PARTY_NOTICES.txt` に追加する。
- `font-display: swap` を指定し、上の代替書体を必ず並べる。

### 部品

| 部品 | 変更 |
| --- | --- |
| ロゴ（`.brand-mark`） | `d.` の文字を、`assets/devouch-logo.svg` のインライン SVG に置き換える。32px 四方、角丸 6px。clipPath の id はページ内で重複させない |
| `LAB` バッジ | そのまま。色は `--faint` |
| 上部バー | 背景 `--void`、下線 `--line`。ネットワーク表示の点は `--moss` |
| 主ボタン（`.dark`） | 背景 `--lime`、文字 `--void`。ホバー時は明度を少し上げる |
| 副ボタン（`.secondary`） | 背景透明、枠 `--line`、文字 `--bone`。ホバーで枠 `--moss` |
| 危険なボタン（`.danger`） | 背景透明、枠と文字 `--ember` |
| 文字リンク（`.text-button`） | `--lime`、下線 |
| ワークスペース | 背景 `--panel`、枠 `--line`、影なし |
| タブ | 番号はモノスペース `--faint`。選択中は文字 `--bone`、下線 2px `--lime` |
| 入力欄 | 背景 `--panel-2`、枠 `--line`、文字 `--bone`、プレースホルダー `--faint`。フォーカス時は 2px `--lime` の outline |
| 用途の箱（`.scope-box`） | 枠 `--line`。点は `--lime`。`oss-contribution` はモノスペース |
| 右の説明欄（`.context`） | 背景 `--void` 寄り（`--panel` より暗く）、左罫線 `--line` |
| 状態表示（`.status`） | 成功は `--lime`、失敗・失効は `--ember`、確認中・取得不可は `--dim`。色だけに頼らず文言も残す |
| 復旧パネル（`.pending-panel`） | 枠 `--ember`、背景 `--panel` |
| トップの流れ図（`.flow`） | 背景 `--panel`、ENSv2 のノードだけ `--lime` 地に `--void` 文字。他のノードは枠線のみ |

### 動き（任意）

トップの流れ図の背景に、アニメーションの最初の場面（点と線の小さなグラフ）を canvas で薄く敷いてもよい。
その場合も次を守る。

- `prefers-reduced-motion: reduce` では止めた状態で描く。
- 入力や署名の操作中に視線を奪わない。ワークスペースの上には敷かない。
- 外部ライブラリは使わない。

## README にもロゴを表示する

`README.md` の先頭で、見出しの前にロゴを表示すること。GitHub 上で最初に目に入る場所なので、提出物の顔になる。

```html
<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouch logo: a lowercase d whose stem forks in two" width="120" height="120">
</p>
```

- 元データの SVG を直接参照する。PNG を別に置くと、ロゴを変えたときに食い違う。
- `alt` は形と意味が分かる文にする。
- 見出し `# Devouch` と1行目の説明はそのまま残す。

## 変えてはいけないもの

- 要素の `id`、`data-tab`、`data-go`、フォームの `name`、ボタンの文言の意味。ブラウザテストと操作の流れが依存している。
- 署名・公開・失効を別々の確認手順にしている構成と、同意のチェックボックス。
- 「推薦はコード品質・人間であること・エージェントの権限を証明しない」という表示。
- 幅 400px 前後で横スクロールが出ないこと（`test/integration/browser.test.ts` が確認している）。

## 初回デザイン適用の完了確認

1. `bun run build`、`bun run test:integration`、`bundle exec rake test` が通る。
2. 主要な文字と背景の組み合わせが WCAG AA（本文 4.5:1）を満たす。`--dim` を小さな文字に使う箇所は特に確認する。
3. キーボードだけで全タブ・全ボタンを操作でき、フォーカスが見える。
4. ネットワークの開発者ツールで、外部ドメインへのフォント要求がないことを確認する。
5. `node scripts/capture-assets.ts` で `docs/submission-assets/` の画面3枚を撮り直す。
6. GitHub 上の README の先頭にロゴが表示される。

## 開発エージェントへ渡す指示文

```text
docs/design-handoff.md を読み、web/ の見た目を新しいデザインに置き換えてください。
振る舞い・要素の id・data 属性・フォームの name・表示文言の意味は変えないでください。
フォントは外部 CDN を使わず、web/fonts/ に同梱して dist/web/ へコピーし、ライセンスを THIRD_PARTY_NOTICES に追加してください。
assets/devouch-logo.svg と assets/devouch-cover.svg はデザイン側が更新済みなので、古い版に戻さないでください。
README の先頭にもロゴを表示してください。
完了後、資料の「完了の確認」を順に実行し、最後に node scripts/capture-assets.ts で提出用の画面を撮り直してください。
```
