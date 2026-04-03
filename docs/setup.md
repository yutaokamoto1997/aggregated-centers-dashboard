# 環境構築手順（ローカル開発 + 個人preview）

本ドキュメントは、GAS開発をローカル（VS Code + clasp）で行い、**個人のpreview用GAS（別scriptId）に `clasp push` して事前検証**できる状態を作るための手順です。

※共有の検証環境（mainマージで自動更新されるdev）や本番デプロイ（Actions手動実行）の手順は、日々の運用マニュアルを参照してください。

- 日々の運用: [manual.md](manual.md)

---

## 1. 前提（必要なもの）

- Node.js / npm
- Google アカウント（Apps Scriptにアクセスできること）
- Git

---

## 1.1. このリポジトリの構成（複数GASプロジェクトを同居管理）

このリポジトリは、複数のGASプロジェクト（= 複数の `scriptId`）を同じGitリポジトリで管理しています。

代表例:

- `src/app/dev`: Webアプリ（共有の検証環境）
- `src/app/prod`: Webアプリ（本番）
- `src/aggregator/dashboard`: 集計バッチ
- `src/aggregator/outsource`: 外部リソース用バッチ

ポイント:

- `clasp` は **「今いるフォルダ」＋「そのフォルダの `.clasp.json`」** を見て、どの `scriptId` に push/pull するか決まります。
- つまり、同じコマンドでも **どのフォルダで実行したか** によって対象プロジェクトが変わります。

---

## 2. clasp の準備（各PCで1回）

### 2.1. clasp を使えるようにする

どちらでもOKです。

- グローバルインストール

```bash
npm i -g @google/clasp
```

- npx で実行（グローバルインストール不要）

```bash
npx -y @google/clasp@latest --version
```

### 2.2. clasp にログインする

```bash
clasp login
```

---

## 3. 個人preview用GAS（別scriptId）の用意

並行開発での衝突を避けるため、開発者ごとに preview 用GASを用意します。

### 3.1. preview用のApps Scriptプロジェクトを作成

- Apps Scriptで新規プロジェクトを作成（例: `app-dev-preview-<name>`）
- Webアプリ（検証URL）としてデプロイ

作成したら、以下を控えます。

- `scriptId`（プロジェクトID）
- deployment のURL（自分が検証に使うURL）

### 3.2. Script Properties の設定（必要な場合）

このリポジトリのGASコードは Script Properties を参照します。

- preview用GAS側にも、必要な Script Properties を設定してください
- 値（フォルダID等）は共有devと同じでも構いませんが、検証で出力先を分けたい場合は preview側で別値にできます

---

## 3.3. 外部リソース（ログ/保存先/ライブラリ）の扱い

このリポジトリのように、GASが外部リソース（スプレッドシート/Driveフォルダ/GASライブラリ）を参照している場合、preview用にGAS（scriptId）を分けるだけでは不十分なことがあります。

### ログ出力（監視ライブラリ/アクセスログ等）

アプリのログイン状況監視などのGASライブラリを使い、ログの書き出し先としてスプレッドシートを使っている場合があります。

この場合の推奨:

- preview環境は **ログ用スプレッドシートを分ける**（環境ごと・開発者ごと）
  - ログが混ざると、調査や監視の妨げになります
  - 誤って本番ログを汚すリスクも下げられます

最低限、preview側の Script Properties（例: `LOG_SPREADSHEET_ID`, `LOG_SHEET_NAME` など）が正しい値になっていることを確認してください。

### 保存先（アプリのsave操作・アップロード・書き出し）

アプリ側でファイル書き出し（CSV生成、添付、アップロード等）がある場合、保存先のDriveフォルダが存在します。

この場合の推奨:

- preview環境は **保存先フォルダを分ける**（環境ごと・開発者ごと）
  - 同じ保存先だと、ファイルの上書き・ゴミ混入・誤削除が起きやすいです

最低限、preview側の Script Properties（例: `OUTPUT_*_FOLDER_ID` や入力/出力フォルダID）が正しい値になっていることを確認してください。

### GASライブラリ

GASプロジェクトにライブラリを追加している場合:

- preview用に新しいscriptIdを作ると、ライブラリは「自動では引き継がれない」ことがあります（追加し直しが必要なケースがあります）
- ライブラリ側が権限やアクセス制限を持つ場合、preview環境でも利用できるように権限付与が必要です

補足:

- 「ライブラリそのものを複製する」必要があるかは、運用次第です
  - 多くの場合、ライブラリは共通のままでOK（利用側の設定/出力先だけ分離する）
  - ライブラリの挙動も環境で切り替えたい場合は、ライブラリのバージョン運用（本番固定/検証先行）も検討してください

---

## 4. ローカルから preview 用scriptIdへ安全に push する

このリポジトリでは `.clasp.json` をgit管理していません。
そのため、**自分のローカルの `.clasp.json` がどのscriptIdを指しているか**が、安全性の最重要ポイントです。

### 4.1. オンボーディング時に共有してもらう情報（必須）

新しく参加した開発者は、既存メンバーから最低限以下の情報を共有してもらってください。

- 各GASプロジェクトの `scriptId`
  - 共有dev（`src/app/dev`）
  - 本番（`src/app/prod`）
  - バッチ（`src/aggregator/dashboard`, `src/aggregator/outsource`）
- 個人preview用GASの `scriptId`（自分用に新規作成する場合は自分で控える）
- Webアプリの検証URL / 本番URL（どれがどの環境か）
- Script Properties に設定すべきキーと値（フォルダID等）

※ `.clasprc.json`（認証情報）を受け取るのではなく、上記の **プロジェクト情報** を受け取るイメージです。

### 4.2. `.clasp.json` をローカルに用意する（各プロジェクトごと）

各フォルダで `clasp push` / `clasp pull` できるように、対象フォルダに `.clasp.json` を用意します。

例: `src/app/dev/.clasp.json`

```json
{
  "scriptId": "<TARGET_SCRIPT_ID>",
  "rootDir": "./"
}
```

注意:

- `.clasp.json` は git 管理しません（コミットしないでください）。
- 誤爆防止のため、push前に `.clasp.json` の `scriptId` を確認する癖を付けてください。

---

## 5. GitHub Actions（共有dev更新 / 本番デプロイ）の準備

Actionsを動かすには、リポジトリのSecrets設定が必要です。
（詳細は運用設計により変わるため、ここでは必要項目名のみ記載します）

- `CLASPRC_JSON_B64`（自分の `~/.clasprc.json` をbase64化したもの）
- `GAS_SCRIPT_ID_APP_DEV`
- `GAS_DEPLOYMENT_ID_APP_DEV`
- `GAS_SCRIPT_ID_APP_PROD`
- `GAS_DEPLOYMENT_ID_APP_PROD`
- `GAS_SCRIPT_ID_AGGREGATOR_DASHBOARD`
- `GAS_SCRIPT_ID_AGGREGATOR_OUTSOURCE`

補足:

- GitHub Actions 用の `CLASPRC_JSON_B64`（= Actionsが使う認証情報）は、基本的にリポジトリ管理者が設定します。
- ローカル開発者は、Secretsを触らなくても `clasp login` によりローカル実行できます。
