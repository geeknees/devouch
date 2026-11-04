# 実装時の注意

- 送信前確認は既存CLIと同梱のdevouch-checkで完結する。ホスト側の接続要件がないままMCPや中央サービスを追加しない。
- ERC-8004のagent IDはGitHub IDと別物で、0も有効。GitHub IDは `github:正の数値`。管理者の宣言と評価者の推薦はGitHubアカウント所有の認証ではない。
- 所有者と承認済みoperatorの自己feedbackは公式実装が拒否する。ENS版の自己推薦や信頼リストを自動変換しない。移行ひな型の評価者リストは空から始める。
- アドレスや実装が現在値に戻っていても、移転・権限・対応付け・upgradeの履歴があれば古いfeedbackを復活させない。取得失敗はinvalidに言い換えずunavailableに保つ。
- 公開RPCでのコード読み取り、ローカルEVM、公開ウォレット取引、実GitHub Action、Pages配信は別の証拠。mainへのマージだけではPagesを更新しない。
- PRの方針はbase SHA、参照はhead SHA、対象はPR作者IDに固定する。検証器と同じPRで方針形式を置き換えると旧baseとの不整合になる。先行PRで `.devouch/erc8004-policy.json` を追加し、そのマージ後にCLI・Web・Actionを同じパスへ切り替える。legacy_ens_policyを想定内としてマージせず、PR headの方針へ代替もしない。古い実行の再試行は古いbaseを使うため、新しいPRイベントで検証する。
- pendingはウォレット送信前に保存する。応答不明なら重複送信せず、保存したplanとtxのsender / destination / value / calldata、receiptとstateを照合する。hex文字列は大小文字でなくbytesの一致を比較する。
- JSONを読むTextDecoderは `ignoreBOM: true` と `fatal: true` を使い、BOMと不正UTF-8を厳密な検証へ渡す。Rubyでは `object_class` だけに頼らず `allow_duplicate_key: false` も使い、両言語の共通fixtureを検証する。
- Rubyの長さ指定IO.readは空ファイルでnilを返す。入力エラーとして扱う。Time.iso8601は存在しない日付や不正な時差を補正するため、入力と正規化結果を照合する。
- native fetchをclass fieldへ直接代入してthis経由で呼ぶとChromeでIllegal invocationになる。既定fetcherは関数で包み、ブラウザでも通信を検査する。
- ブラウザテストはファイルごとにBunプロセスとEVMを分離する。旧Chromiumのpipe descriptorが後のブラウザに影響した問題を再発させない。
- 保存したテーマは同梱theme.jsをheadから同期読込みする。CSPがselfのみのためインライン初期化は動かない。モバイル幅、両テーマ、初期描画を確認する。
- 入力に架空のidentityを自動補完しない。ボタンの余白とrequired入力を維持する。検証結果を現在の証拠としてlocalStorageへ復元しない。
- source、ロゴ、noticeを変えたらdistも再生成し、rebuild後の一致を確認する。Bundler lockの空CHECKSUMSをfrozen解除で隠さない。

ENS固有の旧実装メモは[移行前の固定版](https://github.com/geeknees/devouch/blob/32b9eeb7990724696dbb5fb2ee50afd2a6f5822c/gotchas.md)を参照。現行操作と旧プロトコルの制約を混同しない。
