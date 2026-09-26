# 提出前確認と実機デモの手順

**本番は録画＋QRからの読み取り検証を使う。** 2026-09-26の [発表台本](presentation/script.md#当日の段取り) に合わせた手順。
録画の発行・失効は公式ENSv2コントラクトを使ったローカルEVM、Actionの場面は実GitHubのPR #2。
QRではSepoliaに公開済みの `masusanou-dev.eth` を検証する。現在の推薦を維持して本番とリハーサルに使い、
通常の確認手順ではウォレット接続・新規公開・失効・PRの作成や再実行を行わない。

## 提出前・審査直前の読み取り確認

1. [ENS名の検証URL](https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify)を開く。
   `valid`、`Vouched by geeknees.eth`、公開先 `masusanou-dev.eth`、repo A `accepted`、repo B `rejected`（`issuer_not_trusted`）を確認する。
   推薦者のPrimary ENS Nameは2026-09-26 12:29 JSTに `geeknees.eth` と確認した。推薦の公開先・subjectは変更されていない。
2. Bの **Add this issuer** で `accepted` に変わること、Trust mapの点をタップして詳細を開けることを確認する。
   例示方針の編集はブラウザ内で完結する。ページを開き直すと初期のA/B比較に戻る。
3. [実PR #2の検証URL](https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify)を開く。
   作者 `masusanou` / `github:287365775` とsubjectの一致、`valid / accepted`、base/head SHAを確認する。
   PRのAction Summaryは過去の確認記録として、画面の新しいENS snapshotと区別する。
4. CLIの送信前チェックを実行し、終了コード0、`valid / accepted`、投稿先commitとsnapshotを確認する。

   ```sh
   ./exe/devouch check --repo geeknees/devouch \
     --credential .devouch/local/demo/vouch.json --subject github:287365775 --json
   ```

   この保存済み原本は開発端末にある。別端末で取得する場合は [デモ例](../examples/demo/README.md) を使い、既存の原本を上書きしない。
5. light/darkの切り替えとスマホ幅での表示、動画の再生、スライドから動画・QRへ切り替える操作を確認する。
   `human verification: not included` は全結果で維持する。採用は推薦の評価で、コードレビューやマージ許可は別に判断する。

取得に失敗したら `unavailable` として扱い、過去のacceptedを現在の結果へ置き換えない。
既定RPCが使えない場合の確認方法は下の「接続と復旧」を使う。
動画は完成済みで、提出サイトへ直接アップロードする。アップロード用は音声入りの完成版を選び、
会場再生用の字幕・無音版と区別する。動画の公開URLや再収録は準備の必須項目ではない。

## 記録済みのデモ環境

対象 repo は [geeknees/devouch](https://github.com/geeknees/devouch)、
エージェントの PR 作者は [masusanou](https://github.com/masusanou)（数値 ID `287365775`）。
この ID と repo の状態は GitHub API で確認済み。repo はpublic、既定 branch はmain。
2026-09-26のユーザー訂正に従った送信先。同日の承認に基づき [PR #1](https://github.com/geeknees/devouch/pull/1) をmergeし、repoとPagesを公開した。
公開結果は [検証記録](release-evidence.md)。masusanouの [実fork PR #2](https://github.com/geeknees/devouch/pull/2) は `valid / accepted` を確認済み。
公開サイトはENS名検証・PR URL検証・Trust mapを備える。[公開と端末確認の記録](implementation-status.md#推薦とrepo方針の信頼マップ2026-09-26)を参照する。
送信前チェックは [PR #15](https://github.com/geeknees/devouch/pull/15) でmainへ反映済み。
人間名義の実PR検証は2026-09-26のユーザー指定で対象外。今回の実PRデモはmasusanou名義だけを使う。

ENS名・所有者・初期化済みresolverは確認済み。Actionの固定SHAと手動のPages workflowも公開済み。
推薦の公開取引とCLIのA/B方針比較は [実Sepoliaで確認済み](demo-evidence.md)。
Action commitの匿名取得、live URLと公開画面からのENS取得、実fork PRのActionを確認済み。実Sepoliaでの失効取引とそのCLI確認は未実施。
2026-09-26のユーザー指定により、失効はPRでは検証しない。masusanouのPR確認はvalid / acceptedで完了。
実Sepoliaでの失効は未実施の記録として残す。本番の録画＋QRの確認に失効取引は含めない。

## ローカル画面と初回セットアップ

公開サイトを使える場合、現在のデモに追加セットアップは不要。ローカル画面を使う場合は、一つのターミナルで次を起動する。

```sh
node scripts/serve.ts
```

画面は http://127.0.0.1:4173 。独立した端末で使う場合も同じ静的配布物を起動できる。
新しい名前で初めて発行する場合の手順を以下に示す。
ENS の取得先はユーザー指定の **https://app.ens.dev/**。
Sepolia に接続した本人のウォレットで直接 `name.eth` を取得する。
公式アプリは開発中の状態リセットを案内しているため、デモ直前に再確認する。

画面の ENS setup で専用 resolver を作り、名前に接続する。
接続はその名前の現在の resolver を置き換える操作なので、デモ専用名で行う。
秘密鍵・seed は CLI、設定ファイル、チャットに渡さない。
公開情報のみ、次の表に記録する。

| 項目 | 現在値 |
|---|---|
| Sepolia ENS 名 | `masusanou-dev.eth` |
| 推薦者 EOA | `0x894108DC5640e36c478523228addA22b58Eeb79c`（確認した名前owner） |
| 専用 resolver / 配備 block | `0x1C62ac64F60aDc036d184596e87c98fdFcFdb160` / `11780025` |
| 名前の接続 | 上記resolverへ接続済み、取引hashは未記録 |
| エージェント subject | `github:287365775` |
| エージェントの実PR / Action | [PR #2](https://github.com/geeknees/devouch/pull/2) / [run 36172488074](https://github.com/geeknees/devouch/actions/runs/36172488074)、valid / accepted |
| 推薦公開 | block `11780510`、receipt成功。[取引・原本・検証結果](demo-evidence.md) |
| 推薦の期限 | `2026-10-02T16:45:00Z`（10月3日01:45 JST） |
| Action配布先 / 40桁SHA | `geeknees/devouch@9ce4525f269f590d4d8fd0e123ff35d33dce8efa`。ローカル検証と認証なしの公開取得を確認済み |
| 静的 live URL | https://geeknees.github.io/devouch/ 。配信ファイルとブラウザ操作を確認済み |

この名前は対応実装・recordId 1で推薦を公開済み。追加のresolver配備や再公開は不要。
準備時の未送信requestとは別に、画面で準備した上記期限の原本が公開された。
masusanouのPRでvalid / acceptedを確認済み。本人walletからの失効は、以後のデモで新しい推薦が必要になるため、本人が時期を決めて行う。
失効確認には既存の原本とCLIを使う。現在のPRはopenで、PRのmergeや失効後の再実行はこのデモの前提ではない。
原本の取得とCLI比較は [デモ例](../examples/demo/README.md)のコマンドを使う。

## 接続と復旧

PagesとActionの公開は [公開手順](release-runbook.md)に沿って行う。既存公開先の確認だけなら再配信は不要。
初回セットアップの状態を別ターミナルで調べるには `bun run scripts/check-name.ts masusanou-dev.eth` を使う。
RPCの実名確認は `ready: true` まで確認する。直近runtimeだけを読むprobeの成功では代用しない。
既定Tenderlyが取得不能なら、Connection settingsで `https://rpc.sepolia.ethpandaops.io` を選んで再確認する。
CLIでも同じ原本と方針で履歴全体を再確認する。

```sh
./exe/devouch verify --credential .devouch/local/demo/vouch.json \
  --subject github:287365775 --policy .devouch/policy.json \
  --rpc-url https://rpc.sepolia.ethpandaops.io --json
```

PublicNodeは必要な過去stateを返せなかったため、今回の代替には使わない。
公開前の785 bytes・placeholder署名の見積もりは664,611 gasだった。
本人が送った実取引のreceiptはgasUsed 642,290。[証拠](demo-evidence.md)では見積もりと区別する。

## 本番リハーサルと任意の取引確認

本番は [4分台本](presentation/script.md) の録画デモ版、ブースは [ブース台本](presentation/booth-script.md) を使う。
提出後のリハーサルでは、スライド→字幕付き動画→QRの切り替えを通し、時間を計る。
公開・失効の操作は録画で示す。古い原本の復活拒否は既存のローカルEVM結合テストで確認済み。

実Sepoliaで追加の公開・失効を確認する場合は、発行者本人がQRデモへの影響と実施時期を決める。
同じrecordへの再公開や失効は、現在配っている推薦の検証結果を変える。
本人が失効した後は2 block進んでから元の原本をCLIで検証し、`revoked / not_evaluated` とsnapshotを記録する。
再推薦には新しいID / nonceが必要で、一つのrecordに二つの推薦を同時保持したとは扱わない。
失効のPR検証、人間名義の追加PR、現在のPR #2のmergeは本番の確認範囲に含めない。

## PR に含めるもの

メンテナー側は [導入手順](adoption-guide.md)の方針と workflow を通常のレビューで先に既定branchへ取り込む。
公開済み Action の40桁 SHA を使う。未公開の SHAや `main` を実行済み証拠にしない。
PR側は `.devouch/vouches/github-287365775.json` にダウンロードした原本を置く。
JSONは整形し直さない。PR作成用のログインが実際にmasusanouであることを公開前に確認する。
公開位置を使って取得する場合は [デモ例](../examples/demo/README.md)に従い、785 bytesと記録済みdigestを照合する。

PRの説明例:

> Devouch の持ち運べる推薦を確認するデモです。PR 作者 masusanou（GitHub ID 287365775）への推薦原本を追加します。
> 受け入れ側でレビューした方針に基づき、読み取り専用 Action が署名・ENS履歴・現在状態を確認します。
> 人間性、コード品質、作業委任、マージ承認の証明ではありません。このPRでは有効な推薦を確認します。失効はウォレットとCLIで別に扱います。

これは説明文の例。実際の投稿と確認結果は [PR #2](https://github.com/geeknees/devouch/pull/2)と [検証記録](demo-evidence.md#masusanouの実fork-pr)を参照する。
実際の変更は対象 repo の AGENTS.md / CONTRIBUTING / gotchas を読んでから用意する。

## 不具合・復旧の見せ方

- 署名拒否: ENSへ送信されず、公開成功にならない。
- walletの取引拒否: 保存中操作を解除し、未送信と表示する。
- 送信結果不明: 再送を止める。wallet履歴からhashを取得して Check transaction。必要なら recovery file を別画面に読み込む。
- RPC障害・古いsnapshot・履歴不足: unavailable として失敗。前の accepted を代用しない。
- 元の JSON を失効後に再掲載: revoked のまま。再推薦には新しい request を作る。
- 補助wallet: devouch.vouchだけ更新でき、別textキー・link変更は失敗。grant撤回後は補助walletが更新できず、本人は直接失効できる。

## 実機証拠の保存

公開内容だけを記録し、rawログ、鍵、token、個人用RPC認証情報は保存しない。

| ケース | 必要な証拠 |
|---|---|
| 配備・接続・公開・失効 | tx hash、receipt成功、block hash、対応eventとreadback |
| A/B再利用とBのみ不採用 | 同一原本のdigest、二つのpolicy digest、各CLI JSON、終了コード |
| masusanouのfork PR | PR URL、作者numeric ID、head/base SHA、Action run URL |
| 失効後 | CLIのrevokedとsnapshot、JSON、終了コード。PRでの検証は対象外 |
| 他人の推薦 | 対象IDと原本subjectの相違、invalidのrun |
| 運営者不在 | 起動した配布commit、別RPCのhost、直接操作のtx・readback |
| 公開 | repo URL、release SHA、HTTPS live URLの取得確認 |

## World sandbox

ユーザー指定: **https://sandbox.auth.world.org/**。
2026-09-25に公開 discovery を取得し、issuer / authorize / token / device authorization / JWKS、
RS256、openid、PKCE S256 を確認した。
token認証は client_secret_basic / client_secret_post / private_key_jwt を広告し、public client の `none` は広告していない。

PKCE対応だけでは、静的画面から秘密情報なしで token交換できると判断しない。
登録済みclientと返されたtokenのaudience・nonce・issuer・期限・署名、
推薦者walletとの結び付け、認証失敗経路を検証するまでは、人間性確認済み・World賞適合を表示しない。
現在の必須経路に Devouchのconfidential-client serverは追加していない。
参考: [公開discovery](https://sandbox.auth.world.org/.well-known/openid-configuration)。
