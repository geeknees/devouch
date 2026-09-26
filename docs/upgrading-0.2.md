# 0.2.0への更新と0.1への切り戻し

0.2.0は階層ENS、推薦ごとの独立した記録、agent identityと限定プロフィール権限、Maintainers画面を追加する。通常のdirect `name.eth`の推薦は原本のまま検証できる。一方、権限履歴の判定を厳しくしたため、すべての旧判定との互換性を保証する更新ではない。

## 変わるもの・維持するもの

| 項目 | 0.2.0 |
|---|---|
| CLI・package・`verifier_version` | `0.2.0` |
| 署名JSONの`formatVersion`・署名message/domainのversion | `1`のまま。通常の既存推薦の再署名や一括移行は不要 |
| Action/CLIの`report_version`・方針schema | `1`のまま。evidenceとpolicyの分離・終了コードも維持 |
| 対応する公開名 | direct名に加え、固定した公式UserRegistryを経由する完全なサブネーム。`eth`を含め最大10ラベル |
| 出力 | JSONに`hierarchy`を追加。CLIのテキストにも経路の行を追加。行数に依存する連携はJSONへ変更し、未知の追加フィールドを許容する |
| TypeScript内部型 | `ChainEvidence.hierarchy`が必要。直接利用するテスト用データも更新する。公開SDKの互換性を約束するものではない |
| 保存中のwallet操作 | 旧操作の復旧は維持。namespace/agent用の新しい操作種別は旧Webでは復旧できない |

## v0.1配布物との実測比較

`test/fixtures/v0.1/`に公開タグのcommit `4fc4407a3778aad9d0b71db2e1f3e8e58051570a`から取得した配布物を未変更で保存し、出典・bytes・SHA-256・ライセンスを添付した。`test/integration/compatibility.test.ts`は、公式ENSコントラクトを動かすローカルEVMの同じ状態・同じ原本を旧配布物と現行sourceの両方へ渡す。CIの浅いcheckoutでもタグ取得を必要としない。

| 入力・操作 | v0.1 | 0.2.0 |
|---|---|---|
| 通常のdirect名の推薦 | valid | valid、同じsnapshot hash |
| direct名で推薦キーの補助権限を付与・撤回 | valid | valid |
| 推薦を消去、その後に古い原本を復元 | revoked | revoked |
| 公開後にresolverのroot TEXT権限を付与・元へ戻す | valid | invalid / `publication_mismatch` |
| 公開後にregistryのroot resolver設定権限を付与・元へ戻す | valid | invalid |
| 公開後にregistryの対象labelのresolver設定権限を付与・元へ戻す | invalid | invalid（これは新しい差分ではない） |
| 署名後、公開前にissuerのroot TEXT権限を外し、補助walletが公開 | valid | invalid / `issuer_cannot_publish` |
| 新しい階層名の推薦 | unavailable / `unsupported_namespace` | valid |
| 推薦とdirect ENS名の両方が期限切れ | missing / `publication_missing` | expired / `expired` |

関連する親・registry・resolverの権限変更を検出する判定は、direct名にも適用する。上表のresolver root権限変更後、新しく発行した推薦は両版でvalidになることも確認する。古いJSONの再掲載や権限の復元で無効化を取り消さない。階層名の補助権限には経路の厳格な履歴判定が適用されるため、direct名の補助権限の互換性をそのまま当てはめない。

## 更新手順

1. 既存の原本JSON、publication.json、repo方針、使っているAction SHAを保存する。ブラウザに未確認の取引があれば、現在の版でreceiptを照合するかrecovery fileを保存する。
2. [導入ガイド](adoption-guide.md)の0.2.0固定SHAへActionを更新し、CLIとWebも同じ版へ揃える。`./exe/devouch --version`とJSONの`verifier_version`で確認する。
3. 既存原本をそのまま再検証する。`invalid`なら理由と権限履歴を確認する。権限変更による無効化の場合は、必要な所有権・root TEXT権限を確認した後、新しいID・nonce・署名で発行する。既存デモの二つの有効な推薦を作り直す必要はない。
4. 複数推薦が必要な場合だけ[Namespaces](namespaces.md)で新しい名前と専用resolverを作る。移行のために既存のdirect名を上書き・失効する必要はない。新resolverは導入先の`allowedResolvers`へ追加するレビューが必要で、新issuerへの信頼は自動追加されない。
5. 実PRのレポートで`valid / accepted`と対象・base/head SHA・snapshotを確認する。緑のreportジョブだけで受入れと判断しない。

実PRで確認したworkflowは`https://rpc.sepolia.ethpandaops.io`を明示する。既存CLI/Web/Actionの既定RPCはTenderlyのままで、自動切替はしない。取得不能なら`unavailable / not_evaluated`として扱う。

## 切り戻しの範囲

`v0.1`タグは保存点として変更しない。旧版へ戻す前に、新版で開始したnamespace/agent取引を新版の復旧機能で確認し、新しい原本・公開位置・recovery fileも保存する。旧版は新操作種別を処理できず、新サブネームの推薦も検証できない。ブロックチェーン上の操作はアプリの切り戻しでは取り消されない。

通常のdirect名の原本はv0.1でも使えるが、上表の権限変更は旧版では見逃す場合がある。0.2.0で無効になった推薦を有効に見せる目的で切り戻さない。追加したresolver等の方針変更は別途レビューし、方針を自動的に緩めない。

既存デモ原本、`.devouch/policy.json`、PR #2は今回の更新対象外。実機で新しいサブネームを試す手順は[Sepolia確認ガイド](sepolia-namespace-check.md)に分ける。
