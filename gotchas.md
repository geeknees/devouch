# 実装時の注意

- ENSv2のtext setterはDNS wire-formatの名前を受け取る。ENSv1のnode setterとはABIが異なる。公式artifactとの照合テストを維持する。
- registryのtoken IDには下位32bitの更新世代がある。イベントをlabelへ結び付けるとき、単純なlabelhash全体との等値比較では所有権変更を見逃す。
- 現在のtextだけでは失効を判定できない。proxy配備からの履歴、リンク・実装・名前の接続変更を確認する。初期配備より後のanchorを受け入れない。
- devouch.vouchの補助grantはresolver内の同じキー全体に作用する。一つの名前だけに限定する権限とは表示しない。専用resolverを使う。
- 過去原本を取得するpublication hintは現在の名前の接続先に依存させない。receiptの原本・署名・公開先を照合し、通常の履歴検証へ戻す。
- Rubyの長さ指定IO.readは空ファイルでnilを返す。空入力をinternal errorへ落とさず、credentialとpolicyの入力エラーとして扱う。
- ローカルEVMのpass、公開RPCのread、Sepolia取引、実GitHub Actionは別の証拠。公開値を未確認のまま実機デモ完了にしない。
- 現在のbytecodeや直近logsが読めても、古いstateが読めるRPCとは限らない。実際のnameでprepareまで確認する。proxyの配備探索は現在から遡り、無関係に古いfactory時点との中間stateを最初に要求しない。
- 新しいresolverのprepare成功は、時間経過後のstate保持を保証しない。デモ前は配備前・配備時の読み取りまで再確認する。PublicNodeは実名でも後に履歴取得不能となり、TenderlyとethPandaOpsで再確認した。
- ローカルgemだけで作ったBundler 4のlockfileはCHECKSUMSが空のままになることがある。既存gemでテストが通ってもCIのfrozen installは失敗する。`bundle lock --add-checksums` で補完し、空のBUNDLE_PATHとfrozenモードで再確認する。frozenを解除してCIを通す修正にはしない。
- 発表台本でも検証境界を保つ。vouchにも他repoのリスト参照があり、Devouchの補助grantを持つwalletも推薦を消せる。失効が反映されるのは各repoの次回検証であり、過去のAction結果は自動更新されない。
- `assets/devouch-logo.svg` も配布物の入力。ロゴを変えたら `bun run build` で `dist/web/devouch-logo.svg` を更新して一緒に保存する。機能テストが通っても、配布物が古ければCIの再build一致検査は失敗する。
- デモの確認範囲は最新のユーザー指定を優先する。2026-09-26に失効のPR検証と人間名義の実PR検証が対象外になった。古い計画の両名義の実PR・Action再実行を残作業として復活させない。実PRはmasusanouの有効推薦の照合まで、失効のウォレット・CLI確認は別に記録する。
- 提出動画は完成済みで、提出サイトへ直接アップロードする（2026-09-26のユーザー確認）。別の動画公開URLの取得や再収録を残作業にしない。提出済みかどうかは動画制作の完了と分けて扱う。
- Rubyの `Time.iso8601` は存在しない日付や `+09:99` の時差を自動補正する。推薦の期限は入力とparse後の表記を照合し、別の日時へ変わった入力を拒否する。UTCの `Z` / `+00:00` / `-00:00`、正しい時差とうるう日は区別して受け入れる。
- ローカル配信のCSPは `script-src 'self'` のため、HTML内のインライン初期化は実行されない。保存した配色は同梱の `theme.js` をheadから同期読み込みして描画前に適用する。初期配色の検証ではメインの `app.js` を遅延させ、再読み込みでも配色が戻らないことを確認する。
- 推薦者のPrimary Nameはviemの `getEnsName({ address, blockNumber })` で取得でき、Universal Resolverが正引き一致を検査する。公開先の `recordName` とは別の値として扱い、名前未設定・取得失敗で証拠や方針の判定を変えない。
- Ruby JSONのバージョンによっては `object_class` の `[]=` を重複キー検出に使えない。`allow_duplicate_key: false` を併用し、Ruby CLIとWebで同じ重複キーの方針fixtureを拒否することを確認する。
