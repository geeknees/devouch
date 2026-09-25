# Sepolia の実機検証記録

2026-09-26 JST、ユーザーが本人walletから推薦を公開した。
公開取引のreceiptと原本を独立に取得し、実Ruby CLIで署名・ENS履歴・方針を検証した。
この文書は検証時点の記録。現在の有効性は新しいsnapshotで再検証する。

## 公開取引と原本

| 項目 | 確認値 |
|---|---|
| Chain | Ethereum Sepolia / `11155111` |
| ENS名 | `masusanou-dev.eth` |
| 推薦者・取引送信者 | `0x894108DC5640e36c478523228addA22b58Eeb79c` |
| Resolver・取引送信先 | `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160` |
| Record / 配備block | `1` / `11780025` |
| 取引 | [`0xfa33b82bd93b8296b6866107328acf4b3ace32a876c7763c4cbd10ddb9141c96`](https://sepolia.etherscan.io/tx/0xfa33b82bd93b8296b6866107328acf4b3ace32a876c7763c4cbd10ddb9141c96) |
| Receipt | success、block `11780510` |
| Block hash | `0xe69fd0cabbcc5631daed889c888bb2d48586eda832980eed03ffaa7ca905024a` |
| 実際のgasUsed | `642290` |
| Subject / scope | `github:287365775`（masusanou）/ `oss-contribution` |
| Issued / expiry | `2026-09-25T16:45:48Z` / `2026-10-02T16:45:00Z`（10月3日01:45 JST） |
| 原本の長さ | `785` bytes |
| 原本のdigest | `sha256:744713f4d8d2b1685054969db5358d527cb1c6c6a12bca362160f742ef744256` |

取得に使った公開位置は [publication-masusanou.json](../examples/demo/publication-masusanou.json)。
`fetch --publication` はそのreceipt・署名・公開先を確認して、変更せず原本を保存する。
失効後も過去の原本を取得できるが、それだけで現在の有効性を示すものではない。

## 同じ原本と独立した方針

| 方針 | repository_id | Evidence / policy | 終了コード | RPC |
|---|---|---|---|---|
| [A](../examples/demo/policy-a.json) | `geeknees/devouch` | `valid / accepted` | `0` | Tenderly |
| [B](../examples/demo/policy-b.json) | `demo/independent-repository` | `valid / accepted` | `0` | ethPandaOps |
| [B・推薦者不採用](../examples/demo/policy-b-reject.json) | `demo/independent-repository` | `valid / rejected`、`issuer_not_trusted` | `1` | ethPandaOps |

BはCLIで比較するための方針例であり、実在する別repoやPRの検証実績ではない。
三つとも同一の785 bytesを渡し、`human_verification: not_included`、`error: null` を確認した。
CLIの対象は `--subject` 引数で指定した。GitHubの実PR作者を確認した結果は、以下の実fork PRの記録と区別する。

共通snapshotはblock `11780543`、hash
`0xcfdfe1d744d7fae8e7f9e3ae77e8599e41b11429b447b3a8fbf0a7b5bb4dd9dd`、
timestamp `1790355216`。照会時刻は `2026-09-25T16:54:10–11Z`。
RPCのheadから2 block前を使った確認であり、Ethereumのfinalityとは異なる。

| 方針 | 検証したpolicy digest |
|---|---|
| A | `sha256:ce77f04b8a1679ab784528a7feec24e0d3779c0d3b045b25950cea939ee9f653` |
| B | `sha256:2e0e2c403fb14e1c602cc119a77876c38ab97d19ee576649e4ab5328f9f682d4` |
| B・推薦者不採用 | `sha256:c431653763f02a3c5e966b772dba5907e7323b6934646dbc0d94d3da8bb844aa` |

実行コマンドは [デモ例](../examples/demo/README.md)。
実行時のCLIと配布物はcommit `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` と同じ内容。
公開原本と各CLIレポートはローカルで保全し、この文書には公開値と判定を記録した。

## masusanouの実fork PR

2026-09-26 JST、[masusanouが作成したPR #2](https://github.com/geeknees/devouch/pull/2)で
`valid / accepted` を確認した。GitHub APIのPR作者・base/headと、Actionが出力した構造化レポートを照合した。
workflowの成功表示だけでなく、次の判定値と参照先を確認した。

| 項目 | 確認値 |
|---|---|
| Fork / branch | `masusanou/devouch` / `docs/published-demo-endorsement` |
| 実PR作者 / subject | `masusanou` / `github:287365775` |
| 作者の取得元 | `github.subject_source: github_pull_request_author` |
| Base SHA | `3214991e616e118d921ea9575d06d5e121b584f4` |
| Head SHA | `7ac246f17c441833cb3ece244cdf1377fe35e003` |
| 方針 | baseの `.devouch/policy.json`、digestは上記の方針Aと一致 |
| 原本 | headの `.devouch/vouches/github-287365775.json`、785 bytes、digestは上記の公開原本と一致 |
| Devouch | [run 36172488074](https://github.com/geeknees/devouch/actions/runs/36172488074)、`valid / accepted` |
| CLI / Action終了コード | `0` / `0` |
| 人間性 / エラー | `not_included` / `null`、reason codesは空 |
| Snapshot | block `11780996`、hash `0x16538eba03f69de615d030923ef165f817ea7746d9d538893ad664197bc51bc7` |
| Snapshot timestamp / 照会時刻 | `1790360664` / `2026-09-25T18:24:51.893Z` |
| Confirmations | `2`。Ethereumのfinalityを意味しない |
| 通常のCI | [Test run 36172488028](https://github.com/geeknees/devouch/actions/runs/36172488028)、全step成功 |

初回forkの実行承認待ちを確認し、READMEと推薦原本だけの差分、baseの方針と固定workflowを確認して、
上記2 runを個別に承認した。GitHubの保護設定やworkflowは変更していない。
Devouchのjobは読み取り専用のGitHub提供tokenと認証不要のRPCを使い、PRのコードを取得・実行しない。
別jobの通常CIは依存の固定インストール、Ruby/Bun/結合テスト、型・構文検査、配布物の再build一致まで成功した。
この確認時点でPR #2はopen、未merge。推薦の採否はマージ承認やコード品質の証明ではない。

## 残る実機確認

2026-09-26のユーザー指定により、失効はPRでは検証しない。
masusanouの実PR確認は、上記の `valid / accepted` で完了とする。
本人walletでの実Sepolia失効と、同じ原本を使ったCLIでの失効確認は未実施。
失効すると古い原本を再掲載しても有効には戻らない。以後のvalidデモには新しい推薦とPR内の原本更新が必要になるため、
実行時期は本人が決める。既存のGitHubチェックは検証時点の記録であり、自動更新されない。
人間名義の推薦付きfork PRでの有効時の確認も残る。人間名義のアカウントは未指定。
公開hostingと公開画面からのENS取得は [公開の検証記録](release-evidence.md)で確認済み。
この記録だけでデモ全体の完了とは扱わない。
