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
CLIの対象は `--subject` 引数で指定した。GitHubの実PR作者を確認するActionの証拠は別途必要。

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

## 残る実機確認

推薦を公開したまま、masusanouのfork PRで `valid / accepted` を先に確認する。
その後、本人walletで失効し、同じ原本・同じPRを再検証して失効を確認する。
現時点では推薦付きfork PR、人間名義の推薦付きPR、実Sepolia失効、公開hostingは未実施。
この記録だけでデモ全体の完了とは扱わない。
