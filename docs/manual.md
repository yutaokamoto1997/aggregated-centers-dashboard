# GAS開発・運用マニュアル（CI/CD運用）

本ドキュメントは、Google Apps Script（GAS）をGitHubで管理し、GitHub Actions（CI/CD）でGASへ反映する運用の「日々やること」を簡潔にまとめたものです。

※環境構築（clasp認証、preview用GASの準備など）は別ドキュメントにまとめています。

- 環境構築手順: [setup.md](setup.md)

---

## 日々の運用（基本：PR → mainマージで自動反映）

### 1) 変更作業（ローカル）

```bash
git switch main
git pull
git switch -c feature/xxxx
```

- コード修正 → ローカルで静的チェック

```bash
npm run lint
npm run format
```

### 2) 検証（個人のpreview環境）

PRを作る前に「手元（ブランチ）の変更」を検証URLで確認します。

開発者ごとに分離された preview 用GAS（別scriptId）へローカルから `clasp push` して確認します。

```bash
cd ./src/app/dev
clasp push
```

注意:

- `clasp push` は **`.clasp.json` に設定されているscriptIdへ上書き**します。
- 共有の検証環境（mainマージで自動更新されるdev）に誤ってpushしないよう、push前に `.clasp.json` のscriptIdを必ず確認してください。

### 3) PR作成（GitHub）

```bash
git add -A
git commit -m "feat: ..."
git push -u origin feature/xxxx
```

- PRを作成し、CI（lint / format:check）が緑になることを確認
- CIが落ちたら、ローカルで直してpush（PRに自動で追記されます）

### 4) mainへマージ（自動で共有の検証環境へ反映）

main にマージされると、GitHub Actions が自動で以下を行います。

- dev: `push + deploy`（検証URLが常に最新になる）
- バッチ（aggregator）: `push`

※この運用が基本なので、通常は手元から `clasp push` を打つ必要はありません。

---

## 本番リリース（手動：GitHub Actionsを実行）

本番（prod）は誤デプロイ防止のため、GitHub Actions の手動実行でデプロイします。

- GitHub → Actions → 本番デプロイ用Workflow → Run workflow
- 実行後、完了ログを確認してURLの挙動を確認

---

## 例外対応（必要なときだけ）

### 1) 共有の検証環境（main反映）をすぐに更新したい

原則として、共有の検証環境（dev）は main マージ時のGitHub Actionsで自動更新します。

どうしても手元から更新する必要がある場合は、関係者に共有した上で実施してください（他人の検証が壊れます）。

### 2) GASエディタで直接編集してしまった

原則としてブラウザでの直接編集は禁止です。万が一発生した場合は、差分を回収してPRにします。

```bash
cd ./src/app/dev
clasp pull
```

---

## 参考：GASのコード管理における3つの状態

GASのコード管理には、以下の3つの状態があることを理解してください。
ローカル（PC）: VS Code等で編集中の最新コード。
最新のコード（HEAD）: push した直後の、ブラウザ（GASエディタ）で見える状態。
デプロイ（本番環境）: 特定の「バージョン」を固定し、ユーザーに公開している状態。

## 参考：手動での作業フロー（clasp）

### 2.1. 作業開始時

他のメンバーの修正を取り込み、最新の状態で開発を始めます。

```bash
git pull
```

### 2.2. コードの反映（検証環境での確認）

ローカルで書いたコードをGASエディタ（最新のコード/HEAD）に反映します。

※本リポジトリでは `-c` や `-P` でのプロジェクト指定が環境によってうまく動かないことがあるため、「対象フォルダへ移動してから実行」する運用に統一します。

例：アプリ（検証環境/dev）に反映する場合

```bash
cd ./src/app/dev
clasp push
```

開発中に「保存したら自動で push」したい場合（watch モード）

```bash
cd ./src/app/dev
clasp push --watch
```

補足:

- watch モードは、非無視（`.claspignore` の対象外）のファイルが変更されるたびに自動で push します。
- 停止するには `Ctrl + C` を押します。
- 誤って別プロジェクト（prod 等）に push しないよう、必ず `cd` したフォルダを確認してから実行してください。

注意: push はGASエディタ上のコードを強制的に上書きします。
この時点では、本番公開されているURLの動きは変わりません。

### 2.3. GitHub への記録

動作確認が完了したら、GitHubに履歴を保存します。

```bash
git add .
git commit -m "feat: 〇〇拠点の集計ロジックを追加"
git push origin feature/作業ブランチ名
```

### 3. リリース作業（バージョンとデプロイの発行）

検証環境でのテストが完了し、本番環境へ反映する際の手順です。
3.1. バージョンの発行（スナップショットの作成）
現在のコードに「版」の名前をつけて保存します。

```bash
cd ./src/app/prod
clasp version "20240501_〇〇機能リリース版"
```

#### 3.2. デプロイの実行（本番公開）

特定のデプロイID（本番用URL）の中身を、最新のバージョンに差し替えます。

##### 本番デプロイIDを指定して上書き更新

```bash
cd ./src/app/prod
clasp deploy -i [デプロイID] -d "説明文"
```

メリット: URLを変更せずに、中身のロジックだけを最新化できます。

### 4. ブラウザ（GASエディタ）で編集した場合の対処

原則としてブラウザでの直接編集は禁止ですが、万が一編集が発生した場合は以下の手順で同期を行います。

#### 4.1. ブラウザの変更を「ローカル」に取り込む場合

ブラウザ側が「正しい（最新）」状態であるとき。
例：dev を取り込む場合

```bash
cd ./src/app/dev
clasp pull
```

例：prod を取り込む場合

```bash
cd ./src/app/prod
clasp pull
```

実行後、Gitの差分として認識されます。内容を確認し git commit してください。

#### 4.2. ローカルで「ブラウザの変更」を上書きする場合

ブラウザでの編集が誤りで、ローカルの状態に戻したいとき。
例：dev をブラウザへ上書きする場合

```bash
cd ./src/app/dev
clasp push
```

例：prod をブラウザへ上書きする場合

```bash
cd ./src/app/prod
clasp push
```

警告: ブラウザ側で行った未保存・未プル（Pull）の変更は、跡形もなく消去されます。

---

## 便利コマンド・チートシート（clasp）

| やりたいこと                       | コマンド                                                                               | 補足                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| dev を pull（GAS → ローカル）      | <pre><code>cd ./src/app/dev <br>clasp pull</code></pre>                                | ブラウザ側の変更をローカルへ同期。差分は Git で確認。                   |
| dev を push（ローカル → GAS）      | <pre><code>cd ./src/app/dev <br>clasp push</code></pre>                                | ブラウザ側（HEAD）をローカルで上書き。                                  |
| dev を push（watch）               | <pre><code>cd ./src/app/dev <br>clasp push --watch</code></pre>                        | 保存のたびに自動 push。停止は `Ctrl + C`。                              |
| push 対象ファイルの確認            | <pre><code>cd ./src/app/dev <br>clasp status</code></pre>                              | 送信されるファイル一覧を確認。                                          |
| prod を pull（GAS → ローカル）     | <pre><code>cd ./src/app/prod <br>clasp pull</code></pre>                               | 本番側の編集が混入したときの回収に使用。                                |
| prod を push（ローカル → GAS）     | <pre><code>cd ./src/app/prod <br>clasp push</code></pre>                               | 本番プロジェクトのブラウザ側（HEAD）を更新（デプロイURLは変わらない）。 |
| バージョン作成（スナップショット） | <pre><code>cd ./src/app/prod <br>clasp version "説明"</code></pre>                     | 例：`20240501_〇〇機能リリース版`                                       |
| バージョン一覧の取得               | <pre><code>cd ./src/app/prod <br>clasp versions</code></pre>                           | 必要なら `scriptId` を引数で指定して取得できます。                      |
| デプロイ一覧の取得                 | <pre><code>cd ./src/app/prod <br>clasp deployments</code></pre>                        | 必要なら `scriptId` を引数で指定して取得できます。                      |
| デプロイ（URLは維持して中身更新）  | <pre><code>cd ./src/app/prod <br>clasp deploy -i [デプロイID] -d "説明文"</code></pre> | 直近のバージョンへ更新。                                                |
| デプロイの削除                     | <pre><code>cd ./src/app/prod <br>clasp undeploy [デプロイID]</code></pre>              | 取り消し（URL停止）。                                                   |
| 直近ログを追う                     | <pre><code>cd ./src/app/prod <br>clasp logs</code></pre>                               | （必要に応じて）事前に Cloud Logging をセットアップします。             |

---

## Lint / Format

```bash
npm run lint
npm run format
```

---

## CI/CD（GitHub Actions）

- PR: `npm run lint` / `npm run format:check`
- mainマージ: 自動で dev を `push + deploy`、バッチは `push`
- 本番: Actionsの手動実行でデプロイ（prod）

※Secretsやclasp認証などの準備手順は別途ドキュメントにまとめます。
