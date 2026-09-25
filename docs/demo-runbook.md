# 実機デモの手順

対象 repo は [geeknees/devouch](https://github.com/geeknees/devouch)、
エージェントの PR 作者は [masusanou](https://github.com/masusanou)（数値 ID `287365775`）。
この ID と repo の状態は GitHub API で確認済み。repo はpublic、既定 branch はmain。
2026-09-26のユーザー訂正に従った送信先。同日の承認に基づき [PR #1](https://github.com/geeknees/devouch/pull/1) をmergeし、repoとPagesを公開した。
公開結果は [検証記録](release-evidence.md)。masusanouの [実fork PR #2](https://github.com/geeknees/devouch/pull/2) は `valid / accepted` を確認済み。
人間名義の実PR検証は2026-09-26のユーザー指定で対象外。今回の実PRデモはmasusanou名義だけを使う。

ENS名・所有者・初期化済みresolverは確認済み。Actionのローカル固定SHAと手動の公開workflowも準備済み。
推薦の公開取引とCLIのA/B方針比較は [実Sepoliaで確認済み](demo-evidence.md)。
Action commitの匿名取得、live URLと公開画面からのENS取得、実fork PRのActionを確認済み。失効取引とCLIによる失効確認は未実施。
2026-09-26のユーザー指定により、失効はPRでは検証しない。masusanouのPR確認はvalid / acceptedで完了。
以下の欄が埋まるまで実機デモ完了とは扱わない。

## 起動と準備

```sh
node scripts/serve.ts
bun run scripts/probe-rpc.ts
bun run scripts/check-name.ts masusanou-dev.eth
```

画面は http://127.0.0.1:4173 。独立した端末で使う場合も同じ静的配布物を起動できる。
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

PagesとActionの公開は [公開手順](release-runbook.md)に沿って行う。
RPCの実名確認は `ready: true` まで確認する。直近runtimeだけを読むprobeの成功では代用しない。
既定Tenderlyが取得不能なら、Connection settingsで `https://rpc.sepolia.ethpandaops.io` を選んで再確認する。
PublicNodeは必要な過去stateを返せなかったため、今回の代替には使わない。
公開前の785 bytes・placeholder署名の見積もりは664,611 gasだった。
本人が送った実取引のreceiptはgasUsed 642,290。[証拠](demo-evidence.md)では見積もりと区別する。

## 操作確認のリハーサル

以下は操作確認用の5分手順。公式の対面審査は4分デモ＋3分Q&Aなので、本番は [4分台本](presentation/script.md)を使う。
提出動画も2〜4分へ収め、倍速にしない。事前公開済みの推薦と実行結果を用意し、待ち時間を除いて3分30秒を目安にする。

1. **0:00–0:40: 目的。** PR固有の承認ではなく、貢献者への推薦を持ち運ぶ。repoごとに採否を決めることを画面の図で示す。
2. **0:40–1:40: 公開。** Publish で subject / ENS名 / 有効期限を確認し、署名してから別の取引で公開する。本人wallet、receipt、text原本、公開履歴に残る情報を示す。
3. **1:40–2:30: 再利用。** 同じ原本を repo A / B の方針で CLI 検証する。両方 accepted を示し、Bの方針だけ trustedIssuersを空にして rejected を示す。原本や署名は変更しない。
4. **2:30–3:30: 実 PR。** masusanou の fork PR の Summary で作者ID / base・head SHA / valid / accepted を示す。actor が別でも対象は PR 作者である。
5. **3:30–4:30: 失効。** Withdrawで本人walletから空値を送信する。2 block進んでからA/Bの CLI を実行し、revoked / not_evaluated を示す。PRでは失効を検証しない。古いチェックが自動で書き換わらないことを説明する。
6. **4:30–5:00: 独立動作。** 公開サイトを閉じ、別のローカル配布画面・ethPandaOps RPCから取得と本人の操作を行う。運営者のAPI・鍵・DBを呼ばない。人間性未確認と通常のコードレビューを明示する。

人間名義のfork PRは追加しない。別の推薦を発行する場合は新しいID / nonceを使い、元の推薦は失効する。
一つの record に二つの推薦を同時保持したとは扱わない。

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
