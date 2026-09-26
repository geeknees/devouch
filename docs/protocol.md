# Devouch v1 の検証契約

実装: [credential.ts](../src/credential.ts)、[chain.ts](../src/chain.ts)、[policy.rb](../lib/devouch/policy.rb)。
この文書は今回の推薦版の実装に対応する。旧来の委任・Git 来歴版との形式互換はない。

## 公開原本と署名

ENS の `devouch.vouch` text に UTF-8 の JSON 全体を保存する。上限はアプリ側の 4096 bytes。
空値は撤回を表す。取得した JSON を整形し直さず、そのまま配布する。
余分なフィールド、重複キー、16段を超える入れ子、非正規の整数表現を拒否する。

外側は `{formatVersion: 1, domain, endorsement: {message, signature}}`。
EIP-712 domain は `name: Devouch`、`version: 1`、`chainId: 11155111`、
`verifyingContract: message.resolver`。primary type は `Endorsement`。
次の順序と型を固定する。

| Field | EIP-712 type | JSON representation |
|---|---|---|
| version | string | `"1"` |
| id | bytes32 | 小文字 hex、非ゼロ、新規の乱数 |
| issuer | address | EOA の公開アドレス |
| subject | string | `github:` + 正の数値 ID、最大20桁 |
| scope | string | 初期発行は `oss-contribution` |
| issuedAt | uint64 | Unix 秒の10進文字列 |
| expiresAt | uint64 | Unix 秒の10進文字列 |
| requestNonce | bytes32 | 小文字 hex、非ゼロ、新規の乱数 |
| recordName | string | ENS 正規化済みの名前 |
| resolver | address | 専用 proxy のアドレス |
| recordId | uint256 | 正の10進文字列 |
| anchorStartBlock | uint256 | proxy 配備 block の10進文字列 |

署名は65 bytesの EOA署名。viem の EIP-712 復元結果を issuer と照合する。
アドレスは小文字または正しい checksum。scope は `[a-z][a-z0-9-]{0,63}`。
時刻は `expiresAt > issuedAt`。発行時刻が公開 block より後なら不正。
公開時の全祖先と対象名のうち、最も短い有効期限を推薦の期限が超えてはならない。
snapshot 時刻が expiresAt 以上なら expired。期限より先に失効したものは revoked を維持する。

repo ID や PR head は署名対象に含めない。同一原本を複数 repo 方針で評価できる。
ID と nonce は毎回作り直す。検証器が検出する衝突範囲は、同一 resolver / record / key の先行する有効署名。
全世界の issuer 履歴を検索する仕組みではない。

## 対応する ENS

Sepolia の公式 [contracts-v2 の固定版](https://github.com/ensdomains/contracts-v2/tree/71a3b7339dbc55ab47667abdfe8303bac4f4c24e)
から ABI・生成 bytecode・runtime template・immutable offsets を取り込む。
元ファイルの SHA-256 と出典は [vendor](../vendor/ens-v2/README.md) に残す。

| Contract | Address |
|---|---|
| PermissionedResolverImpl | `0x14f09fd05d4585759e54844dc9b00147131cf243` |
| VerifiableFactory | `0x9e726eb570beb6bceb495ab8cda7df517d4e841c` |
| RootRegistry | `0x9703dbd26dab89504490994138cf2c575251a9ce` |
| ETHRegistry | `0x657ea849311d3d5823348dded7c2aaafb3ede09e` |
| UserRegistryImpl | `0xa80338aaa8d23831cea25e858d1774534abb0263` |

各 runtime は既知の immutable 部分だけを除いて比較する。root の eth の接続先も照合する。
対象は直接の `name.eth` と、固定した公式UserRegistryを通る正規化済みのsubname。`eth`を含め最大10ラベルで、完全一致の名前だけを解決する。未知のnamespace、wildcard、CCIP Readは使わない。
root→ETHRegistry→各UserRegistryをたどり、循環がないこと、全ラベルの登録が有効であること、各child registryの`getParent()`が親registryとlabelへ一致することを確認する。最終resolverだけでなく、全child registryの公式Factory配備と固定実装・初期Upgradedを検査する。
名前の公開時・現在の owner は署名者であることを要求する。
名前・registry の実装が変わった場合は、このリリースで確認できたとは扱わない。

公式 factory が生成した固定構造の77 bytes proxy と初期実装を確認する。
`anchorStartBlock` の前には code がなく、その block の `ProxyDeployed` と初期 `Upgraded` が一致することを確認する。
履歴を途中から開始して失効を隠すことはできない。
初期実装の後に `Upgraded` があれば、同じ実装へ戻った場合も unavailable。
最初の変更は既知の実装を通るため、後続の未知実装がイベントを省く前に検出できる。

## 履歴と状態

検証開始時の latest から2 block戻った位置を snapshot にする。
chain ID、block番号・hash・時刻・確認時刻を記録し、最後に同じ block の hash を再確認する。
snapshot の時刻がローカル時計より300秒以上古い、または120秒以上未来なら unavailable。
2 block は最終確定ではない。正しい時計と、正直で完全な応答を返す RPC を信頼する。
この版は状態証明や log 完全性の暗号学的証明を独自に検証しない。

1. 署名と対象 ID を検査する。
2. 固定したプロトコル、初期配備、proxy、履歴範囲を確認する。
3. resolver・ETH registry・root registry の履歴と、公開時の経路に含まれる全UserRegistryの配備からsnapshotまでの履歴を取得する。
4. 対象 record / key に原本と完全一致する最初の `TextUpdated` を見つけ、成功 receipt と canonical block を照合する。
5. その後の異なる値の書き込みがあれば永久に revoked。同じ JSON の再掲載でも戻らない。同一 block 内は transaction index / log index で並べる。
6. 公開後の対象名の`Linked`・resolver変更、経路上の登録・解除・所有権移転・TokenRegenerated、親のsubregistry・parent pointer、関連EAC権限の変更を検出する。変更と復元の往復でもinvalid。同じラベルが別registryにあっても混同せず、兄弟名だけの変更は対象に影響しない。
7. 有効候補について現在の owner・resolver・recordId・原本・時刻を照合する。
8. 有効な証拠にだけ repo 方針を適用する。

同じ値の重複書き込みは失効ではない。
registryのrootまたは経路上のlabel resourceで、登録・parent・解除・更新・subregistry・resolver・transfer admin・upgradeに関わるrole/adminの変更を追う。resolverのroot TEXT/LINK/UPGRADE権限の変更も検出する。階層名では`devouch.vouch`キーの権限変更も古い推薦をinvalidにする。直接名の既存helper操作は、キー権限の撤回後もissuerが元の推薦を撤回できる従来動作を維持する。通常の期限延長は権限変更とは扱わない。
`publication.json` は chainId / transactionHash / blockNumber / blockHash だけの探索補助で、署名済み開始 block を変更しない。
原本の一致する別の公開位置を示しても、失効判定は最初の公開から継続する。
保存した位置があれば、resolver の接続を外した後も対応する過去原本を取得できる。ただし未知実装や取得不能な履歴は成功にしない。

照会の予算は最大250,000 block、20,000 logs、1200 RPC、90秒。
1000 blockずつ照会し、範囲エラーは分割する。必要な履歴が予算内で完了しなければ unavailable。
Ruby subprocess 全体は210秒で止める。古い結果を現在の証拠としてキャッシュしない。
`hierarchy`出力は公開時に照合した経路のname・registry・owner・token_id・resource・expires_at・subregistryを含む。CLI JSON、Action summary、Webの詳細から確認できる。
長期間使った resolver では予算に達する場合がある。履歴の開始点を後ろにずらさず、新しい専用 resolver へ明示的に移行する。

## 方針と出力

方針 JSON は16 KiBまで。`repositoryId`、chainId、trustedIssuers、allowedScopes、allowedResolvers、requiredIssuers の6項目。
allowedResolvers の各要素は proxy address と implementation address。requiredIssuers は1のみ。
空リストは誰も受け入れない有効な方針。対応しているが未許可の resolver は valid / rejected、
未対応の実装は unavailable / not_evaluated。
方針の digest は入力した原本全体の SHA-256。

証拠は valid / invalid / missing / expired / revoked / unavailable。
採否は accepted / rejected / not_evaluated。
完全に照合できなければ snapshot は null。人間性は常に `human_verification: not_included`。
代表的な reason は invalid_signature、subject_mismatch、publication_missing、publication_mismatch、
revoked、expired、unsupported_implementation、resolver_upgraded、registry_upgraded、registry_parent_mismatch、rpc_unavailable、history_budget_exceeded。
エラー code は理由の識別子であり、RPCの生のエラーや URL 内の秘密情報を返さない。

## 権限・送信・復旧

issuer は名前と専用 resolver を所有し、text / link / upgrade の管理権限を自分で持つ。
補助 wallet への grant は `devouch.vouch` の text setter に限定する。
権限は resolver が扱う全 record の同じキーへ及ぶため、専用 resolver を使う。
補助 grant を取り消しても issuer の root text 権限は残る。

Namespacesは公式FactoryからUserRegistryを初期化し、parent link、親への接続、子ラベル登録をそれぞれ別取引で行う。既存child registryの上書きは行わない。子名の所有者は接続したissuerで、有効期限は全祖先の期限内に制限する。推薦ごとに新しいresolverを用意し、元の親名のresolverは置き換えない。

エージェントのidentityは専用resolverの`devouch.agent`に `{version:1,chainId:11155111,name,subject,wallet,controller}` を置き、ETH address recordとwalletを照合する。controllerは現在の名前ownerでありroot TEXT権限を持つ。これはcontrollerによる宣言で、GitHub accountの所有権証明やGitHubでの操作委任ではない。生成時にidentity・address・空の推薦recordを同じresolver初期化取引へ含める。

UIのagent grantは`url`・`avatar`・`description`の一キー単位に限定し、identity・address・推薦キー・LINK・親registryの権限は渡さない。エージェント自身は許可されたプロフィールだけを更新でき、撤回後は更新できない。text-key権限はresolver内の全recordに及ぶため、agent読取りでは配備以降のLinkedも確認し、別の名前やrecordを扱ったresolverを`agent_resolver_shared`で拒否する。

Web は署名直前と送信直前に最新の owner / resolver / record / 値を読み直す。
最終的な送信との間に別取引が入る競合を完全に排除する CAS は ENS にない。
確認した期待値が変われば送信を止め、再度依頼を作る。公開成功は receipt / event / block hash / readback 後に表示する。

送信前に公開操作を localStorage に記録する。wallet の明確な拒否だけは未送信として解除する。
応答が失われた場合は再送を止め、wallet履歴の hash から復旧する。
復旧ファイルを保存して別の配布画面の Connection settings から読み込める。
秘密鍵・seed・wallet session は保存しない。hash が既に記録されている場合、この版はその取引だけを復旧対象にする。
wallet側で置換・キャンセルした取引は自動追従しないため、元取引とnonceの状況を人が確認する必要がある。

## Action の信頼境界

イベントの base SHAから maintainer policy、head SHAから `.devouch/vouches/github-<PR作者ID>.json` を読む。
GitHub API の PR作者・送信先とイベントを照合する。actor、再実行者、commit author、JSON自己申告は対象に使わない。
PRをcheckoutせず、PRのコード・依存・スクリプトを実行しない。
配布 Action 自体とその workflow の信頼は別途必要なので、公開済み commit SHA に固定してレビューする。

GitHub.com の pull_request / report のみ対応。read-only GITHUB_TOKEN と公開RPCを使う。
CLI 0 / 1 / 2 は「報告が完了」、3以上や不整合は Action 失敗。
自動マージ、required check としての入場制限、PRへのコメント投稿はしない。
前の実行結果はその snapshot の記録であり、失効後は明示的な再実行が必要。
