# 推薦ごとのサブネームとエージェント用名前空間

この手順は0.2.0に対応する。`v0.1`タグは直接の`name.eth`の保存点として維持する。[更新時の互換性](upgrading-0.2.md)、[PCでのSepolia確認手順](sepolia-namespace-check.md)、公開先・実チェーンの[確認範囲](roadmap-plan.md)を参照。

[Namespaces](https://geeknees.github.io/devouch/#namespaces)を開く。ローカルの場合は`node scripts/serve.ts`で起動し、`http://127.0.0.1:4173/#namespaces`を開く。読み取りのInspectはwallet不要。作成・接続・登録・権限変更は本人のSepolia walletが各取引を確認する。秘密鍵をDevouchへ入力しない。

## 複数の推薦を同時に持つ

例は `287365775.vouches.your-name.eth`。`your-name.eth` は所有する名前へ置き換える。下記の名前例は公開済みの実在記録を示すものではない。

1. **Parent ENS name** に `your-name.eth` を入力し **Inspect parent**。所有者と既存child registryを確認する。
2. child registryが未接続なら **Create child registry** → **Set parent link** → **Connect child registry**。三つの取引を一つずつ確認する。既存registryが対応していればこの三つは不要。
3. **One label** に `vouches`、親の期限内の有効期限を設定して **Register subname**。
4. **Use as parent to create another level** で `vouches.your-name.eth` を親へ移す。この親に対して手順2を行う。
5. **One label** を `287365775` にして登録する。**Include an agent identity** は通常の推薦には不要。
6. **Create independent resolver**、表示されたresolverと対象名をレビューし、同意して **Connect publishing record**。
7. 2 block待ち、**Open in Publish**。GitHub数値IDと推薦の期限を確認し、既存のPrepare → Sign → Publishの順で公開する。推薦の期限は全祖先の最短期限まで。
8. 原本JSONとpublication.jsonを保存する。同じ親に別の数値IDを登録し、手順6以降を繰り返す。

一つの最終名に一つの独立したresolverを作る。二人目の公開で一人目を上書きしない。Withdrawで一件だけを空にしても、兄弟の推薦は維持される。一度失効した原本は再掲載してもrevokedのまま。再推薦は新しいID・nonce・署名で作る。

親の所有権、registry接続、関連する権限を変更すると、その経路で公開済みの推薦はinvalidになる。後から元へ戻しても復活しない。変更が必要なら、その後に新しい推薦を発行する。共通の親の権限を変える操作は、その下の複数推薦に影響する。

## エージェントの名前と限定権限

`agents.your-name.eth` → `agent.agents.your-name.eth` のように同じ登録手順を使う。最終名のresolver作成前に **Include an agent identity** を選び、エージェントのGitHub数値IDと公開walletアドレスを入力する。controllerは名前を所有する発行者walletになる。

初期化は `devouch.agent` とETHアドレス、空の `devouch.vouch` を同時に保存する。identityはcontrollerの宣言であり、GitHubアカウント所有、人間性、コード品質、GitHub操作権限の証明ではない。人間性は常に `human verification: not included`。

下部の **Inspect agent** はwalletなしでidentityと現在の権限を読む。共有欄の `?agent=...#namespaces` を開いた利用者も **Inspect agent** から同じ確認ができる。

controllerは **Profile field** で `url` / `avatar` / `description` の一つを選び **Grant field access**。エージェントは自分のwalletへ切り替えて、同じname・fieldに新しい値を入力し **Update with permitted wallet** を使う。controllerの **Revoke field access** の後はその更新が失敗する。確認表示は2 block後にInspectで更新する。

この操作は推薦キー、identity、アドレス、所有権、親・兄弟の設定を許可しない。公式ENSのtext-key権限はresolver内の全recordに作用するため、agent用resolverに別の名前を作った履歴があれば読取りを拒否する。複数agentでresolverを共用しない。

## 中断した操作を戻す

公開の名前・アドレス・途中の入力はブラウザに保存する。送信前の取引内容も既存の復旧機能へ記録される。応答が失われた場合、次の送信は無効になる。wallet履歴でhashを確認し、**Check transaction** でreceipt・送信元・宛先・calldata・readbackを照合する。再送で代替しない。

別ブラウザへ移る場合は **Save recovery file** を保存し、Connection settingsから読み込む。完了したregistry/resolverアドレスは結果から入力欄へ戻る。取引をwallet側で置換・キャンセルした場合の自動追従は含まない。

## 検証と導入

CLIの`request`・`fetch`へ完全なサブネームを渡せる。`verify`・`check`・Action・Webは同じ署名と階層履歴の検証器を使う。CLI JSONの`hierarchy`とWebの詳細に、公開時の経路とregistry/ownerを表示する。

Maintainersで複数の公開名を調べ、受け入れる推薦者を明示的に選ぶ。専用resolverを増やした場合は、そのアドレスを導入先のallowedResolversへ追加するレビューも必要。親名を信頼すれば無制限にすべての子を採用する仕組みではない。[導入ガイド](adoption-guide.md) と [検証契約](protocol.md) を参照。
