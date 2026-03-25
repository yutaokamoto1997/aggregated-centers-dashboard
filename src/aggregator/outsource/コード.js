/**
 * 現場手入力データ(フォルダ内の全ファイル)から中間CSVを生成するバッチ処理
 * 対象: 指定フォルダ内の全てのスプレッドシート/Excelファイル
 * 機能: 複数ファイルのデータを日付ごとにマージし、拠点コード0埋め・コスト補完を行う
 */
function generateIntermediateFiles() {
  // --- 設定 ---
  // ★変更: 単一ファイルIDではなく、入力ファイルが格納されている「フォルダID」を指定
  const SOURCE_FOLDER_ID = '1LGo_ct5bn6LFcNPBRRCUeFJtXm7Qx0ov';
  const OUTPUT_FOLDER_ID = '1g38uOUeEYEau4GMcXgG18hQwmIfOqeZP'; // 中間データ格納フォルダID
  const FILE_PREFIX = '集約拠点_外部リソース_';

  try {
    console.log('中間ファイル生成を開始します...');

    const sourceFolder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
    // Googleスプレッドシート または Excelファイル(.xlsx) を対象とする
    const files = sourceFolder.getFiles();

    // 全ファイルのデータを日付ごとに集約するオブジェクト
    const groupedData = {};
    let fileCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      // スプレッドシート または Excel のみを処理対象とする
      if (mimeType !== MimeType.GOOGLE_SHEETS && mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        continue;
      }

      console.log(`読み込み中: ${file.getName()}`);
      fileCount++;

      try {
        const ss = SpreadsheetApp.open(file);
        const sheet = ss.getSheets()[0]; // 1枚目のシートを対象
        // データ範囲のみ取得（空白行の読み込み防止）
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) continue; // ヘッダーのみまたは空の場合はスキップ

        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        const dataRows = values.slice(1);

        // カラムインデックスの特定
        const idx = {
          date: headers.indexOf('年月日'),
          baseCode: headers.indexOf('集約拠点コード'),
          timeSlot: headers.indexOf('時間帯'),
          type: headers.indexOf('社員区分名称'),
          count: headers.indexOf('投入人数'),
          hours: headers.indexOf('投入時間'),
          totalPay: headers.indexOf('合計支払金額'),
          workVol: headers.indexOf('作業個数'),
          unitPrice: headers.indexOf('個当たり対応'),
          hourlyWage: headers.indexOf('時給（人工）')
        };

        // 必須カラムチェック（ファイルごとにチェック）
        if (idx.date === -1 || idx.baseCode === -1) {
          console.warn(`スキップ: 必須カラム不足 (${file.getName()})`);
          continue;
        }

        // 行ごとの処理
        dataRows.forEach(row => {
          const dateVal = row[idx.date];
          let rawBaseCode = row[idx.baseCode];

          if (!dateVal || !rawBaseCode) return; // 必須項目がない行はスキップ

          // 拠点コードを文字列化し、6桁0埋めを行う
          let baseCode = String(rawBaseCode).trim();
          if (/^\d+$/.test(baseCode) && baseCode.length < 6) {
            baseCode = baseCode.padStart(6, '0');
          }

          // 日付フォーマット整形
          const dateStr = Utilities.formatDate(new Date(dateVal), Session.getScriptTimeZone(), 'yyyy-MM-dd');

          if (!groupedData[dateStr]) groupedData[dateStr] = [];

          // 値の取得と正規化
          let count = Number(row[idx.count]) || 0;
          let hours = Number(row[idx.hours]) || 0;
          let cost = Number(row[idx.totalPay]);

          const typeName = String(row[idx.type] || '');

          // コスト補完ロジック
          if (!cost && cost !== 0) {
            if (typeName.includes('個当たり') && idx.workVol !== -1 && idx.unitPrice !== -1) {
              const vol = Number(row[idx.workVol]) || 0;
              const price = Number(row[idx.unitPrice]) || 0;
              cost = vol * price;
            } else if (typeName.includes('人工') && idx.hourlyWage !== -1) {
              const wage = Number(row[idx.hourlyWage]) || 0;
              cost = hours * wage;
            } else {
              cost = 0;
            }
          }

          // 配列に追加
          groupedData[dateStr].push([
            baseCode,
            row[idx.timeSlot] || '',
            count,
            hours,
            cost
          ].join(','));
        });

      } catch (fileError) {
        console.error(`ファイル読み込みエラー: ${file.getName()} - ${fileError.message}`);
      }
    }

    if (fileCount === 0) {
      console.log('処理対象のファイルが見つかりませんでした。');
      return;
    }

    // 3. 中間フォルダへの書き出し (全ファイル分をまとめて出力)
    const folder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const outputHeader = '集約拠点コード,時間帯,投入人数,投入時間,人的コスト';

    for (const [dateStr, lines] of Object.entries(groupedData)) {
      const fileName = `${FILE_PREFIX}${dateStr}.csv`;
      const csvContent = outputHeader + '\n' + lines.join('\n');

      const existingFiles = folder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }

      folder.createFile(fileName, csvContent, MimeType.CSV);
      console.log(`作成完了: ${fileName} (${lines.length}件)`);
    }

    console.log(`全処理が完了しました。(${fileCount}ファイルを処理)`);

  } catch (e) {
    console.error(`中間ファイル生成エラー: ${e.message}`);
  }
}