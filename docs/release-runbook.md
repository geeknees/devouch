# デモ公開の手順

公開対象は `geeknees/devouch` と `dist/web/` の静的画面。
ユーザー承認に基づき2026-09-26 JSTにrepoとGitHub Pagesを公開した。
実施結果は [公開の検証記録](release-evidence.md)。以下は再配信にも使う操作手順。

準備用の `codex/demo-release-20260926` はユーザー承認後にpushし、[draft PR #1](https://github.com/geeknees/devouch/pull/1) を作成した。
そのhead `5e1afca6aa3d72567e4c7ab70f9b8d851544aca2` のTestと、推薦ファイルなしのAction reportはGitHub上で成功した。
最終head `28409191fa62e17b1e8c22e413fac994c2237943` の全チェック成功後、ユーザー承認を得てmergeした。
merge commit `3214991e616e118d921ea9575d06d5e121b584f4` のCIとPages配信も成功した。

## 配布物

| 用途 | 固定するもの |
|---|---|
| PRの推薦検証 | Devouch commit `9ce4525f269f590d4d8fd0e123ff35d33dce8efa` |
| 導入先の方針 | [`.devouch/policy.json`](../.devouch/policy.json) |
| 導入workflow | [`.github/workflows/devouch.yml`](../.github/workflows/devouch.yml) |
| 静的画面 | `dist/web/` の5ファイルだけ |
| 公開workflow | [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) |
| 公開URL | https://geeknees.github.io/devouch/ 。認証なしの取得とブラウザ操作を確認済み |

固定したAction commitはローカルで検証済み。認証なしで公開ファイルを取得し、検証済み内容との一致も確認した。
その後の文書や公開workflowのcommitと、検証Actionの固定commitは別でよい。
Actionを更新するときは、ソース・配布物の一致とテストを確認し、固定先を更新する。

## 公開時に行うこと

1. 公開するcommitと差分を確認し、privacy-checkの全ファイル・履歴検査を行う。
   ローカルの `.devouch/local/`、鍵、token、rawログを公開物へ追加しない。
   台本の氏名は現在placeholderだが既存履歴には残る。Gitの作者・committerの氏名と個人メール、提出フォーム画像のイニシャルも確認する。
   これら3種類は2026-09-26にユーザーから公開可の確認を得ている。新たな混入を検査し、既存履歴は維持する。[検査結果](implementation-status.md#公開前の検査)を参照する。
2. 保護branchへ直接pushせず、通常のreview経路で公開対象の変更をremoteへ反映する。
   リポジトリのvisibility変更は、ユーザーが指定したデモ時の操作として別に実行する。
3. 公開repoと固定Action commitが未認証で取得できることを確認し、公開commitのTest workflow成功を確認する。
4. Repository Settings → Pages → Build and deployment → Sourceを **GitHub Actions** にする。
   PATやwallet keyは登録不要。Pagesとdeployment environmentの既存保護ルールを維持する。
5. Actions → **Publish workspace** → Run workflowで **main** を選ぶ。
   このworkflowは手動実行だけで、pushやPRではdeployしない。公開するのはcommit済みの `dist/web/`。
6. 実行結果のdeployment URLを開き、ページ本体・CSS・JavaScript・ロゴ・licenseを取得する。
   `/devouch/` 配下で操作タブが動き、wallet接続前に送信がないことも確認する。
7. live URLとAction run URLを [実装状況](implementation-status.md)、[実機手順](demo-runbook.md)、提出欄へ記録する。

Pagesは [GitHub公式のcustom workflow手順](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に沿って構成した。
外部Actionsは取得確認した40桁SHAで固定し、Pagesのwrite権限はdeploy jobに限定している。
他のHTTPSホストへ変更する場合も `dist/web/` をそのまま配布できる。
ローカルの `node scripts/serve.ts` は引き続き独立して使える。

## PRデモの確認

masusanouの [fork PR #2](https://github.com/geeknees/devouch/pull/2) は、
推薦原本 `.devouch/vouches/github-287365775.json` を含み、valid / acceptedを確認済み。
本人walletでの公開、CLI比較、実PR作者とhead/base SHA、原本と方針のdigest、Actionの判定値は
[Sepolia検証記録](demo-evidence.md)に記録した。通常CIも成功し、PRはこの確認時点では未merge。
masusanouのPR確認はこれで完了。2026-09-26のユーザー指定により、失効はPRでは検証しない。
本人walletからの実失効と同じ原本によるCLI確認は別の確認項目として、[実機手順](demo-runbook.md)に証拠を残す。
