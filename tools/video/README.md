# デモ動画のベースを自動で作る

実際のワークスペース・CLI・発表用ページを録画し、編集の土台になる無音の動画を作る。

```sh
node tools/video/run.ts
```

約5分で `tools/video/out/` に次ができる（`out/` は Git 管理外）。

| ファイル | 内容 |
| --- | --- |
| `devouch-demo-base.mp4` | 全クリップを連結した 1920×1080 / 30 fps の動画。無音の音声トラック付き |
| `clips/*.mp4` | 場面ごとのクリップ。編集ソフトに個別に読み込める |
| `devouch-demo-base.en.srt` | [動画用の台本](../../docs/presentation/video-script.md)の英語セリフを各場面に割り振った字幕。声を録るときの目安 |
| `EDIT-LIST.md` | 各クリップの開始・終了時刻と長さ |

## 場面

1. ズームアニメーション（自己紹介・課題）
2. カバー（アイデア）
3. Web で推薦を発行（署名と公開を別々に確認）
4. 同じ推薦を二つの repo 方針で CLI 検証（accepted / rejected）
5. 実 fork PR（#2）の GitHub Action（公開ページ）
6. Web で失効
7. 両 repo で CLI 再検証（revoked）
8. まとめ

## 守っていること

- **ローカル EVM で録画する。** 統合テストと同じく、公式 ENSv2 のバイトコードを入れた使い捨てのチェーンとテスト用ウォレットを使う。画面に「not Sepolia」と常時表示する。Sepolia のデモとして提出する前に、実機で撮り直すか差し替える。
- **ナレーションは入れない。** ETHGlobal は合成音声と、音楽と文字だけの説明を禁止している。声は本人が録る。
- **早送りしない。** 待ち時間は実時間のまま録り、必要なら編集で切る。
- CLI の出力は実際に実行した結果を表示する。期待と違う結果なら録画を止めて失敗する。

## 必要なもの

Node.js 24、Bun、Ruby、ffmpeg、Google Chrome（macOS）または Playwright の Chromium。
`bun install` 済みであること。カードとアニメーションのフォントは録画時に Google Fonts から読むため、ネット接続が必要。

`web/` のデザインが変わったら、同じコマンドで撮り直せばよい。

## 自分の声を重ねる

場面ごとに録音したファイルを `tools/video/out/audio/01.m4a` 〜 `08.m4a` に置き、次の順に実行する。
`run.ts` で撮り直しても `out/audio/` は消えない。

```sh
node tools/video/align.ts   # 台本の各単語を話した時刻を取り、out/audio/timings.json に書く
node tools/video/run.ts     # その時刻に合わせて画面を操作しながら撮り直す
node tools/video/mix.ts     # 声を重ねて out/devouch-demo-voiced.mp4 を書き出す
```

- `align.ts` はローカルの whisper.cpp で書き起こし、台本の単語列と突き合わせる。書き起こしの誤りがあっても、台本のフレーズ位置は崩れにくい。声は外部に送らない。
- 各場面の操作は `record.ts` の `cue.at('台本のフレーズ')` で決めている。台本を変えたらフレーズも合わせる（見つからなければ録画が止まる）。
- 操作が予定より遅れた場面は、録画のログに `late:` として出る。
- 位置がずれた箇所は `timings.json` の時刻を手で直し、`run.ts` と `mix.ts` をやり直せばよい。
- 録音の前後の無音だけを削り、音量を -16 LUFS / ピーク -1.5 dBTP に揃える。文の間の間（ま）や話す速さには手を入れない。
- 合計が 3:59.5 を超えたら `mix.ts` は失敗する。台本を短くして録り直す。

whisper.cpp とモデルの準備（初回のみ）:

```sh
brew install whisper-cpp
mkdir -p ~/.cache/whisper-cpp
curl -L -o ~/.cache/whisper-cpp/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

別の場所のモデルを使うときは `WHISPER_MODEL` にパスを指定する。
