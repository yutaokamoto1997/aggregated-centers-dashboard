# GAS開発・運用マニュアル：clasp & GitHub 連携編

本ドキュメントは、Google Apps Script（GAS）をローカル環境で開発し、claspおよびGitHubを用いてバージョン管理を行うための標準運用フローをまとめたものです。

## 1. 基本的な考え方：3つの状態

GASのコード管理には、以下の3つの状態があることを理解してください。
ローカル（PC）: VS Code等で編集中の最新コード。
最新のコード（HEAD）: push した直後の、ブラウザ（GASエディタ）で見える状態。
デプロイ（本番環境）: 特定の「バージョン」を固定し、ユーザーに公開している状態。

## 2. 日常の作業フロー（コードの変更と反映）

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

## 3. リリース作業（バージョンとデプロイの発行）

検証環境でのテストが完了し、本番環境へ反映する際の手順です。
3.1. バージョンの発行（スナップショットの作成）
現在のコードに「版」の名前をつけて保存します。
```bash
cd ./src/app/prod
clasp version "20240501_〇〇機能リリース版"
```
### 3.2. デプロイの実行（本番公開）

特定のデプロイID（本番用URL）の中身を、最新のバージョンに差し替えます。

#### 本番デプロイIDを指定して上書き更新

```bash
cd ./src/app/prod
clasp deploy -i [デプロイID] -d "説明文"
```

メリット: URLを変更せずに、中身のロジックだけを最新化できます。

## 4. ブラウザ（GASエディタ）で編集した場合の対処

原則としてブラウザでの直接編集は禁止ですが、万が一編集が発生した場合は以下の手順で同期を行います。

### 4.1. ブラウザの変更を「ローカル」に取り込む場合

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

### 4.2. ローカルで「ブラウザの変更」を上書きする場合

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

| やりたいこと | コマンド | 補足 |
|---|---|---|
| dev を pull（GAS → ローカル） | <pre><code>cd ./src/app/dev <br>clasp pull</code></pre> | ブラウザ側の変更をローカルへ同期。差分は Git で確認。 |
| dev を push（ローカル → GAS） | <pre><code>cd ./src/app/dev <br>clasp push</code></pre> | ブラウザ側（HEAD）をローカルで上書き。 |
| dev を push（watch） | <pre><code>cd ./src/app/dev <br>clasp push --watch</code></pre> | 保存のたびに自動 push。停止は `Ctrl + C`。 |
| push 対象ファイルの確認 | <pre><code>cd ./src/app/dev <br>clasp status</code></pre> | 送信されるファイル一覧を確認。 |
| prod を pull（GAS → ローカル） | <pre><code>cd ./src/app/prod <br>clasp pull</code></pre> | 本番側の編集が混入したときの回収に使用。 |
| prod を push（ローカル → GAS） | <pre><code>cd ./src/app/prod <br>clasp push</code></pre> | 本番プロジェクトのブラウザ側（HEAD）を更新（デプロイURLは変わらない）。 |
| バージョン作成（スナップショット） | <pre><code>cd ./src/app/prod <br>clasp version "説明"</code></pre> | 例：`20240501_〇〇機能リリース版` |
| バージョン一覧の取得 | <pre><code>cd ./src/app/prod <br>clasp versions</code></pre> | 必要なら `scriptId` を引数で指定して取得できます。 |
| デプロイ一覧の取得 | <pre><code>cd ./src/app/prod <br>clasp deployments</code></pre> | 必要なら `scriptId` を引数で指定して取得できます。 |
| デプロイ（URLは維持して中身更新） | <pre><code>cd ./src/app/prod <br>clasp deploy -i [デプロイID] -d "説明文"</code></pre> | 直近のバージョンへ更新。 |
| デプロイの削除 | <pre><code>cd ./src/app/prod <br>clasp undeploy [デプロイID]</code></pre> | 取り消し（URL停止）。 |
| 直近ログを追う | <pre><code>cd ./src/app/prod <br>clasp logs</code></pre> | （必要に応じて）事前に Cloud Logging をセットアップします。 |
