# PCのウォレット拡張で階層ENSを確認する

対象はSepoliaの`geeknees.eth`。新しい`vouches.geeknees.eth`以下だけで複数推薦を試す。既存の`geeknees.eth`と`masusanou-dev.eth`の推薦、PR #2、repo方針は維持する。本人のPCウォレットで子registry・最終名・専用resolverとagent identityを作成し、公開RPCの読み取りで照合した。推薦公開以降の進捗は下記に記録する。

## 開始前の読み取り確認

2026-09-26 14:00:52 JST（`2026-09-26T05:00:52.758Z`）、Sepolia block `11784011` / `0x3f202dd5bfc11cbc56276fb714b2c277038dd6fdce44156dfb7836ca1d78b041`で、`check-name.ts geeknees.eth`から以下を確認した。

- 所有者: `0x894108DC5640e36c478523228addA22b58Eeb79c`、EOA。
- 子registry: 未接続（zero address）。開始直前にInspectで再確認する。
- 既存resolver: `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160`、record `2`、原本777 bytes、ready true。

新しい専用resolverは最終サブネームにだけ接続する。親`geeknees.eth`の既存resolverを置き換えない。

## 実機確認の進捗（2026-09-26 15:04 JST）

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

本人は **Connect publishing record** と **Open in Publish** の完了を報告した。次は手順2の**3**から、GitHub ID `287365775`と推薦期限を確認してPrepare → Sign → Publishへ進む。登録・resolver作成・接続のやり直しは不要。[Agent identityの共有URL](https://geeknees.github.io/devouch/?agent=287365775.vouches.geeknees.eth#namespaces)ではInspect agentから読み取れる。宣言されたidentityであり、`human verification: not included`。

同時刻の`check-name.ts`では名前の接続は読めたが、続くprepareが一度`rpc_unavailable`となった。別の`readAgent`はprepareを含めて成功した。取得失敗を未接続や推薦無効とは扱わない。最終名の推薦公開・個別失効・agentの権限付与と撤回はまだ確認していない。

## 1. 親の下に名前空間を作る

1. PCのウォレット拡張入りブラウザで[Namespaces](https://geeknees.github.io/devouch/#namespaces)を開く。公開更新前に試す場合はローカルの`http://127.0.0.1:4173/#namespaces`を使う。
2. **Parent ENS name**へ`geeknees.eth`を入力し、**Inspect parent · no wallet**。上記の所有者と子registryを確認する。
3. 本人のwalletを接続し、ネットワークをSepolia、アカウントを上記所有者へ合わせる。署名・取引の内容とガスはwalletで本人が確認する。Devouchへ秘密鍵・seedを入力しない。
4. 子registryが未接続なら **Create child registry** → **Set parent link** → **Connect child registry** を一つずつ実行する。各結果が確認されてから次へ進む。既存の対応registryがあれば再作成しない。
5. **One label**を`vouches`、名前の期限を親の期限内（既定の約7日を目安）にして **Register subname**。
6. **Use as parent to create another level**を押し、Parentが`vouches.geeknees.eth`になったことを確認する。この親についても手順4の3取引を実行する。中間名`vouches.geeknees.eth`には推薦用resolverを作る必要はない。

## 2. 二つの独立した推薦を公開する

| 最終名 | PublishのGitHub数値ID |
|---|---|
| `287365775.vouches.geeknees.eth` | `287365775`（masusanou） |
| `701242.vouches.geeknees.eth` | `701242`（geeknees） |

1. Parentを`vouches.geeknees.eth`のままにし、**One label**へ`287365775`を入力して登録する。期限は親以下にする。通常の推薦だけなら **Include an agent identity**は不要。今回の`287365775`では本人が選択し、agent identityも保存した。
2. **Registered subname**が表の最終名であることを確認する。agent identityを含める場合は、**Agent’s GitHub numeric ID**へ数字を実際に入力し、**Agent’s public wallet address**へagentの公開アドレスを入力する。例やplaceholderは入力値ではない。**Create independent resolver**、表示された対象名・専用resolverを確認して同意し、**Connect publishing record**。
3. 2 block待ち、**Open in Publish**。対象名と数値IDを確認し、推薦期限は全祖先より短くする（確認用なら約24時間）。Prepare → 内容確認 → Sign → Publishの順で操作する。
4. 原本JSONとpublication.jsonを新しい専用フォルダへ保存する。例: `.devouch/local/namespace-check/287365775/`。既存の`.devouch/local/demo/`や`.devouch/local/geeknees/`のファイルへ上書きしない。
5. Namespacesへ戻り、Parentが`vouches.geeknees.eth`であることを確認。ラベル`701242`について同じ手順を行い、別のresolver・保存先を使う。
6. [masusanouの新推薦](https://geeknees.github.io/devouch/?name=287365775.vouches.geeknees.eth#verify)と[geekneesの新推薦](https://geeknees.github.io/devouch/?name=701242.vouches.geeknees.eth#verify)を読み取り検証する。両方のvalid、subject、経路、期限、snapshotを確認する。名前は本人の宣言であり、`human verification: not included`。

Verifyの例示repo方針は画面内で比較できる。実repoの方針を変える場合は、新しい専用resolverを許可する独立のレビューが必要。この実機確認では既存repo方針を変更しない。

## 3. 一件だけの失効を確認する

1. Withdrawへ新しい`287365775.vouches.geeknees.eth`の原本だけを読み込む。表示がこのサブネームであることを確認して失効する。既存のdirect名の原本は使わない。
2. 2 block後、保存したpublication.jsonを指定して検証する。消去後は現在値から原本を取得できないため、過去の公開位置が必要。結果はrevokedとなる。
3. `701242.vouches.geeknees.eth`と既存の二つのdirect名を再検証し、validを維持することを確認する。
4. 確認日時、各取引hash、公開位置、専用resolver、検証block/hash、画面結果を記録する。端末上の実操作と、こちらのRPC読み取り結果を区別する。

## 中断・取得失敗時

応答が不明なら再送せず、wallet履歴の取引hashを **Check transaction**へ渡して照合する。別ブラウザへ移る前は **Save recovery file**を保存する。取得不能の場合はConnection settingsのRPCを確認し、必要なら明示的に`https://rpc.sepolia.ethpandaops.io`へ変更して読み直す。

agentの権限付与・撤回を実ウォレットで試す場合は、別のagent walletを決めた後に[限定権限の手順](namespaces.md#エージェントの名前と限定権限)へ進む。この確認を終えるまでは、ローカルEVMでの成功を実Sepoliaの実績と扱わない。
