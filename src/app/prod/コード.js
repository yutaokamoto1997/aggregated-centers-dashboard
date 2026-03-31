/**
 * @fileoverview 大型拠点ダッシュボード バックエンド処理 (完全版: 外部リソース連携対応)
 */

// --- 設定エリア ---
// NOTE: 本番稼働中のため、移行期間は「Script Properties 未設定でも動く」ように
//       既存値へフォールバックします。プロパティ設定が完了したらフォールバックを削除してください。
const SCRIPT_PROPERTY_KEYS = {
  LOG_SPREADSHEET_ID: 'LOG_SPREADSHEET_ID',
  LOG_SHEET_NAME: 'LOG_SHEET_NAME',
  INPUT_WORKVOLUME_FOLDER_ID: 'INPUT_WORKVOLUME_FOLDER_ID',
  INPUT_MANPOWER_FOLDER_ID: 'INPUT_MANPOWER_FOLDER_ID',
  INPUT_OUTSOURCING_FOLDER_ID: 'INPUT_OUTSOURCING_FOLDER_ID',
  INPUT_COST_FOLDER_ID: 'INPUT_COST_FOLDER_ID',
  INPUT_TIMEE_FOLDER_ID: 'INPUT_TIMEE_FOLDER_ID'
};

const LEGACY_CONFIG = {
  [SCRIPT_PROPERTY_KEYS.LOG_SPREADSHEET_ID]: '1FVty5A8B18DrJIzXhKde16-5pBcNsU5E4XYe8EeJjjA',
  [SCRIPT_PROPERTY_KEYS.LOG_SHEET_NAME]: 'アクセスログ',
  [SCRIPT_PROPERTY_KEYS.INPUT_WORKVOLUME_FOLDER_ID]: '1llD95sgV5c7Cg_OiWOjTQz3NBb1gFyWO',
  [SCRIPT_PROPERTY_KEYS.INPUT_MANPOWER_FOLDER_ID]: '1HIrPENYqUB7U1jJq9WXstsVuKYO51hqB',
  [SCRIPT_PROPERTY_KEYS.INPUT_OUTSOURCING_FOLDER_ID]: '1g38uOUeEYEau4GMcXgG18hQwmIfOqeZP',
  [SCRIPT_PROPERTY_KEYS.INPUT_COST_FOLDER_ID]: '17Z5k-DPJIR9nYMjPtRBq1PmBJonP9lLO',
  [SCRIPT_PROPERTY_KEYS.INPUT_TIMEE_FOLDER_ID]: '1yl8nnhWL_U7kUYZEU4ewXN0Nr9I1sp8I'
};

function getScriptPropertyString_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value !== null && value !== '') return value;
  if (fallback !== undefined && fallback !== null && fallback !== '') {
    console.warn(`Script property "${key}" is not set. Falling back to legacy value.`);
    return fallback;
  }
  throw new Error(`Missing required script property: ${key}`);
}

function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  const result = { set: [], skipped: [] };
  Object.keys(LEGACY_CONFIG).forEach((key) => {
    const current = props.getProperty(key);
    if (current === null || current === '') {
      props.setProperty(key, String(LEGACY_CONFIG[key]));
      result.set.push(key);
    } else {
      result.skipped.push(key);
    }
  });
  console.log(JSON.stringify(result));
  return result;
}

function getLogSpreadsheetId_() {
  return getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.LOG_SPREADSHEET_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.LOG_SPREADSHEET_ID]);
}

function getLogSheetName_() {
  return getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.LOG_SHEET_NAME, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.LOG_SHEET_NAME]);
}

// 各種データファイルの定義
const FILE_DEFINITIONS = {
  workVolume: {
    prefix: '集約拠点_作業個数_時間帯別_',
    key: 'workVolumeData',
    folderId: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_WORKVOLUME_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_WORKVOLUME_FOLDER_ID])
  },
  manpower: {
    prefix: '集約拠点_人員数_投入時間_時間帯別_',
    key: 'manpowerData',
    folderId: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_MANPOWER_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_MANPOWER_FOLDER_ID])
  },
  // 【追加】外部リソース（派遣・委託）用の中間データ設定
  outsourcing: {
    prefix: '集約拠点_外部リソース_',
    key: 'outsourcingData',
    folderId: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_OUTSOURCING_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_OUTSOURCING_FOLDER_ID])
  },
  cost: {
    prefix: 'YTCBIZ人的コスト_歴月収支有_抜粋版_',
    key: 'costData',
    folderId: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_COST_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_COST_FOLDER_ID])
  },
  timee: {
    // Pythonで生成されたファイル (yyyymmdd_タイミー実績.csv)
    folderId: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_TIMEE_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_TIMEE_FOLDER_ID]),
    key: 'timeeData',
    suffix: '_タイミー実績.csv'
  }
};
const FILENAME_SUFFIX = '.csv';

/**
 * Webアプリのエントリーポイント
 */
function doGet(e) {
  try {
    logAccess(e, 'doGet', getLogSpreadsheetId_(), getLogSheetName_());
  } catch(logError) {
    console.error(`ログ記録エラー: ${logError}`);
  }

  const html = HtmlService.createTemplateFromFile('index').evaluate();
  html.setTitle('大型拠点ダッシュボード');
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

/**
 * 解説文の取得
 */
function getSummaryNotes() {
  return `■ 集計ロジック
1. 作業個数:
    - 各時間帯で、持出・保管・異常・コレ確を入力した伝票番号の重複なし件数を集計。
2. 投入時間・人数:
    - 自社（フル/パート/アルバイト/YSS）、タイミー、および「外部リソース（派遣・委託）」の合算。
    - 投入時間などの項目は「＋」ボタンで内訳（自社/タイミー/外部リソース）を展開可能です。
3. 人的コスト:
    - 自社: 「YTCBIZ人的コスト」の単純時給 × 投入時間で算出。
    - タイミー: 実績ファイル内の「合計支払金額」を加算。
    - 外部リソース: 現場入力の「合計支払金額」または「個当たり単価/時給」から算出。
4. 個当たりコスト:
    - 全コスト合計 / 作業個数 で算出。`;
}

/**
 * 初期データの取得
 */
function getWebAppInitialData() {
  try {
    const availableDates = getAvailableDates();
    const summaryNotes = getSummaryNotes();

    if (availableDates.length === 0) {
      return {
        availableDates: [],
        initialData: null,
        summaryNotes: summaryNotes,
        error: 'データフォルダに日付付きのファイルが見つかりません。'
      };
    }

    // 最新の日付データを取得
    const latestDate = availableDates[0];
    const initialData = getDataForDate(latestDate);

    return { availableDates, initialData, summaryNotes };

  } catch (error) {
    console.error(`初期化エラー: ${error.stack}`);
    return {
      availableDates: [],
      initialData: null,
      summaryNotes: getSummaryNotes(),
      error: `初期データの読み込みに失敗しました: ${error.message}`
    };
  }
}

/**
 * 指定日付のデータを取得
 * @param {string} dateString 'YYYY-MM-DD'
 */
function getDataForDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('無効な日付形式です。YYYY-MM-DD形式で指定してください。');
  }

  const data = {};

  // 1. 通常の日次データ取得 (workVolume, manpower, outsourcing)
  ['workVolume', 'manpower', 'outsourcing'].forEach(key => {
    const def = FILE_DEFINITIONS[key];
    const folder = DriveApp.getFolderById(def.folderId);
    const fileName = `${def.prefix}${dateString}${FILENAME_SUFFIX}`;
    data[def.key] = parseCsvFromDrive(folder, fileName);
  });

  // 2. コストマスタ取得 (最新)
  const costDef = FILE_DEFINITIONS.cost;
  data[costDef.key] = getLatestFileFromDrive(costDef.folderId, costDef.prefix, FILENAME_SUFFIX);

  // 3. タイミーデータ取得 (yyyy-mm-dd -> yyyymmdd)
  const timeeDateStr = dateString.replace(/-/g, '');
  const timeeDef = FILE_DEFINITIONS.timee;
  const timeeFolder = DriveApp.getFolderById(timeeDef.folderId);
  const timeeFileName = `${timeeDateStr}${timeeDef.suffix}`;

  const timeeResult = parseCsvFromDrive(timeeFolder, timeeFileName);
  data[timeeDef.key] = timeeResult;

  // ★ タイミー実績が存在するか判定
  const isTimeeReflected = (timeeResult.headers && timeeResult.headers.length > 0 && timeeResult.data && timeeResult.data.length > 0);
  data.isTimeeReflected = isTimeeReflected;

  return data;
}

/**
 * 日付リストの取得 (作業個数フォルダを正とする)
 */
function getAvailableDates() {
  const folder = DriveApp.getFolderById(FILE_DEFINITIONS.workVolume.folderId);
  const files = folder.getFiles();
  const dates = new Set();
  const prefix = FILE_DEFINITIONS.workVolume.prefix;
  const suffix = FILENAME_SUFFIX;

  const dateRegex = new RegExp(`^${prefix}(\\d{4}-\\d{2}-\\d{2})${suffix}$`);

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const match = fileName.match(dateRegex);
    if (match && match[1]) {
      dates.add(match[1]);
    }
  }
  // 降順ソート
  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}

/**
 * 最新ファイルの取得 (コストマスタ用)
 */
function getLatestFileFromDrive(folderId, prefix, suffix) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  let latestFile = null;
  let latestDate = new Date(0);

  while(files.hasNext()){
    const file = files.next();
    if(file.getName().startsWith(prefix) && file.getName().endsWith(suffix)) {
      const lastUpdated = file.getLastUpdated();
      if (lastUpdated > latestDate) {
        latestDate = lastUpdated;
        latestFile = file;
      }
    }
  }

  if (latestFile) {
    const parsedResult = parseCsvFromDrive(null, latestFile.getName(), latestFile);
    parsedResult.fileName = latestFile.getName();
    return parsedResult;
  }
  return { headers: [], data: [], fileName: null };
}

/**
 * CSVパース処理 (共通)
 */
function parseCsvFromDrive(folder, fileName, fileObject = null) {
  try {
    let file;
    if (fileObject) {
      file = fileObject;
    } else {
      const files = folder.getFilesByName(fileName);
      if (!files.hasNext()) {
        return { headers: [], data: [] };
      }
      file = files.next();
    }

    const csvString = file.getBlob().getDataAsString('UTF-8');
    const cleanCsvString = csvString.replace(/^\uFEFF/, ''); // BOM除去
    const parsedData = Utilities.parseCsv(cleanCsvString);

    if (!parsedData || parsedData.length < 1) return { headers: [], data: [] };

    const headers = parsedData[0].map(h => String(h).trim());
    const rows = parsedData.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ? row[i].trim() : '';
      });
      return obj;
    });
    return { headers: headers, data: rows };
  } catch(e) {
    console.error(`CSVパース失敗: "${fileName}": ${e.stack}`);
    return { headers: [], data: [] };
  }
}

/**
 * アクセスログ記録
 */
function logAccess(e, functionName, spreadsheetId, sheetName) {
  try {
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    const user = userEmail ? userEmail : Session.getEffectiveUser().getEmail();
    const params = (e && e.parameter) ? JSON.stringify(e.parameter) : '{}';
    const logData = [timestamp, user, functionName, params];

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (sheet) sheet.appendRow(logData);
  } catch (error) {
    console.error('ログ記録失敗: ' + error.toString());
  }
}