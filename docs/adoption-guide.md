# Devouch 導入マニュアル（設計レビュー用）

更新：2026-09-25。対象は、今回企画している「貢献者への推薦を検証する版」。**以下は目指す導入手順であり、今の Action にそのまま設定して動くマニュアルではありません。** 新しい Action、入力形式、公開先・リリース SHA、既定 RPC は未実装・未確認です。既存の委任・Git 来歴版は [README](../README.md)を参照してください。

公開 OSS リポジトリのメンテナー向けに、まず PR 作者の推薦を Actions の結果に表示するところまでを扱います。メンテナーは設定と workflow の2ファイルを追加し、推薦を持つ貢献者は初回だけ推薦 JSON を追加します。推薦結果を読み、レビューへ進めるかはメンテナーが決めます。

PR を送る側の手順は [AI エージェント管理者向けマニュアル](agent-operator-guide.md)を参照してください。推薦の依頼、エージェントへの指示、送信後の確認をまとめています。

GitHub Actions を使わず手元で取得・検証する操作は [CLI インターフェース設計](cli-interface.md#4-取得と検証を直接使う)にまとめています。CLI は独立した利用方法であり、以下の Action を導入する前提条件ではありません。新しいコマンドも設計案です。

## 導入するとどうなるか

PR が作成・更新されると、Devouch が PR 作者に対する推薦を読み、署名・期限・ENS 上の公開と失効・このリポジトリの方針を確認します。同じ推薦を別リポジトリでも利用でき、推薦者の再署名は不要です。

推薦は個別の PR の品質保証ではありません。推薦がないことを、不正な貢献という意味にも扱いません。

| 役割 | 用意するもの |
|---|---|
| 導入するメンテナー | GitHub Actions を利用できる repo、受け入れる推薦者の公開情報、設定と workflow |
| 推薦された貢献者 | 推薦者から受け取った公開済みの推薦 JSON。初回 PR に1ファイル追加 |
| 推薦者 | 自分のウォレット、ENS 名と resolver、発行・失効のガス。推薦の作成手順は [ハンドオフ](hackathon-handoff.md#cli-と-web-の操作案) |

検証だけを導入するメンテナーと貢献者には、ウォレット、ENS 名の取得、ガス、World 認証、サーバー、DB、Ruby / Bun のローカルインストールを求めません。Action が必要なランタイムを用意する設計です。GitHub と RPC の利用制限・費用条件は残ります。

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
      "implementation": "<対応する検証済み実装の識別情報>"
    }
  ],
  "requiredIssuers": 1
}
```

メンテナーが決めるのは、**誰の推薦を、何の用途で受け入れるか**です。例の `oss-contribution` は「建設的に協働できる貢献者としての推薦」を表します。

推薦者のアドレスは、その人の既知の公開経路で確認します。resolver と実装の情報は、推薦者が公開時に配布する設定例を使う想定です。PR 作者が提示したという理由だけで `trustedIssuers` を追加しないでください。秘密鍵は一切記入しません。

**今の案には、resolver と実装識別情報を導入者が扱う負担が残っています。** コピーできる設定例の出力も未実装です。これらを自動で信頼する省略はせず、導入時に公開情報を取り込める形にすることを開発条件にします。

最初は一人の推薦者・必要数1に限定します。このファイルは受け入れ方針であり、推薦者や貢献者の全世界共通の登録簿ではありません。

## 2. GitHub Actions の workflow を追加する

`.github/workflows/devouch.yml` を作ります。`DEVOUCH_OWNER/DEVOUCH_REPOSITORY@RELEASE_COMMIT_SHA` は未定の配布先を示すプレースホルダーです。新しい版を公開した際に提供する、実在するリポジトリと40桁の commit SHA へ置き換える必要があります。

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
      - uses: DEVOUCH_OWNER/DEVOUCH_REPOSITORY@RELEASE_COMMIT_SHA
        with:
          policy-path: .devouch/policy.json
          mode: report
          github-token: ${{ github.token }}
```

`policy-path`、`mode`、`github-token` は新しい Action のインターフェース案です。既存の [action.yml](../action.yml) にこのまま渡すものではありません。`github.token` は GitHub が提供する実行用トークンを使い、PAT や repository secret の手動登録は不要にします。権限は読み取りだけです。[GitHub の権限設定](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)

推薦の取得・検証は、認証不要の Sepolia RPC を Action の既定値として提供する想定です。導入者が選んだ公開 RPC へ `rpc-url` 入力で変更できるようにします。**既定接続先の選定、履歴取得、利用制限の実測はリリース前の未完了事項**です。秘密の RPC キーを登録しないと動かない構成では、この導入目標を達成したと扱いません。

この workflow には `checkout`、PR のビルド、テスト実行を追加しません。Action 自身のコードだけで GitHub 上の JSON と chain を読みます。配布版はタグではなく commit SHA で固定します。[GitHub の Action 固定に関する説明](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)

## 3. マージして、推薦を持つ人の PR で試す

メンテナーが上の2ファイルを通常のレビューで既定ブランチに取り込みます。その後、推薦を持つ貢献者が PR を作成します。貢献者は推薦者から受け取った JSON を、内容を編集せず次の場所に追加します。

```text
.devouch/
  policy.json
  vouches/
    github-12345.json
```

`12345` は PR 作者の GitHub 数値 user ID です。推薦の `subject` が `github:12345` なら、ファイル名は `github-12345.json` です。推薦者の公開画面から、この名前でダウンロードできるようにします。ファイルの中身は [推薦 JSON の構造](hackathon-data-model.md#3-公開する推薦の構造)そのものです。

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
| 推薦の公開・失効 | ENSv2。今回の案では本文も保存し、GitHub 上のコピーが失われても取得できるようにする |
| CI の作業データ | runner のメモリと一時 JSON。実行の終了とともに破棄してよい |
| 検証結果 | GitHub Actions の Summary。信用の原本や次回検証の代用品にはしない |

`.devouch/` には、Git で差分を確認できる通常の UTF-8 JSON ファイルを保存します。公開する方針と推薦だけを置き、秘密鍵は含めません。

Git に JSON が存在するだけでは有効な推薦になりません。Action は受け入れ方針を PR の base commit から読み、推薦 JSON をその PR の head commit からデータとして読みます。PR による方針の緩和はその PR 自身には適用しません。古い JSON や偽造した JSON を ENS・署名の検証で除外します。

## 導入できないとき

| 症状 | 確認すること |
|---|---|
| workflow が動かない | 配布先と SHA の置換、Actions の利用許可、fork からの実行承認、PR の競合 |
| `missing` | PR 作者の数値 ID とファイル名、JSON が PR に含まれること、ENS への公開 |
| `invalid` | 元の公開済み JSON を編集していないか、PR 作者と subject が一致するか |
| `valid / rejected` | 設定した推薦者・用途が、その推薦と一致するか |
| `unavailable` | RPC が該当 chain の状態・履歴を提供できるか。推薦が悪質という判定ではない |

GitHub 側の fork 実行承認や組織の Action 制限は残ります。競合のある PR では `pull_request` の workflow は動きません。[GitHub の PR イベント仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)

## このマニュアルから見える残課題

メンテナーの初回作業は2ファイルですが、推薦者の公開情報を確認する作業、貢献者が初回に JSON を渡す作業は必要です。「設定を貼るだけで、全世界の推薦が自動で見つかる」設計にはなっていません。

特に、現在の ENS 案は **一つの記録・キーに同時に一つの推薦だけ**です。同じキーへ別の人の推薦を書くと前の推薦が失効します。このままでは複数人を推薦する実運用に足りず、Git にファイルを増やしても解決しません。8時間版は、一度に一人への推薦を二つの repo 方針で再利用するデモです。管理者名義とエージェント名義の確認は、片方の発行・PR・失効後にもう片方へ新しく発行して順番に行います。複数推薦の同時保持は一般公開前の設計課題です。

公開リポジトリ・fork PR での実行、手動 secret 登録なしの RPC 検証、ランタイムの自動準備、推薦 JSON と設定例のダウンロード、第三者がこの手順だけで導入できることを確認してから、実行可能な導入マニュアルへ更新します。導入所要時間はまだ測定していません。
