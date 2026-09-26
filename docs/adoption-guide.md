# Devouch 導入マニュアル

更新：2026-09-26。推薦版の [Action](../action.yml)・[CLI](../exe/devouch)・静的画面を新規実装し、ローカル通しテストを実施しました。**下記の固定commitの匿名取得とPages公開、masusanouの実fork PRでvalid / acceptedを確認済みです。** [公開の検証記録](release-evidence.md)、[実PRの検証記録](demo-evidence.md#masusanouの実fork-pr)、最新の確認範囲は [実装状況](implementation-status.md)、起動方法は [README](../README.md)を参照してください。

公開 OSS リポジトリのメンテナー向けに、まず PR 作者の推薦を Actions の結果に表示するところまでを扱います。メンテナーは設定と workflow の2ファイルを追加し、推薦を持つ貢献者は初回だけ推薦 JSON を追加します。推薦結果を読み、レビューへ進めるかはメンテナーが決めます。

Roadmap版では静的画面の **Maintainers** から設定を作れる。ローカル起動後 `http://127.0.0.1:4173/#maintainers` を開き、受け入れ先の`owner/repo`とレビューした公開Action commit SHAを指定する。最大8件の公開ENS名を検証し、表示されたissuer・scope・resolverを自分の判断で選ぶ。既定では誰も選択されず、invalid・revoked・expired・missing・unavailableの結果からは選べない。最終同意の後、`.devouch/policy.json`と`.github/workflows/devouch.yml`をダウンロードして通常のPRでレビューする。画面はwalletもGitHub loginも必要とせず、GitHubへ書き込まない。

検証結果は表示されたblock時点のもの。採用方針は「選択したissuer・scope・resolverに一致する有効な推薦」を受け入れ、画面で見たsubjectだけへ制限するものではない。新しいサブネームに別resolverを使うなら、そのresolverを許可するレビューも必要。[名前空間の作成手順](namespaces.md)を参照。`v0.1`のActionは階層名に対応しないため、階層名を受け入れる前にRoadmap版の公開SHAへ更新する。公開状況は[記録](roadmap-plan.md)に残す。

PR を送る側の手順は [AI エージェント管理者向けマニュアル](agent-operator-guide.md)を参照してください。推薦の依頼、エージェントへの指示、送信後の確認をまとめています。

GitHub Actions を使わず手元で取得・検証する操作は [CLI](cli-interface.md#4-取得と検証を直接使う)にまとめています。CLI のローカル導入は Action を使う前提条件ではありません。

## 導入するとどうなるか

PR が作成・更新されると、Devouch が PR 作者に対する推薦を読み、署名・期限・ENS 上の公開と失効・このリポジトリの方針を確認します。同じ推薦を別リポジトリでも利用でき、推薦者の再署名は不要です。

推薦は個別の PR の品質保証ではありません。推薦がないことを、不正な貢献という意味にも扱いません。

| 役割 | 用意するもの |
|---|---|
| 導入するメンテナー | GitHub Actions を利用できる repo、受け入れる推薦者の公開情報、設定と workflow |
| 推薦された貢献者 | 推薦者から受け取った公開済みの推薦 JSON。初回 PR に1ファイル追加 |
| 推薦者 | 自分のウォレット、ENS 名と resolver、発行・失効のガス。推薦の作成手順は [ハンドオフ](hackathon-handoff.md#cli-と-web-の操作案) |

検証だけを導入するメンテナーと貢献者には、ウォレット、ENS 名の取得、ガス、World 認証、サーバー、DB、Ruby / Bun のローカルインストールを求めません。Action が必要なRubyとNode.jsを用意します。GitHub と RPC の利用制限・費用条件は残ります。

## ブロックチェーンの役割

**ブロックチェーンは、推薦の公開・撤回を、複数のリポジトリから確認できる共通の記録として使います。** 推薦者が一度公開した推薦を各 repo が利用でき、推薦者が撤回した後は、各 repo の次の検証でその変更を確認できます。Devouch 運営者への問い合わせや承認は、この経路に必要ありません。

今回の案では Ethereum のテストネット Sepolia 上の ENSv2 を使います。ENS の名前に紐づくデータを扱うコントラクトを resolver と呼びます。推薦者が自分で管理する resolver の text record に、**推薦本文と署名を含む JSON 全体**を保存します。ENSv2 は、この記録の読み書きと更新権限の管理を提供します。[ENSv2 の公式説明](https://docs.ens.domains/ensv2/permissioned-resolver/)

| 担当 | Devouch での役割 |
|---|---|
| GitHub の `.devouch/` | 推薦 JSON のコピーを配布し、各 repo の受け入れ方針をレビュー・保存する |
| ブロックチェーン上の ENSv2 | 推薦本文・署名・現在の公開値・更新履歴・更新権限を保存し、repo 間で共通の確認先にする |
| Action / Ruby CLI | 署名、PR 作者との対応、期限、ENS の現在値と履歴を照合し、その repo の方針で採否を判断する |

例えば、推薦者 A が貢献者 B を推薦した場合は次の流れになります。

1. A が署名した推薦を ENS に公開し、B が同じ JSON を repo X と repo Y の `.devouch/` に置きます。
2. X と Y の Action が、JSON の署名と ENS 上の記録をそれぞれ検証します。同じ推薦でも、受け入れるかは各 repo の方針で変わります。
3. A が ENS の公開値を空にして推薦を撤回します。X と Y に古い JSON が残っていても、次の検証では更新履歴から失効を検出し、受け入れません。GitHub の過去のチェック表示は再実行するまで変わりません。

署名が推薦者と内容を結び付け、ブロックチェーンが公開・更新の状態を共有します。推薦の有効性を確認する処理は Action / CLI が担当します。ENS 自体が、推薦対象の人間性やコード品質を判定する仕組みではありません。

推薦者の公開・失効操作にはガスが必要です。導入先の Action は読み取りだけなので、検証のための取引やガスは不要です。接続先 RPC の可用性には依存し、確認できない場合は `unavailable` と表示します。推薦本文と推薦関係は公開され、撤回後も過去の履歴に残ります。

## 1. 受け入れる推薦者を設定する

`.devouch/policy.json` を作ります。下の `<...>` を置き換えてください。

```json
{
  "repositoryId": "<OWNER/REPOSITORY>",
  "chainId": 11155111,
  "trustedIssuers": ["<受け入れる推薦者のウォレットアドレス>"],
  "allowedScopes": ["oss-contribution"],
  "allowedResolvers": [
    {
      "address": "<その推薦者が使う resolver のアドレス>",
      "implementation": "0x14f09fd05d4585759e54844dc9b00147131cf243"
    }
  ],
  "requiredIssuers": 1
}
```

メンテナーが決めるのは、**誰の推薦を、何の用途で受け入れるか**です。例の `oss-contribution` は「建設的に協働できる貢献者としての推薦」を表します。

推薦者のアドレスは、その人の既知の公開経路で確認します。resolver と実装の情報は、推薦者が公開時に配布する設定例を使う想定です。PR 作者が提示したという理由だけで `trustedIssuers` を追加しないでください。秘密鍵は一切記入しません。

resolver の公開アドレスは導入者が確認します。画面の公開・取得後に、Receiving repository setup からこの形式の policy 例をダウンロードできます。出力できたことはメンテナーの採用判断を代替しません。

信頼する推薦者・resolverは複数列挙できます。各PRで検証する推薦は一件で、必要数は1に限定します。このファイルは受け入れ方針であり、推薦者や貢献者の全世界共通の登録簿ではありません。

## 2. GitHub Actions の workflow を追加する

`.github/workflows/devouch.yml` を作ります。配布先は公開済みの `geeknees/devouch` です。ローカル検証済みの40桁SHAで固定した [workflow](../.github/workflows/devouch.yml)を用意し、repoと固定commitの匿名取得を確認しました。

```yaml
# ABOUTME: Reports the pull request author's portable endorsement.
# ABOUTME: Reads JSON and chain state without checking out or executing PR code.
name: Devouch

on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]

permissions:
  contents: read
  pull-requests: read

jobs:
  endorsement:
    name: Devouch endorsement report
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: geeknees/devouch@9ce4525f269f590d4d8fd0e123ff35d33dce8efa
        with:
          policy-path: .devouch/policy.json
          mode: report
          github-token: ${{ github.token }}
```

`policy-path`、`mode`、`github-token` は [action.yml](../action.yml) の入力です。`github.token` は GitHub が提供する実行用トークンを使い、PATやrepository secretの手動登録を求めません。権限は読み取りだけです。[GitHub の権限設定](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)

既定 RPC は認証不要の `https://sepolia.gateway.tenderly.co` です。実際のデモ名の履歴とCLI requestまで確認しました。代替の `https://rpc.sepolia.ethpandaops.io` も配備時の状態照会まで確認済みで、`rpc-url` 入力で変更できます。PublicNodeは時間経過後に実名の準備確認が失敗したため、デモの代替には使いません。公開RPCの可用性・履歴保持・制限は保証せず、未完了の照会は unavailable にします。masusanouの実fork PRでは、手動登録のSecretを追加せず、GitHub提供tokenと既定RPCでvalid / acceptedを確認しました。初回forkの実行承認は必要でした。

この workflow には `checkout`、PR のビルド、テスト実行を追加しません。Action 自身のコードだけで GitHub 上の JSON と chain を読みます。配布版はタグではなく commit SHA で固定します。[GitHub の Action 固定に関する説明](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)

## 3. マージして、推薦を持つ人の PR で試す

メンテナーが上の2ファイルを通常のレビューで既定ブランチに取り込みます。その後、推薦を持つ貢献者が PR を作成します。貢献者は推薦者から受け取った JSON を、内容を編集せず次の場所に追加します。

```text
.devouch/
  policy.json
  vouches/
    github-12345.json
```

`12345` は PR 作者の GitHub 数値 user ID です。推薦の `subject` が `github:12345` なら、ファイル名は `github-12345.json` です。静的画面の公開・取得後に、Download endorsementからこの名前でダウンロードできます。公開原本と署名の形式は [v1検証契約](protocol.md#公開原本と署名)を参照してください。

一度 repo に取り込まれれば、同じアカウントからの次の PR では追加作業は不要です。別 repo へ初めて貢献するときは同じファイルをコピーできます。期限切れ後の新しい推薦は、そのファイルを更新して渡します。既存の推薦がないアカウントについては、推薦者へ依頼する負担が残ります。

Action は GitHub の PR 作者の ID と JSON の `subject` を照合します。実行を起こした人、再実行したメンテナー、Git commit の author 名を推薦対象に使いません。他人の有効な JSON を置いても、その PR 作者への推薦として通しません。

PR の送信名義は、管理者本人のアカウントと、エージェント自身の専用アカウントの両方を想定します。レビュー案では実際の PR 作者へ直接推薦を付け、エージェント名義ならそのアカウントへの推薦を使います。管理者の推薦を別 ID へ引き継ぐことや、管理関係を証明する委任は含まれていません。[送信名義ごとの例](agent-operator-guide.md#二つの送信名義と推薦の対象)と [管理者との関係](agent-operator-guide.md#管理者との関係と-github-app)を参照してください。

PR のチェックから `Devouch endorsement report` の実行を開き、Summary を確認します。想定する表示は次のとおりです。

```text
推薦の判定: このリポジトリの受け入れ方針を満たす
対象: github:12345
推薦者: <ウォレットアドレス>
用途: oss-contribution
証拠: valid / 方針: accepted
検証時刻・chain・block: <今回読み取った状態>
人間性の確認: 含まれていない
```

これは表示案です。実行結果ではありません。

| 結果 | 読み方 |
|---|---|
| `valid / accepted` | 有効な推薦が、この repo の方針を満たす |
| `valid / rejected` | 推薦は有効だが、推薦者や用途をこの repo では受け入れない |
| `missing` | 対象の推薦ファイル、またはその公開を確認できない |
| `expired` / `revoked` | 期限切れ、または推薦者が撤回した推薦 |
| `invalid` | 署名・対象・形式・公開先などが一致しない |
| `unavailable` | RPC や履歴の取得に失敗し、判断できない |

`mode: report` はレビューの参考表示用です。判定を完了できた場合の workflow 成功は「推薦を受け入れた」という意味ではありません。推薦なし・失効・不正な入力も区別して表示します。取得不能、設定不備、Action 自体のエラーは workflow を失敗させます。PR の自動クローズ・ラベル付け・マージは行いません。

この最小版を required check に設定する手順は含めません。`pull_request` では PR 内の workflow 変更も実行に影響するため、緑のチェックだけで採用を強制する仕組みにはできません。workflow 変更を含む PR は、メンテナーが実行内容も確認します。強制運用には信頼した workflow の固定と、失効後の再評価を別途設計します。[GitHub のイベントと信頼境界](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

## 運用で行うこと

| やりたいこと | 操作 |
|---|---|
| 推薦者を受け入れなくする | メンテナーが `policy.json` の方針を変更し、通常のレビューで取り込む。他 repo の判断には影響しない |
| 発行した推薦を撤回する | 推薦者がウォレットから ENS を更新する。Git の JSON を消すだけでは全 repo 共通の失効にならない |
| 失効・期限を再確認する | 該当 workflow の `Re-run all jobs`。Action は chain をその都度読み直す |
| 接続先が使えない | 別の RPC を `rpc-url` に指定した workflow へ更新する。以前の成功結果を今回の判定に流用しない |
| 導入をやめる | workflow を削除する。ローカルな受け入れ方針をやめる操作であり、推薦自体の失効ではない |

ENS の失効だけでは GitHub の過去のチェックは自動更新されません。表示は検証時点の結果です。既存 run の再実行は元の commit / ref を使うため、policy や workflow 自体を更新した場合は、その変更を含む新しい PR イベントで確認します。[GitHub の再実行仕様](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

## データを保存する場所

| データ | 保存先・役割 |
|---|---|
| repo の受け入れ方針 | GitHub repo の `.devouch/policy.json`。メンテナーがレビューして管理 |
| 持ち運ぶ推薦 | `.devouch/vouches/github-<ID>.json`。公開済み本文と署名のコピーを Git で配布・履歴管理 |
| 推薦の公開・失効 | ENSv2に本文と署名を保存する。GitHub上のコピーが失われても現在の公開値を取得でき、保存した公開位置があれば失効後の原本も取得できる |
| CI の作業データ | runner のメモリと一時 JSON。実行の終了とともに破棄してよい |
| 検証結果 | GitHub Actions の Summary。信用の原本や次回検証の代用品にはしない |

`.devouch/` には、Git で差分を確認できる通常の UTF-8 JSON ファイルを保存します。公開する方針と推薦だけを置き、秘密鍵は含めません。

Git に JSON が存在するだけでは有効な推薦になりません。Action は受け入れ方針を PR の base commit から読み、推薦 JSON をその PR の head commit からデータとして読みます。PR による方針の緩和はその PR 自身には適用しません。古い JSON や偽造した JSON を ENS・署名の検証で除外します。

## 導入できないとき

| 症状 | 確認すること |
|---|---|
| workflow が動かない | 配布repoと固定commitの公開、Actions の利用許可、fork からの実行承認、PR の競合 |
| `missing` | PR 作者の数値 ID とファイル名、JSON が PR に含まれること、ENS への公開 |
| `invalid` | 元の公開済み JSON を編集していないか、PR 作者と subject が一致するか |
| `valid / rejected` | 設定した推薦者・用途が、その推薦と一致するか |
| `unavailable` | RPC が該当 chain の状態・履歴を提供できるか。推薦が悪質という判定ではない |

GitHub 側の fork 実行承認や組織の Action 制限は残ります。競合のある PR では `pull_request` の workflow は動きません。[GitHub の PR イベント仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)

## このマニュアルから見える残課題

メンテナーの初回作業は2ファイルですが、推薦者の公開情報を確認する作業、貢献者が初回に JSON を渡す作業は必要です。「設定を貼るだけで、全世界の推薦が自動で見つかる」設計にはなっていません。

**一つの記録・キーに同時に一つの推薦**という境界は維持します。Roadmap版では推薦先ごとのサブネームと独立したresolverで同時に複数の推薦を保持し、個別に失効できます。同じ記録へ別人の推薦を書けば前の推薦は失効し、Gitへファイルを増やしても公開先の分離にはなりません。既存v0.1のmasusanou PRデモはそのまま維持し、新しい導入試験はユーザー指定の`geeknees/devouch`で行います。これは自repoでの試験であり、独立した第三者による導入実績ではありません。

推薦JSONと方針例のダウンロード、CLI・Action境界、ブラウザからの操作はローカルで確認済みです。masusanouの公開fork PRでGitHub上のランタイム準備とvalid / acceptedも確認しました。デモではユーザー指定により失効のPR検証を行いません。第三者がこの手順だけで導入する確認と所要時間の測定は残っています。
