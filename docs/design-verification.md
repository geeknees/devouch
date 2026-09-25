# ワークスペースのデザイン確認

2026-09-26。[design-handoff.md](design-handoff.md) に基づく静的ワークスペースの更新。

## 実装

- 深い緑の背景、ライムの主操作、セリフ体の見出しを発表資料に合わせた。
- Instrument Serif、IBM Plex Sans、IBM Plex Mono の6フェイスを5つのWOFF2に同梱した。Sansの400/500は同じ可変フォントを使う。
- 出典・チェックサム・OFLを [web/fonts/](../web/fonts/README.md) に保存し、配布物にも完全なライセンス文を含めた。実行時の外部フォント取得はない。
- ヘッダーに既存ロゴと同じ図形のインラインSVG、README冒頭に元SVGへの参照を追加した。ロゴとカバーの元データは変更していない。
- 確認中・取得不可はdim、成功はlime、失敗・失効はemberで表示する。既存の説明文と署名・公開・失効の個別確認は維持した。
- 小さい本文になるLABと入力ヒントにはfaintではなくdimを使った。faintは装飾の罫線と補助的なタブ番号に限定する。
- 任意の背景アニメーションは追加していない。

## ローカル検証

| 確認 | 結果 |
| --- | --- |
| `bun run build` | 成功。配布物に同梱フォントとライセンスを含む |
| `bun run typecheck` | 成功 |
| `bun test test/ts` | 25 tests / 74 assertions、失敗なし |
| `bun run test:integration` | 10 tests / 58 assertions、失敗なし |
| `bundle exec rake test` | 17 tests / 68 assertions、失敗なし |
| フォント読み込み | 外部要求を遮断したChromeで6フェイスを読み込み、同一origin・WOFF2 MIME・HTTP 200を確認 |
| レスポンシブ表示 | 320 / 390 / 600 / 768 / 1024 / 1440pxの全4タブで横はみ出しなし |
| 文字コントラスト | 各タブの表示文字・入力ヒントを計算。最小5.55:1で本文AA基準4.5:1以上。装飾・無効な操作部品は対象外 |
| キーボード | Tab/Enterによる全タブ切替、各タブと展開した設定の有効なボタンへの移動、2pxのフォーカス表示を確認 |
| ブラウザエラー | 上記24レイアウトでJavaScriptエラー・外部要求なし |
| 提出画像 | `node scripts/capture-assets.ts` でworkspace / ens-setup / withdrawの3枚を更新。カバーの撮影も同梱フォントで行い、外部要求は遮断 |

追加の表示確認として、レビュー・復旧・ダウンロード部分をローカルで表示し、8個のボタンにもキーボードで到達できることを確認した。この確認では操作を送信していない。
署名・公開・失効・復旧そのものは、従来のブラウザ統合テストでローカルEVMと実際の公式コントラクトを使って確認した。
このデザイン作業に伴うSepoliaへの署名・取引は送信していない。

公開URLとGitHub上のREADMEの反映確認は、承認後のPR merge・Pages配布に続けて行う。
以前の公開版の記録は [release-evidence.md](release-evidence.md) に残している。
