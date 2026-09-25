# Devouch：CLI インターフェース設計

更新：2026-09-25。対象は、推薦の発行・失効・再利用を中心にしたハッカソン版。**本書は設計レビュー用であり、以下のコマンド・オプション・出力は未実装の案である。**

CLI は人間と AI エージェントが直接使うインターフェースである。GitHub Actions は、PR 情報を取得して同じ検証を実行する入口の一つとする。GitHub の画面を開かず、手元のファイルと RPC 接続で推薦を取得・検証できる構成を目指す。

企画の合意事項は [企画・準備状況](hackathon-planning.md)、署名する推薦と保存先は [データ構造と保存場所](hackathon-data-model.md)、実装範囲は [ハンドオフ](hackathon-handoff.md)を参照する。本書で CLI の詳細案を管理する。

## 1. 利用者と操作の分担

| 利用者 | CLI で行うこと | CLI から受け取るもの |
|---|---|---|
| 推薦者 | 推薦案の作成、公開後の取得、失効案の作成 | ウォレットで確認する案、公開済み JSON、次に必要な操作 |
| 貢献者・AI エージェント管理者 | 自分が送信するアカウントへの推薦の取得、投稿前の検証 | 配布する JSON、投稿先の方針に対する判定と理由 |
| OSS メンテナー | 任意の推薦を、自分の repo 方針で検証 | 証拠の有効性と repo の採否を分けた結果 |
| GitHub Action・他の自動化 | 引数を指定して検証し、JSON と終了コードを処理 | 表示文の解析を必要としない結果 |

CLI の4コマンドはチェーンへ取引を送信しない。**署名・公開・失効の送信は、ローカル起動もできる静的 Web と推薦者自身のウォレットで行う。** `revoke` の成功は失効案の作成完了を意味し、チェーン上の失効完了とは表示しない。

検証する利用者にはウォレットやガスを求めない。推薦者は ENS 名・専用 resolver を用意し、公開・失効のガスを負担する。全工程に Devouch 運営者の登録 API や共有秘密鍵を置かない。

初版は ENSv2 の既存コントラクト実装を利用する案である。名の用意と専用 resolver のデプロイ・初期化は、推薦者が初めて推薦を発行する前の準備に位置づける。公式 Factory を利用する流れと、ENS / CLI の責任分担は [既存コントラクトの利用とデプロイ](hackathon-data-model.md#既存コントラクトの利用とデプロイ)を参照する。

## 2. コマンド一覧

```text
devouch --help
devouch --version
devouch COMMAND --help

devouch request --subject SUBJECT --issuer ADDRESS --name NAME
                --expires-at TIME --output PATH [--rpc-url URL] [--json]

devouch fetch --name NAME --output PATH
              [--publication PATH] [--publication-output PATH]
              [--rpc-url URL] [--json]

devouch verify --credential PATH --policy PATH --subject SUBJECT
               [--publication PATH] [--rpc-url URL] [--json]

devouch revoke --credential PATH --output PATH [--rpc-url URL] [--json]
```

| コマンド | 成功時に完了すること | 主な利用者 |
|---|---|---|
| `request` | 未署名・未公開の推薦案をファイルへ保存 | 推薦者 |
| `fetch` | ENS の推薦本文をファイルへ保存 | 推薦者、貢献者、検証者 |
| `verify` | 署名・対象・公開と失効・期限・repo 方針の評価 | 貢献者、メンテナー、自動化 |
| `revoke` | 公開済み推薦を対象にした失効案をファイルへ保存 | 推薦者 |

引数なしの `devouch` は help を表示する。help と version は RPC 接続を必要としない。未知のコマンド・オプションは利用エラーにする。

既存の [CLI 実装](../lib/devouch/cli.rb)は `credential create`、`ledger publish/revoke/resolve`、`delegate`、`commit` などを持つ別の版である。特に既存の `verify` と本書の `verify` は入力も終了コードも異なる。現行バイナリで本書の操作が動くとは扱わず、実装後の配布物と版を明記する。

## 3. 共通の入出力

### 実行環境と接続

Ruby CLI と、暗号・ENS 検証を担う Bun / `viem` の補助部分を組み合わせる案である。CLI を直接導入する場合は両方の実行環境が必要になり、Action では配布側が準備を内包する。配布方式・インストールコマンド・対応バージョンは実装時に確定し、未公開のパッケージ名で導入手順を作らない。

接続設定は次の優先順位で選ぶ案とする。

1. `--rpc-url URL`
2. 環境変数 `DEVOUCH_RPC_URL`
3. 配布物に明記した認証不要の既定 RPC

既定 RPC の提供元と、必要な履歴を取得できるかは未確認。設定がない場合は設定エラー、接続先を選べたが応答・履歴を取得できない場合は `unavailable` とする。利用者に Devouch 専用アカウントや手動 secret の登録を必須にしない。

8時間版の対応 chain は Sepolia、`chainId: 11155111` に限定する。RPC が別の chain を返したら処理を止める。CLI は秘密鍵を引数・環境変数・ファイルから受け取らず、`.env` を自動で読み込まない。認証情報を含む RPC URL は出力へ含めない。

### ファイル

| 規則 | 動作案 |
|---|---|
| パス | 相対パスは実行ディレクトリを基準にする。入力ファイルは引数で指定し、自動検索しない |
| 保存先 | `--output` を明示する。親ディレクトリは利用者が用意する |
| 上書き | 既存ファイルへは書かず終了コード `5`。別の出力名を指定して再実行する |
| 出力途中の失敗 | すべての保存先を事前確認し、一時ファイルを使って不完全な本文を完成ファイルとして残さない。失敗したら成功表示を出さない |
| 推薦 JSON | ENS から取得した本文の bytes をそのまま保存する。公開済み本文を整形し直さない |
| 設定 | 検証対象 repo の方針は `--policy` で指定する。推薦ファイルが指定する方針へ切り替えない |

入力をシェルやコードとして実行しない。出力先の `-`、stdin からの入力、対話的な質問、`--force` は初版に含めず、ファイル引数と明示的な再実行で扱う。

### 表示と自動化

- 既定の stdout は人が読む結果。何が終わり、次に何をするかを短く示す。
- `--json` を指定した場合、stdout は1個の JSON オブジェクトと改行だけにする。進捗は stderr に出す。
- `--json` は推薦本文を stdout へ出す指定ではない。本文は `--output` に保存し、stdout には操作結果や検証結果を出す。
- 引数不足でも入力待ちにせず終了する。AI エージェントは終了コードと JSON の機械向け項目を読み、表示文に依存しない。
- 例の `NAME`、`ISSUER_ADDRESS`、数値 ID は説明用。実際の ENS 名・公開アドレス・送信アカウントに置き換える。JSON 表示例も実行証拠ではない。

## 4. 取得と検証を直接使う

### 推薦を取得する

```bash
devouch fetch --name NAME --output vouch.json
```

表示案：

```text
取得完了: vouch.json
対象: github:12345
推薦の有効性・repo の採否: 未検証
次の操作: verify に推薦ファイル、受け入れ方針、対象 ID を指定する
```

`fetch` の成功は取得の完了であり、推薦の採用ではない。取得後に `verify` を実行する。

### 投稿先の方針で検証する

```bash
devouch verify \
  --credential vouch.json \
  --policy .devouch/policy.json \
  --subject github:12345
```

表示案：

```text
証拠: valid
方針: accepted
対象: github:12345
対象 ID の出典: 呼び出し元が --subject で指定
推薦者: <公開アドレス>
用途: oss-contribution
方針: <repositoryId> / <policy の digest>
検証: <verifier の版> / <検証時刻> / chain 11155111 / block <番号・hash>
人間性の確認: 含まれていない
```

AI エージェントからは同じコマンドへ `--json` を付ける。管理者本人名義なら管理者の ID、エージェント自身の名義ならエージェントの ID を指定する。片方への推薦を別の ID に流用しない。

ローカルの `--subject` は、利用者が検証したい対象を指定する引数である。CLI はその ID の所有権や実際の PR 作者を確認したとは表示しない。`--policy` も、そのファイルを使った評価であり、投稿先が採用している最新版・base commit の方針だとは自動的に保証しない。投稿前の確認と、Action が GitHub の情報から行う照合を区別する。

別 repo で再利用するときは、同じ `vouch.json` と対象 ID を使い、`--policy` だけをその repo の方針へ変える。署名し直さずに評価するが、chain の現在状態は毎回読み直す。

## 5. 推薦者が発行・失効する

### 推薦案を作る

```bash
devouch request \
  --subject github:12345 \
  --issuer ISSUER_ADDRESS \
  --name NAME \
  --expires-at 2026-10-01T00:00:00Z \
  --output request.json
```

例の期限は、実行時点より未来で推薦の用途に合う値へ置き換える。`request` は初期化済みの名・resolver・記録の情報を読み、ID と nonce を生成する。表示には対象・推薦者・用途・期限・公開先を含める。

```text
推薦案を保存: request.json
状態: 未署名・未公開
対象: github:12345
用途: oss-contribution
期限: 2026-10-01T00:00:00Z
次の操作: 静的 Web へ request.json を読み込み、ウォレットで署名・公開する
```

続けて、推薦者が静的 Web で内容と公開範囲を確認し、ウォレットで署名・公開する。公開は成功 receipt と readback の一致まで確認する。公開後に `fetch` で本文を取得し、対象の `github-<ID>.json` として貢献者へ渡せる。

### 失効案を作る

```bash
devouch revoke --credential vouch.json --output revoke-request.json
```

```text
失効案を保存: revoke-request.json
状態: 未送信
次の操作: 静的 Web へ読み込み、対象を確認してウォレットから送信する
このコマンドの実行だけでは推薦は失効していない
```

ウォレットから送信し、receipt と空の公開値を確認した後、同じ `vouch.json` を `verify` へ渡す。期待する結果は `revoked / not_evaluated`、終了コード `2` である。

同じ record / key に新しい推薦を公開すると、古い推薦は失効するという案を維持する。`request` は既存の公開値を案とともに表示し、Web でも置換の影響を確認できるようにする。`revoke` の案が指す推薦と、送信直前の公開値が違えば、その案では送信しない。確認と送信の間に別の取引が確定する競合まで防ぐ、chain 上の条件付き更新は未設計である。

## 6. コマンドごとの契約

### request

| 引数 | 必須 | 意味・条件 |
|---|---|---|
| `--subject` | 必須 | `github:<数値 user ID>`。ログイン名や commit author 名を受け取らない |
| `--issuer` | 必須 | 署名する推薦者の EOA 公開アドレス。秘密鍵ではない |
| `--name` | 必須 | 初期化済みの ENS 名。対応する専用 resolver・記録を chain から確認する |
| `--expires-at` | 必須 | タイムゾーンを含む RFC 3339 形式の未来の時刻。表示は UTC、推薦には Unix 秒で保存 |
| `--output` | 必須 | 未署名の案の保存先 |

初版の用途は `oss-contribution` に固定する。`id`、`requestNonce`、`issuedAt`、公開先の情報と履歴開始 block を案へ含め、署名済み推薦と同じ意味で検査できるようにする。型の詳細は [推薦データ](hackathon-data-model.md#3-公開する推薦の構造)に従う。

作成時点の chain 情報は送信権限の予約ではない。署名・送信時に Web が chain、公開先、期限、ウォレットを再確認する。案を修正した場合は内容を再表示し、署名対象の変更は再署名する。

### fetch

| 引数 | 必須 | 意味・条件 |
|---|---|---|
| `--name` | 必須 | 取得する ENS 名 |
| `--output` | 必須 | 取得した公開本文の保存先 |
| `--publication` | 任意 | 過去の公開位置を指定する手がかり。指定時は、その公開イベントの本文を取得する |
| `--publication-output` | 任意 | chain と照合した公開位置を別ファイルへ保存する。未指定なら補助ファイルを作らない |

既定では `devouch.vouch` の現在値を取得する。`publication.json` の内容は [公開位置の構造](hackathon-data-model.md#4-ens-にある状態と公開位置)に従い、receipt と公開イベントを再照合する。name と取得した推薦の公開先が一致しない場合は成功にしない。

現在値が空なら `missing` とする。空であることだけから、特定の推薦が失効したとは決めない。過去の公開位置を持っていれば、失効後の本文を取得できる入口を用意する。

```bash
devouch fetch \
  --name NAME \
  --publication publication.json \
  --output archived-vouch.json
```

履歴から取得できたことも有効性を意味しない。`verify` は現在値とその後の更新履歴まで確認する。手元に本文も公開位置もない状態から、全推薦を探す検索機能は含めない。

### verify

| 引数 | 必須 | 意味・条件 |
|---|---|---|
| `--credential` | 必須 | 署名付き推薦 JSON。変更せず読み取る |
| `--policy` | 必須 | 評価する repo の `policy.json`。入力ファイルの bytes の digest を結果へ含める |
| `--subject` | 必須 | 照合したい対象。推薦本文の subject を期待値として自動採用しない |
| `--publication` | 任意 | 公開位置の探索を助けるファイル。なくても署名済みの公開先と開始 block から照合する |

署名・対象・形式を検査し、ENS の公開・失効・期限と方針を評価する。chain の照会は一つの snapshot block にそろえ、過去の JSON の再掲載による復活を認めない。検証アルゴリズムは [ハンドオフ](hackathon-handoff.md#ensv2-の公開権限失効)に従う。

`publication.json` は信用の根拠ではない。指定があっても receipt とイベントを照合し、署名済みの `anchorStartBlock` を置き換えない。探索範囲の上限や RPC の履歴不足で確認できない場合は `unavailable` とし、単なる推薦の欠如として扱わない。

入力は一つの推薦、一人の issuer を対象にする。初版の `requiredIssuers` は `1` だけに対応し、それ以外の方針を黙って緩和せず設定エラーにする。複数推薦の同時検証は別途設計する。

### revoke

| 引数 | 必須 | 意味・条件 |
|---|---|---|
| `--credential` | 必須 | 失効させたい公開済み推薦 JSON |
| `--output` | 必須 | 未送信の失効案の保存先 |

案には推薦の ID、本文を特定する digest、chain、名、resolver、record ID、text key、空値へ更新する意図を含める。出力形式は Web 側と一緒に版を固定する。署名と公開履歴を確認して対象を特定し、現在値が別の推薦なら案を作らない。署名は正しく期限切れになった推薦についても、現在値が対象のままなら失効案を作れる。

実際の送信権限は推薦者のウォレットと ENS の権限で判断する。CLI が案を作れたことを、発行者本人の認証や送信権限の証明にしない。

## 7. JSON 出力と終了コード

### 検証結果

機械向けの項目名と状態値は英語で固定する案とする。人向けの説明文とは分ける。

```json
{
  "report_version": 1,
  "command": "verify",
  "evidence_status": "valid",
  "policy_status": "accepted",
  "reason_codes": [],
  "subject": "github:12345",
  "subject_source": "argument",
  "issuer": "<推薦者の公開アドレス>",
  "scope": "oss-contribution",
  "human_verification": "not_included",
  "policy": {
    "repository_id": "OWNER/REPOSITORY",
    "digest": "sha256:<入力ファイルの digest>"
  },
  "verifier_version": "<配布物を識別する版>",
  "snapshot": {
    "chain_id": 11155111,
    "block_number": "<照会した block 番号>",
    "block_hash": "<照会した block hash>",
    "checked_at": "<UTC の検証時刻>"
  },
  "error": null
}
```

`snapshot` は全 chain 照会の整合を確認できた場合に設定する。署名不正で照会前に止めた場合や、RPC 障害でその整合を確認できない場合は `null` とする。解析できなかった issuer なども `null` にし、入力から推測して埋めない。block 番号などの大きな整数は10進文字列で表す。

| `reason_codes` の案 | 意味 |
|---|---|
| `issuer_not_trusted` / `scope_not_allowed` | 証拠は有効だが、この repo の方針では不採用 |
| `credential_missing` / `publication_missing` | 対象の本文がない、または十分な照会の結果、公開を確認できない |
| `invalid_format` / `invalid_signature` / `subject_mismatch` | 推薦の形式・署名・照合対象が不正 |
| `publication_mismatch` | 指定された公開位置や公開先と証拠が一致しない |
| `revoked` / `expired` | 失効または期限切れ |
| `rpc_unavailable` / `history_unavailable` | 必要な照会を完了できない |

署名・形式・対象が不正なら `invalid`。確認できた失効は期限切れより優先して `revoked` とする。失効の有無を含む評価に必要な履歴が足りない場合は `unavailable` とし、`valid` や `missing` を推定しない。方針を評価するのは証拠が `valid` のときだけとする。

### 案の作成と取得の結果

`request` / `revoke` の JSON は、未送信であることを明示する。

```json
{
  "report_version": 1,
  "command": "revoke",
  "operation_status": "prepared",
  "submitted": false,
  "files": { "request": "revoke-request.json" },
  "next_action": "review_and_submit_with_wallet",
  "error": null
}
```

`request` も同じ項目で `command: request`、`files.request` は案の保存先とする。`fetch` は `operation_status: fetched`、`files.credential` に本文の保存先、指定時だけ `files.publication` に公開位置の保存先を返し、`next_action: verify` とする。

利用・設定・ファイルエラーでは `operation_status: error` と `error.code` / `error.message` を返す。`--json` が指定されていれば失敗時も JSON を出し、空の stdout と成功コードの組み合わせを返さない。

### 終了コード

| コード | `verify` | 案の作成・取得 |
|---:|---|---|
| `0` | `valid / accepted` | 案の保存・取得が完了。公開・失効の送信や推薦の採用を意味しない |
| `1` | `valid / rejected` | 使用しない |
| `2` | `revoked` / `expired` / `invalid` / `missing`、方針は `not_evaluated` | 取得する本文がない、不正な推薦、対象が既に失効・置換されていて失効案を作れない等 |
| `3` | `unavailable / not_evaluated` | RPC・履歴を確認できず、必要な処理を完了できない |
| `4` | 引数・設定・実行環境のエラー | 同左 |
| `5` | ファイルの読み取り権限などのエラー | 出力先の存在、保存失敗など |
| `70` | 予期しない内部エラー | 同左 |

`--credential` の対象ファイルがない場合は `credential_missing` とコード `2`、`--policy` がない・壊れている場合は設定エラーの `4` とする。利用者が明示した `--publication` を読めない場合も、黙って無視せず原因を返す。`verify` のコード `0`〜`3` は検証結果の形式、`4`・`5`・`70` は操作エラーの形式を使う。

help / version は `0`。JSON 表示にしても終了コードの意味は変えない。採否は検証時点の推薦に関するもので、コード品質・マージ許可を意味しない。

## 8. GitHub Actions との接続

Action は次の入力を用意して `verify --json` を呼ぶ。

1. GitHub のイベント・API から PR 作者の数値 ID、対象 repo、base SHA、head SHA を取得する。
2. base SHA から repo 方針、head SHA からその作者の推薦 JSON を取得する。PR のコードを実行せず、一時ファイルとして CLI へ渡す。
3. `--subject` に実際の PR 作者、`--policy` に取得した base 側の方針、`--credential` に推薦ファイルを指定する。公開位置の探索と検証は CLI と共通にする。
4. CLI の JSON に PR・base / head SHA・対象 ID の取得元を添えて Summary を作る。CLI 自体の `subject_source: argument` を、CLI が GitHub 認証したという意味に変えない。

repo の `repositoryId` と対象 repo の対応も Action 側で照合する。推薦ファイルが欠けている場合は `missing` として表示し、別の利用者のファイルを探索して代用しない。

`mode: report` はコード `0`・`1`・`2` を判定完了として表示し、`3`・`4`・`5`・`70` や未知の失敗は Action の失敗にする。JSON が壊れている場合も失敗とし、終了コードだけで成功表示しない。詳細は [導入マニュアル](adoption-guide.md)を参照する。

GitHub token は情報を取得する Action 側で扱う。ローカルの推薦検証に GitHub token は必要ない。ただし、対象が GitHub ID であることや他サービスのアカウントとの対応が未設計である点は変わらない。[残る依存](hackathon-data-model.md#8-停止紛失時と残る依存)を参照する。

## 9. レビューと実装時の確認項目

| 確認したいこと | 完了の目印 |
|---|---|
| CLI 単体で使えるか | GitHub Actions を起動せず、手元のファイルから取得・検証できる |
| 初回操作が分かるか | help から4コマンドの役割と必須引数が分かり、成功表示から次の操作に進める |
| エージェントが処理できるか | 成功・拒否・失効・RPC 障害・利用エラーを JSON と終了コードで区別し、入力待ちにならない |
| 対象を取り違えないか | 別アカウントの推薦を指定すると `subject_mismatch`。ローカル指定を PR 作者の確認済み表示にしない |
| 最新状態を確認するか | 公開位置を省略しても検証でき、失効後は同じ JSON が通らず、履歴不足は `unavailable` |
| 書き込みを誤認しないか | `request` / `revoke` の成功で取引が送られず、未署名・未送信と表示される |
| ローカルファイルを守るか | 既存の出力先を上書きせず、破損入力・出力失敗でも成功表示しない |
| 操作を再開できるか | 公開位置を指定して過去の本文を取得でき、失効案の作成後に公開値が変わったら Web の送信前確認で止まる |

実装時に確定・実測するものは、CLI の配布方式、対応する Ruby / Bun の版、既定 RPC、履歴探索の上限・タイムアウト、ENS の初期化情報の取得方法、Web と受け渡す案の厳密な形式である。本書の追加オプションと JSON 項目もレビュー案として扱い、既存の8時間枠内で通し確認する。

### 未確定の検証契約

次の点は、文書の表現を揃えるだけでは確定できない。実装に入る際に具体的な条件と期待する結果を定める。

| 論点 | 未確定の内容と影響 |
|---|---|
| resolver と実装の扱い | `allowedResolvers` は公開先アドレスと実装の確認に使うが、`implementation` の識別形式・照合方法、許可リスト外と未対応実装の結果分類は未確定。前者を repo の不採用、後者を証拠の検証不能とするかも含めて定める。`valid / rejected` の例は、証拠の有効性を独立に確認できた場合に限る |
| 公開期間中の変更 | `TextUpdated` 以外に、名前と resolver の対応、record のリンク、proxy の実装が途中で変わって元に戻った場合をどう検出・扱うか。現在値と text 更新だけで「未知の変更を通さない」要件を満たしたとはしない |
| 署名と時刻 | EIP-712 の各フィールド型、名前の正規化、ID・nonce の再利用検出範囲、`issuedAt` / `expiresAt` の判定時計と境界、snapshot の確定性を固定する。JSON の構造例だけでは相互運用可能な署名仕様にならない |
| 操作結果の詳細 | Web と受け渡す `request` / `revoke` 案の厳密な形式、`verify` 以外で終了コード `2` / `3` になった場合の JSON を確定する。終了コードだけではエージェント向けのエラー契約は完成しない |

ENS の record はリンクを変更でき、resolver は UUPS proxy として upgrade できる。[公式仕様](https://docs.ens.domains/ensv2/permissioned-resolver/)を根拠に、履歴検証の対象を確認する。具体的な対策を追加契約の導入と決めたものではない。未確定な検証を成功と推定せず、決定内容をデータ構造・ハンドオフ・テストへ揃える。
