# ETHGlobal Tokyo 2026：ENS を中心とする応募方針

実装追記（2026-09-26）: ENS推薦版のローカル実装・テストとGitHub CIが成功し、本人walletのSepolia公開・CLI方針比較、masusanouの実fork PRのvalid / acceptedを [検証済み](demo-evidence.md)。repoとPagesの公開・固定Actionの匿名取得も [確認済み](release-evidence.md)。実Sepolia失効とCLIでの確認は未実施、Worldは未統合。失効のPR検証と人間名義の実PR検証は同日のユーザー指定で対象外。[提出草案](submission.md)と [実装状況](implementation-status.md)を現在の進捗として参照する。

更新：2026-09-25。Building from Scratch。推薦の発行・失効・再利用を8時間版の中心にする。**ユーザーは分散性を優先し、World賞は両立できた場合に狙う方針を選択した。** 中央のバックエンドと共通発行鍵を必須にした前案は撤回した。

[企画・準備状況](hackathon-planning.md)、[ハンドオフ](hackathon-handoff.md)、[データ構造と保存場所](hackathon-data-model.md)、[調査結果](hackathon-research.md)を参照する。実際の chain 操作・認証・ライブデモは未実施。

## 対象賞と優先順位

公式 [賞の案内](https://ethglobal.com/events/tokyo2026/prizes)と[提出ガイド](https://ethglobal.com/events/tokyo2026/info/details)で確認した要件に、今回の優先順位を対応づける。

| 賞 | 賞金 | 現在の扱い |
|---|---:|---|
| ENS：Best Use of ENSv2 | 総額 $6,000（$3,000 / $2,000 / $1,000） | 主な候補 |
| World：Best Use of World ID for Agents | $7,500 | 分散性と公式要件を両立できた場合の候補 |
| World：Best Use of IDKit | $7,500 | 別の候補。中央の必須経路を増やさず、固有の要件を満たせる場合のみ |
| ENS：Best Integration of ENSv2 into an Existing Project | 総額 $4,000 | Continuity 限定のため対象外 |

最大3パートナーに応募でき、同じパートナーの複数トラックは1枠と数える。これは重複受賞の保証ではない。IDKit の利用を Agents 賞の要件達成と読み替えない。

## 基本デモ

1. CLI で一人の貢献者への推薦案を作る。
2. 推薦者が内容と公開範囲を確認し、自分のウォレットで署名する。
3. 推薦者が、自分で管理する ENSv2 の名前・resolver へ本文と署名を直接公開する。
4. CLI が ENS から取得し、二つの repo 方針で同じ推薦を評価する。
5. デモ repo の `.devouch/` に推薦 JSON と方針を置き、実 fork PR の GitHub Action で `valid / accepted` を確認する。
6. 一方の方針だけを変え、CLI で採否が独立していることを示す。
7. 推薦者が直接失効させ、両方の CLI で `revoked / not_evaluated` を確認する。2026-09-26のユーザー指定により、失効はPRでは検証しない。
8. 限定キーの権限・権限外拒否と、私たちのサイトを使わないローカル操作を示す。

一人の推薦者・一つの用途・二つの repo 方針を使い、同時に有効な推薦は一人への一件に限定する。実PRはmasusanou名義で有効な推薦を確認する。人間名義も順番に試す旧計画は、2026-09-26のユーザー指定により今回の実機確認から外した。ローカルの例は合成IDを使えるが、実PRの照合は公開範囲を理解したテスト参加者で行う。Worldを統合していない経路を、人間性確認済みとは表示しない。

Action の手軽な導入はユーザーが追加した製品要件であり、ENS 賞の固有要件とは区別する。[導入マニュアル案](adoption-guide.md)を用意した。CI はメモリ・一時 JSON で処理する。

## ENSv2 の役割と要件

ENSv2 Sepolia に、小さい推薦 JSON を保存する。公開原本・現在値・更新履歴・限定権限を実際の検証へ使い、名前を表示するだけの統合にしない。

各推薦者が専用 resolver の管理権を持ち、必要なら自分の補助鍵へ推薦キーのみの権限を渡す。同じキーの権限はその resolver の全名前に届くため、独立した推薦者を混在させない。公式 deployment の ABI・proxy・実装を着手時に照合する。

必須は、実際の公開・readback・失効、動くライブデモへのリンク、オープンソースの公開コード。公開時はライセンスを明示する。静的 Web とローカル配布物から直接操作できる構成を提案する。JSON 全体の保存にかかるガスは未確認であり、最初の ENS 操作時に測定する。

## World を追加する場合の条件

Agents 賞では、イベント提供の公式環境を使い、要求・人間の完了・安全な結果検証・保護操作まで動かすこと、拒否・期限切れ等で操作を実行しないこと、secret を公開しないこと、初回成功までの時間や統合時の改善点の報告などが必要である。

一方、確認した OIDC 経路は confidential client を前提とする。現行 IDKit にも要求署名の鍵が必要で、オンチェーン検証の存在だけでは全フローの独立性を説明できない。[追加確認](hackathon-research.md#world-と分散性の追加確認)

追加候補に進めるのは、以下を満たす具体的な経路が確認できた場合だけとする。

- 推薦の基本機能が先に成立し、8時間の必須作業を妨げない。
- Devouch 運営者が唯一の発行許可者・要求署名者・検証結果の署名者にならない。
- proof が対象の署名者・操作に結びつき、独立に検証できる。
- 対応する credential・chain・イベント環境で成功と失敗を実確認する。
- 実際に使用した技術に対応する賞要件を照合する。

成立しない場合は World 未実装と明記し、World賞への応募を前提にしない。共通 secret をブラウザへ配布したり、私たちの受領証だけを人間性の証拠にしたりする案へ戻さない。

## 提出で示す証拠

| 主張 | 確認するもの |
|---|---|
| 発行・失効を推薦者が管理する | 推薦者からの直接 tx、管理権、補助鍵の権限外拒否 |
| 本文を運営者から取得する必要がない | 別 CLI が ENS の値・イベントから本文を取得 |
| 信頼を再利用し、判断は各 repo に残る | 同じ推薦に対する二つの方針の結果と、失効の反映 |
| 私たちのサイトが必須でない | ローカル配布物と別 RPC から操作・検証 |
| ENS 賞の提出要件 | live URL、公開コードとライセンス、再現手順 |
| World の要件を満たした場合のみ | 実認証・独立した検証・拒否経路・統合フィードバック |

## 当日の条件と提出

ENS のデモ名、ウォレット、test ETH、公式 ABI、本文サイズとガス、静的公開先は着手時に確認する。2時間で基本接続が成立しなければ、未達の要件と原因を報告する。中央サービスやモックで代替して要件達成としない。

事前資料は採用任意の案として用意し、作成時期と実際の利用範囲を記録する。運営による適格性確認済みとは扱わない。[規約と方針](hackathon-research.md#募集要項と提出)

提出締切は **2026-09-27 09:00 JST**。動画は任意・推奨の2〜4分。AI 利用と、実際に使った仕様・プロンプト・計画資料を提出物へ含める。

## 公式リソース

- [ENSv2 overview](https://docs.ens.domains/ensv2/overview/)、[canonical deployments](https://docs.ens.domains/learn/deployments/)
- [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry)、[Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/)、[Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/)
- [Contract Developers](https://docs.ens.domains/ensv2/tutorial-contract-developers/)
- [World Agents](https://auth.worldcoin.dev/docs)、[discovery](https://auth.worldcoin.dev/.well-known/openid-configuration)、[公開 MCP](https://auth.worldcoin.dev/mcp)、[portal](https://auth.worldcoin.dev/portal)
- [IDKit](https://docs.world.org/world-id/idkit/integrate)、[On-chain verification](https://docs.world.org/world-id/idkit/onchain-verification)、[RP signatures](https://docs.world.org/world-id/idkit/signatures)
