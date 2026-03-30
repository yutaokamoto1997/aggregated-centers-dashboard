/**
 * @fileoverview ダッシュボード閲覧専用GAS (Code.gs)
 */

const LOG_SPREADSHEET_ID = '1FVty5A8B18DrJIzXhKde16-5pBcNsU5E4XYe8EeJjjA';
const LOG_SHEET_NAME = 'アクセスログ';

const FOLDERS = {
  output: {
    daily:           '1VOUIgT45cVMiP4JYp8o7yiQkTQEwKl4K',
    weekly_full:     '1k3cJB1Rn4DwXIBg-DKhO80HiXxJKP4oG',
    monthly_full:    '17JzLXnliEYHSqpAbjVbwKThUYGzvVJu8',
    weekly_running:  '1LgUwCFQe1nl5_ktnpA7o6Q52B0Wh5rfk',
    monthly_running: '1imvPQkJHRApG2Qk2VTVDy2teemLRahbc'
  },
  input: { cost: { prefix: 'YTCBIZ人的コスト_歴月収支有_抜粋版_', id: '17Z5k-DPJIR9nYMjPtRBq1PmBJonP9lLO' } }
};

const CSV_PREFIX = {
  daily: '集約拠点_ダッシュボード集計_',
  weekly_full: '集約拠点_ダッシュボード週次_',
  monthly_full: '集約拠点_ダッシュボード月次_',
  weekly_running: '集約拠点_ダッシュボード週累計_',
  monthly_running: '集約拠点_ダッシュボード月累計_'
};

function doGet(e) {
  try { logAccess(e, 'doGet'); } catch(e) {}
  const html = HtmlService.createTemplateFromFile('index').evaluate();
  html.setTitle('大型拠点ダッシュボード');
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function getWebAppInitialData() {
  try {
    const dates = getAllAvailableDates();
    const summaryNotes = `■ 集計ロジック
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
    const costFileName = getLatestCostFileName();

    if (!dates.daily || dates.daily.length === 0) {
      return { availableDates: { daily: [], weekly: [], monthly: [] }, initialData: null, summaryNotes, costFileName, error: 'データが見つかりません。バッチを実行してください。' };
    }
    return { availableDates: dates, initialData: getCsvData('daily', dates.daily[0]), summaryNotes, costFileName };
  } catch (error) { return { error: `初期化エラー: ${error.message}` }; }
}

function getDailyCsvData(d) { return getCsvData('daily', d); }
function getWeeklyRunningData(d) { return getCsvData('weekly_running', d); }
function getMonthlyRunningData(d) { return getCsvData('monthly_running', d); }

function getCsvData(type, dateStr) {
  return parseCsvFromDrive(DriveApp.getFolderById(FOLDERS.output[type]), `${CSV_PREFIX[type]}${dateStr}.csv`);
}

// ★改修: 集計単位(folderKey)を動的に受け取ってデータを返すように変更
function getComparisonData(folderKey, currentStart, previousStart) {
  return { current: getCsvData(folderKey, currentStart), previous: getCsvData(folderKey, previousStart) };
}

function getAllAvailableDates() {
  const getD = (type) => {
    const files = DriveApp.getFolderById(FOLDERS.output[type]).getFiles();
    const dates = new Set();
    const regex = type.includes('monthly') ? /(\d{4}-\d{2})\.csv$/ : /(\d{4}-\d{2}-\d{2})\.csv$/;
    while (files.hasNext()) { const m = files.next().getName().match(regex); if (m) dates.add(m[1]); }
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  };
  return { daily: getD('daily'), weekly: getD('weekly_running'), monthly: getD('monthly_running') };
}

function getLatestCostFileName() {
  const files = DriveApp.getFolderById(FOLDERS.input.cost.id).getFiles();
  let latestFile = null, maxDate = new Date(0);
  while(files.hasNext()){
    const f = files.next();
    if(f.getName().startsWith(FOLDERS.input.cost.prefix) && f.getName().endsWith('.csv') && f.getLastUpdated() > maxDate) { maxDate = f.getLastUpdated(); latestFile = f; }
  }
  return latestFile ? latestFile.getName() : null;
}

function parseCsvFromDrive(folder, fileName) {
  try {
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return { headers: [], data: [] };
    let blob = files.next().getBlob(), csvString = blob.getDataAsString('UTF-8').replace(/^\uFEFF/, '');
    let parsed = Utilities.parseCsv(csvString);
    if (!/拠点|時間|コード|社員|月/.test(parsed[0] ? parsed[0].join('') : '')) {
      try { const sjis = Utilities.parseCsv(blob.getDataAsString('Shift_JIS')); if (/拠点|時間|コード|社員|月/.test(sjis[0].join(''))) parsed = sjis; } catch(e) {}
    }
    if (!parsed || parsed.length < 1) return { headers: [], data: [] };
    const headers = parsed[0].map(h => String(h).replace(/^\uFEFF/, '').trim());
    return { headers, data: parsed.slice(1).map(row => { const obj = {}; headers.forEach((h, i) => obj[h] = row[i] ? String(row[i]).trim() : ''); return obj; }) };
  } catch (e) { return { headers: [], data: [] }; }
}

function logAccess(e, funcName) {
  try {
    const sheet = SpreadsheetApp.openById(LOG_SPREADSHEET_ID).getSheetByName(LOG_SHEET_NAME);
    if(sheet) sheet.appendRow([new Date(), Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(), funcName, (e&&e.parameter)?JSON.stringify(e.parameter):'{}']);
  } catch(err) {}
}