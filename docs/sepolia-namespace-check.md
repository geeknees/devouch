# PCのウォレット拡張で階層ENSを確認する

対象はSepoliaの`geeknees.eth`。新しい`vouches.geeknees.eth`以下だけで複数推薦を試す。既存の`geeknees.eth`と`masusanou-dev.eth`の推薦、PR #2、repo方針は維持する。本人のPCウォレットで子registry・最終名・専用resolverとagent identityを作成し、公開RPCの読み取りで照合した。推薦公開以降の進捗は下記に記録する。

## 現在の共有先と公開確認（2026-09-26 15:48 JST）

本人のPCウォレットで`masusanou.vouches.geeknees.eth`へ推薦を公開した。数値ラベルの旧名と区別し、以後の共有にはこの読みやすい名前を使う。署名対象のGitHub数値IDは`287365775`のまま。

| 項目 | 確認結果 |
|---|---|
| 共有URL | [masusanou.vouches.geeknees.eth](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify) |
| 対象・scope | `github:287365775` / `oss-contribution` |
| 推薦者 | `0x894108DC5640e36c478523228addA22b58Eeb79c`、画面では`Vouched by geeknees.eth` |
| 専用resolver | `0xd2063D439ca487c114432876886318FBcDC5c010` |
| 公開取引 | `0x6bcf744e235c186cb234962529fe1decaac32a33c0b97a9e0fd93b6b909fad31` |
| 公開block / hash | `11784535` / `0xd9184ee26544fb4e42ccc3667cac6c191a4019e0ac6b8c7698c47be1fdb5e445` |
| 署名・ENS履歴の検証 | `valid`、reason_codesは空。ethPandaOps、`2026-09-26T06:46:55.567Z`、block `11784538` / `0x072710952eae28759d60d302ae8fb538bfee2560cdd0f11ddf9a4a623e8fafe7`、2 confirmations |
| 推薦期限 | `2026-10-02T06:44:00Z`（2026-10-02 15:44 JST） |
| 公開画面 | 390px幅の新規Chrome、標準のTenderly RPC。`2026-09-26T06:48:16.185Z`、block `11784543`。署名・証拠valid、対象ID一致、横溢れ・page errorなし |
| 方針比較 | 例示Aはaccepted、Bはrejected / `issuer_not_trusted`。BのAdd this issuerでaccepted。実repoの方針は変更していない |
| Agent identity | 同じ名前とresolverで`github:287365775`、controllerは上記推薦者、agent walletは`0xBe67b36CB5d88022ecD99650E959c02b6FAf64c4`。ETHアドレスと全祖先・専用resolverの履歴も照合 |
| Agentのsnapshot | `2026-09-26T06:48:29.084Z`、block `11784544` / `0xe7e6d7fdcaedc3d8bbe0215d8aaca6b1bf46827b142f45821c1444db5a8a09a3`、4 confirmations。`url` / `avatar` / `description`の権限はfalse、値は空 |

確認に使ったのは公開ENSから取得した原本と、既存TypeScript検証器・公開ブラウザ画面。本人が保存したDownloads内の2ファイルはこの実行環境から開けなかったため、その保存ファイルとのbytes一致は未確認。こちらからウォレット接続・署名・取引は行っていない。`human verification: not included`。

[Agent identityの共有URL](https://geeknees.github.io/devouch/?agent=masusanou.vouches.geeknees.eth#namespaces)からInspect agentで確認できる。15:48 JST時点で名前の作成・専用resolver接続・identity作成・正しい対象への推薦公開まで確認した。その後の個別失効は下記に記録する。agent walletでのプロフィール更新と権限撤回は未確認。

旧数値名では、初回の署名対象が`github:287365775287365775`となっていた。block `11784420`で署名・履歴はvalidだったが、意図した対象`github:287365775`を指定した既存検証器は`invalid / subject_mismatch`を返した。新しい名前での今回の推薦は正しい対象IDを持つ。旧名の取り下げは、下記のとおり16:20 JSTに確認した。

## 開始前の読み取り確認

2026-09-26 14:00:52 JST（`2026-09-26T05:00:52.758Z`）、Sepolia block `11784011` / `0x3f202dd5bfc11cbc56276fb714b2c277038dd6fdce44156dfb7836ca1d78b041`で、`check-name.ts geeknees.eth`から以下を確認した。

- 所有者: `0x894108DC5640e36c478523228addA22b58Eeb79c`、EOA。
- 子registry: 未接続（zero address）。開始直前にInspectで再確認する。
- 既存resolver: `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160`、record `2`、原本777 bytes、ready true。

新しい専用resolverは最終サブネームにだけ接続する。親`geeknees.eth`の既存resolverを置き換えない。

## 初回の名前空間作成（2026-09-26 15:04 JST）

PCのウォレット操作後、公開RPCから次を確認した。こちらから署名・取引は送信していない。

| 確認対象 | 結果 |
|---|---|
| `geeknees.eth`の子registry | `0x00AD2DAfAF84c9A69d57AaceE129F11f14FA77A2`。`inspectSubregistry`で公式実装・履歴と、親registry `0x657eA849311d3D5823348ddEd7C2AaAFb3EDE09E` / label `geeknees`の一致を確認 |
| 子registryの検証snapshot | `2026-09-26T05:54:12.201Z`、block `11784274` / `0xbac8b0855887a60d212a951eb850cceed9e78dd39cc08ce1c863923397328219`、2 confirmations |
| `vouches.geeknees.eth` | 登録済み。所有者は上記issuer、子registryは `0x1C040F346649A2C5a365CDb64E3D6C0E5830EAb1` |
| `287365775.vouches.geeknees.eth` | 登録済み。同じissuerが所有し、専用resolver `0x7C87F8B4476c3c35AeBC528D2194E9A97a47631d`を接続済み |
| 最終名のsnapshot | `2026-09-26T06:04:15.042Z`、block `11784325` / `0xefa73f714e3554a06851fe35df1cb94d8658a8accb3f7f1ecc36dd9b1fbcbb55`、2 confirmations |
| Agent identity | `readAgent`でsubject `github:287365775`、controller `0x894108DC5640e36c478523228addA22b58Eeb79c`、wallet `0xBe67b36CB5d88022ecD99650E959c02b6FAf64c4`を取得。ETHアドレスの一致、専用resolverのリンク履歴、全祖先の経路を検証 |
| Agentのsnapshot | `2026-09-26T06:04:49.875Z`、block `11784326` / `0x6f77b91cae401090289c1c14ebb30b61ffa49baac9251d04018e525bac8cb83b`、4 confirmations。`url` / `avatar` / `description`の権限はすべてfalse、値は空 |
| 既存`geeknees.eth`の推薦 | `valid / accepted`を維持。`2026-09-26T05:51:08.210Z`、block `11784259` / `0x0df018d48348ec20d69ce6080def15d0e5122ccdf5b6ee5332a569bbfeaa7db9` |

この時点で本人は **Connect publishing record** と **Open in Publish** の完了を報告した。[旧数値名のAgent identity](https://geeknees.github.io/devouch/?agent=287365775.vouches.geeknees.eth#namespaces)はInspect agentから読み取った。宣言されたidentityであり、`human verification: not included`。その後、読みやすい`masusanou`ラベルへ作業先を移し、冒頭の公開確認を完了した。

同時刻の`check-name.ts`では名前の接続は読めたが、続くprepareが一度`rpc_unavailable`となった。別の`readAgent`はprepareを含めて成功した。取得失敗を未接続や推薦無効とは扱わない。この時点では個別失効・agentの権限付与と撤回は未確認だった。

## 1. 親の下に名前空間を作る

1. PCのウォレット拡張入りブラウザで[Namespaces](https://geeknees.github.io/devouch/#namespaces)を開く。公開更新前に試す場合はローカルの`http://127.0.0.1:4173/#namespaces`を使う。
2. **Parent ENS name**へ`geeknees.eth`を入力し、**Inspect parent · no wallet**。上記の所有者と子registryを確認する。
3. 本人のwalletを接続し、ネットワークをSepolia、アカウントを上記所有者へ合わせる。署名・取引の内容とガスはwalletで本人が確認する。Devouchへ秘密鍵・seedを入力しない。
4. 子registryが未接続なら **Create child registry** → **Set parent link** → **Connect child registry** を一つずつ実行する。各結果が確認されてから次へ進む。既存の対応registryがあれば再作成しない。
5. **One label**を`vouches`、名前の期限を親の期限内（既定の約7日を目安）にして **Register subname**。
6. **Use as parent to create another level**を押し、Parentが`vouches.geeknees.eth`になったことを確認する。この親についても手順4の3取引を実行する。中間名`vouches.geeknees.eth`には推薦用resolverを作る必要はない。

## 2. 公開の手順（masusanouは完了）

| 最終名 | PublishのGitHub数値ID | 状態 |
|---|---|---|
| `masusanou.vouches.geeknees.eth` | `287365775`（masusanou） | 公開・検証済み |
| `701242.vouches.geeknees.eth` | `701242`（geeknees） | 二件目の試用例。未検証 |

公開済みの`masusanou`を再登録・再作成する必要はない。以下は実施した手順の参照用。二件目を試す場合は名前・対象ID・保存先を分ける。

1. Parentを`vouches.geeknees.eth`にし、Inspectで既存の子registryを読む。**One label**へ`masusanou`を入力して登録する。期限は親以下にする。通常の推薦だけなら **Include an agent identity**は不要。今回の名前では本人が選択し、agent identityも保存した。**Registered subname**の入力だけを変更しても、新しい名前は登録されない。
2. **Registered subname**が表の最終名であることを確認する。agent identityを含める場合は、**Agent’s GitHub numeric ID**へ数字を実際に入力し、**Agent’s public wallet address**へagentの公開アドレスを入力する。例やplaceholderは入力値ではない。**Create independent resolver**、表示された対象名・専用resolverを確認して同意し、**Connect publishing record**。
3. 2 block待ち、**Open in Publish**。対象名と数値IDを確認し、推薦期限は全祖先より短くする（確認用なら約24時間）。IDを入力し直すときは全選択して`287365775`へ置き換え、Prepare後のContributorが`github:287365775`であることを確認する。内容確認 → 同意 → Sign → Publishの順で操作する。
4. 原本JSONとpublication.jsonを新しい専用フォルダへ保存する。例: `.devouch/local/namespace-check/masusanou/`。既存の`.devouch/local/demo/`や`.devouch/local/geeknees/`のファイルへ上書きしない。
5. Namespacesへ戻り、Parentが`vouches.geeknees.eth`であることを確認。ラベル`701242`について同じ手順を行い、別のresolver・保存先を使う。
6. [masusanouの新推薦](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify)を読み取り検証する。二件目も公開した場合は、両方のvalid、subject、経路、期限、snapshotを確認する。名前は本人の宣言であり、`human verification: not included`。

Verifyの例示repo方針は画面内で比較できる。実repoの方針を変える場合は、新しい専用resolverを許可する独立のレビューが必要。この実機確認では既存repo方針を変更しない。

## 3. 一件だけの失効（2026-09-26 16:20〜16:26 JSTに確認）

本人が旧数値名の推薦をWithdrawし、取引hashを共有した。公開RPC `https://rpc.sepolia.ethpandaops.io`でreceipt・calldata・canonical blockと、既存検証器の履歴判定を照合した。こちらから署名・取引は行っていない。

| 項目 | 確認結果 |
|---|---|
| 失効取引 | `0xc34d78b82250d301d8bc0c7cdf01b5981e32405c4464f8f3fd67c3000cb0ea9f`、success |
| 取引block / hash | `11784702` / `0xbbfe9adeb427bf373ae9fb1ae07d5b1add2fa77cff7ad6a8ee35c8ec59476abf`、`2026-09-26T07:19:12Z` |
| 対象 | `287365775.vouches.geeknees.eth`、専用resolver `0x7C87F8B4476c3c35AeBC528D2194E9A97a47631d`、record `1` |
| 操作照合 | issuerからの`setText` calldataと一致。`TextUpdated`は`devouch.vouch`を空文字列にする1件で、現在値も空 |
| 旧推薦 | `revoked`、reason_codes `["revoked"]`。`2026-09-26T07:20:51.380Z`、block `11784708` / `0x04cc278c17330d3c648f78e2e10290b14918333d8940bcaea6dfb10649ae94b0`、2 confirmations |
| 新しい共有先 | `masusanou.vouches.geeknees.eth`は`valid`、subject `github:287365775`。`2026-09-26T07:20:58.082Z`、旧推薦と同じblock/hash |
| 既存direct名 | `masusanou-dev.eth`と`geeknees.eth`はともに`valid`。各原本のSHA-256は保存済みの値と一致 |
| direct名のsnapshot | `2026-09-26T07:21:36.871Z` / `2026-09-26T07:21:35.831Z`、ともにblock `11784711` / `0x4694aca59bd6fc5c6618eb15216a64fb9b8cb282362c2fd240fd7f6f453e599c`、2 confirmations |
| 名前・agent identity | 旧名と新名の所有者、専用resolver、identityは維持。両方ともsubject `github:287365775`、上記controller・agent walletと一致。プロフィール権限は全てfalse、値は空 |
| Agentのsnapshot | 旧名`2026-09-26T07:22:10.426Z`、新名`2026-09-26T07:22:10.665Z`。ともにblock `11784712` / `0xd19eb4edfdcac3292d6fe130a1a3674b6d71b73c58be9f1f9e0f025623472624`、4 confirmations |

旧推薦の取得には**失効前の公開位置**を指定した。transactionHashは`0xcf383a104e18ff4a9d2361730ab027f6de29ab4faa91767f661c7fe970593965`、blockNumberは`11784410`、blockHashは`0x9ff1ed9774d1931caf4361a559b9c45b0ef00f306191c0fb5c9459c9bf5bceb8`、chainIdは`11155111`。失効取引のhashをpublication.jsonに入れない。

公開サイトを390px幅の新規Chromeでも確認した。ウォレットは接続せず、読取RPCだけを使った。

| 公開画面 | RPC・snapshot | 結果 |
|---|---|---|
| [旧推薦の履歴検証](https://geeknees.github.io/devouch/?name=287365775.vouches.geeknees.eth&publication=%7B%22chainId%22%3A11155111%2C%22transactionHash%22%3A%220xcf383a104e18ff4a9d2361730ab027f6de29ab4faa91767f661c7fe970593965%22%2C%22blockNumber%22%3A%2211784410%22%2C%22blockHash%22%3A%220x9ff1ed9774d1931caf4361a559b9c45b0ef00f306191c0fb5c9459c9bf5bceb8%22%7D#verify) | Tenderly、`2026-09-26T07:25:40.566Z`、block `11784732` / `0x20239c319a4cc52c7dc28214fa165b02c9d73bc7ed84ddc186077020c86ec7dc` | evidence `revoked`、署名valid、例示方針A/Bとも`not_evaluated` |
| [共有中の新推薦](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify) | ethPandaOps、`2026-09-26T07:26:23.521Z`、block `11784735` / `0x60163b795acf1c87c6a93b65dbc29aff07f9e8ae1e9cda3328d94729670c4282` | evidence・署名valid、A accepted・B rejected。Bへ推薦者を追加するとaccepted |

両画面で`Vouched by geeknees.eth`、`human verification: not included`、横溢れなし・page errorなしを確認した。最初の同時検証は標準Tenderly RPCで`unavailable`となった。順次再試行では旧名が成功し、新名はJSON-RPCエラー`-32005 / rate limit exceeded`（画面の理由は`unsupported_registry`）を確認したため、Connection settingsからethPandaOpsへ明示的に切り替えて再検証した。上表の成功を標準RPCでの成功とは扱わず、サイトの既定値や自動切替の実装は変更していない。

この確認で、新しい共有用推薦と既存デモを維持しながら、旧推薦だけを失効できた。旧原本の再掲載による再有効化拒否はローカルEVMでの検証に限り、実Sepoliaでは再掲載していない。以下は実施した操作の参照用であり、旧推薦をもう一度失効する必要はない。

1. Withdrawへ旧`287365775.vouches.geeknees.eth`の原本だけを読み込む。表示がこの旧サブネームであることを確認して失効する。共有中の新しい名前や既存のdirect名の原本は使わない。
2. 2 block後、保存したpublication.jsonを指定して検証する。消去後は現在値から原本を取得できないため、過去の公開位置が必要。結果はrevokedとなる。
3. `masusanou.vouches.geeknees.eth`と既存の二つのdirect名を再検証し、validを維持することを確認する。
4. 確認日時、各取引hash、公開位置、専用resolver、検証block/hash、画面結果を記録する。端末上の実操作と、こちらのRPC読み取り結果を区別する。

## 中断・取得失敗時

応答が不明なら再送せず、wallet履歴の取引hashを **Check transaction**へ渡して照合する。別ブラウザへ移る前は **Save recovery file**を保存する。取得不能の場合はConnection settingsのRPCを確認し、必要なら明示的に`https://rpc.sepolia.ethpandaops.io`へ変更して読み直す。

agentの権限付与・撤回を実ウォレットで試す場合は、identityに記録したagent walletを本人が操作できることを確認し、[限定権限の手順](namespaces.md#エージェントの名前と限定権限)へ進む。この確認を終えるまでは、ローカルEVMでの成功を実Sepoliaの実績と扱わない。
