/**
 * @fileoverview 集約拠点ダッシュボード 集計バッチ専用GAS (縦結合 ＆ 結合データ参照型 累計ロジック)
 * ※BOMに起因するパース不具合（合計と平均が同じになる問題）修正済み
 */

// NOTE: 稼働中のバッチのため、移行期間は「Script Properties 未設定でも動く」ように
//       既存値へフォールバックします。プロパティ設定が完了したらフォールバックを削除してください。
const SCRIPT_PROPERTY_KEYS = {
  OUTPUT_DAILY_FOLDER_ID: 'OUTPUT_DAILY_FOLDER_ID',
  OUTPUT_WEEKLY_FULL_FOLDER_ID: 'OUTPUT_WEEKLY_FULL_FOLDER_ID',
  OUTPUT_MONTHLY_FULL_FOLDER_ID: 'OUTPUT_MONTHLY_FULL_FOLDER_ID',
  OUTPUT_WEEKLY_RUNNING_FOLDER_ID: 'OUTPUT_WEEKLY_RUNNING_FOLDER_ID',
  OUTPUT_MONTHLY_RUNNING_FOLDER_ID: 'OUTPUT_MONTHLY_RUNNING_FOLDER_ID',

  INPUT_WORKVOLUME_FOLDER_ID: 'INPUT_WORKVOLUME_FOLDER_ID',
  INPUT_MANPOWER_FOLDER_ID: 'INPUT_MANPOWER_FOLDER_ID',
  INPUT_OUTSOURCING_FOLDER_ID: 'INPUT_OUTSOURCING_FOLDER_ID',
  INPUT_COST_FOLDER_ID: 'INPUT_COST_FOLDER_ID',
  INPUT_TIMEE_FOLDER_ID: 'INPUT_TIMEE_FOLDER_ID'
};

const LEGACY_CONFIG = {
  [SCRIPT_PROPERTY_KEYS.OUTPUT_DAILY_FOLDER_ID]: '1VOUIgT45cVMiP4JYp8o7yiQkTQEwKl4K',
  [SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_FULL_FOLDER_ID]: '1k3cJB1Rn4DwXIBg-DKhO80HiXxJKP4oG',
  [SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_FULL_FOLDER_ID]: '17JzLXnliEYHSqpAbjVbwKThUYGzvVJu8',
  [SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_RUNNING_FOLDER_ID]: '1LgUwCFQe1nl5_ktnpA7o6Q52B0Wh5rfk',
  [SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_RUNNING_FOLDER_ID]: '1imvPQkJHRApG2Qk2VTVDy2teemLRahbc',

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

const FOLDERS = {
  output: {
    daily:           getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.OUTPUT_DAILY_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.OUTPUT_DAILY_FOLDER_ID]),
    weekly_full:     getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_FULL_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_FULL_FOLDER_ID]),
    monthly_full:    getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_FULL_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_FULL_FOLDER_ID]),
    weekly_running:  getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_RUNNING_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.OUTPUT_WEEKLY_RUNNING_FOLDER_ID]),
    monthly_running: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_RUNNING_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.OUTPUT_MONTHLY_RUNNING_FOLDER_ID])
  },
  input: {
    workVolume:  { prefix: '集約拠点_作業個数_時間帯別_',       id: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_WORKVOLUME_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_WORKVOLUME_FOLDER_ID]) },
    manpower:    { prefix: '集約拠点_人員数_投入時間_時間帯別_', id: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_MANPOWER_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_MANPOWER_FOLDER_ID]) },
    outsourcing: { prefix: '集約拠点_外部リソース_',             id: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_OUTSOURCING_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_OUTSOURCING_FOLDER_ID]) },
    cost:        { prefix: 'YTCBIZ人的コスト_歴月収支有_抜粋版_', id: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_COST_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_COST_FOLDER_ID]) },
    timee:       { prefix: '', suffix: '_タイミー実績.csv',   id: getScriptPropertyString_(SCRIPT_PROPERTY_KEYS.INPUT_TIMEE_FOLDER_ID, LEGACY_CONFIG[SCRIPT_PROPERTY_KEYS.INPUT_TIMEE_FOLDER_ID]) }
  }
};

const CSV_PREFIX = {
  daily: '集約拠点_ダッシュボード集計_',
  weekly_full: '集約拠点_ダッシュボード週次_',
  monthly_full: '集約拠点_ダッシュボード月次_',
  weekly_running: '集約拠点_ダッシュボード週累計_',
  monthly_running: '集約拠点_ダッシュボード月累計_'
};

// ==========================================
// 1. トリガー・実行用関数
// ==========================================
function runDailyAggregation() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  processSingleDayBatch(Utilities.formatDate(date, 'JST', 'yyyy-MM-dd'));
}

function processSingleDayBatch(dateStr) {
  try {
    createDailyCsv(dateStr);
    updatePeriodTotals(dateStr);
    console.log(`${dateStr} 完了`);
  } catch (e) { console.error(`${dateStr} 失敗: ${e.message}`); }
}

function runAggregationForSpecificPeriod() {
  const TARGET_START = '2026-01-01';
  const TARGET_END   = '2026-03-31';

  const SCRIPT_START_TIME = new Date().getTime();
  const PROCESSED_DATES_KEY = 'AGG_PROCESSED_DATES_PERIOD';
  const TRIGGER_FUNC = 'runAggregationForSpecificPeriod';

  const files = DriveApp.getFolderById(FOLDERS.input.workVolume.id).getFiles();
  const dates = new Set(), regex = new RegExp(`^${FOLDERS.input.workVolume.prefix}(\\d{4}-\\d{2}-\\d{2})\\.csv$`);
  while (files.hasNext()) { const m = files.next().getName().match(regex); if (m) dates.add(m[1]); }
  const allDates = Array.from(dates).sort();

  const targetDates = allDates.filter(d => d >= TARGET_START && d <= TARGET_END);
  if (targetDates.length === 0) return console.log(`指定期間 (${TARGET_START} ～ ${TARGET_END}) のデータが見つかりません。`);

  const props = PropertiesService.getScriptProperties();
  const processed = props.getProperty(PROCESSED_DATES_KEY) ? JSON.parse(props.getProperty(PROCESSED_DATES_KEY)) : [];
  const pending = targetDates.filter(d => !processed.includes(d));

  if (pending.length === 0) {
    props.deleteProperty(PROCESSED_DATES_KEY);
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === TRIGGER_FUNC) ScriptApp.deleteTrigger(t); });
    return console.log(`★ 指定期間 (${TARGET_START} ～ ${TARGET_END}) の集計はすべて完了しています。`);
  }

  for (let i = 0; i < pending.length; i++) {
    if (new Date().getTime() - SCRIPT_START_TIME > 240000) {
      props.setProperty(PROCESSED_DATES_KEY, JSON.stringify(processed));
      ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === TRIGGER_FUNC) ScriptApp.deleteTrigger(t); });
      ScriptApp.newTrigger(TRIGGER_FUNC).timeBased().after(60000).create();
      return;
    }
    try {
      console.log(`処理中: ${pending[i]}`);
      processSingleDayBatch(pending[i]);
      processed.push(pending[i]);
    } catch (e) {
      console.error(`エラー ${pending[i]}: ${e.message}`);
      processed.push(pending[i]);
    }
  }

  props.deleteProperty(PROCESSED_DATES_KEY);
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === TRIGGER_FUNC) ScriptApp.deleteTrigger(t); });
  console.log(`★ 指定期間 (${TARGET_START} ～ ${TARGET_END}) 全完了！`);
}

// ==========================================
// 2. 集計ロジック本体
// ==========================================
function getNum(val) { return parseFloat(val) || 0.0; }
function getInt(val) { return parseInt(val, 10) || 0; }
function formatDate(date) { return Utilities.formatDate(date, "JST", "yyyy-MM-dd"); }
function formatMonth(date) { return Utilities.formatDate(date, "JST", "yyyy-MM"); }

function parseBlobSafely(file) {
  let text = file.getBlob().getDataAsString("utf-8");

  // ★修正: CSVとして解析する前に、テキスト全体からBOMを完全に除去する
  text = text.replace(/^\uFEFF/, '');

  if (!text.match(/拠点|時間|コード|社員|月/)) {
    text = file.getBlob().getDataAsString("MS932");
  }

  const csvData = Utilities.parseCsv(text);
  if (!csvData || csvData.length < 2) return [];

  // 先頭でBOMは消去済みなのでtrim()のみで処理
  const headers = csvData[0].map(h => h.trim());
  return csvData.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, j) => obj[h] = row[j] ? row[j].trim() : "");
    return obj;
  });
}

function getCsvDataFromInputBlob(type, opts) {
  const f = DriveApp.getFolderById(FOLDERS.input[type].id);
  for(let n of opts) {
    const files = f.searchFiles(`title = '${FOLDERS.input[type].prefix}${n}${FOLDERS.input[type].suffix || '.csv'}'`);
    if(files.hasNext()) return { data: parseBlobSafely(files.next()) };
  }
  return { data: [] };
}

function uploadCsv(folderId, name, rows, headers) {
  const f = DriveApp.getFolderById(folderId), files = f.searchFiles(`title = '${name}'`);
  const content = "\uFEFF" + [headers.map(h => `"${h}"`).join(',')].concat(rows.map(r => r.map(c => `"${c}"`).join(','))).join('\n');
  if(files.hasNext()) files.next().setContent(content); else f.createFile(Utilities.newBlob(content, "text/csv", name));
}

function createDailyCsv(dateStr) {
  const dsNoHyphen = dateStr.replace(/-/g, '');
  const raw = {
    wv: getCsvDataFromInputBlob('workVolume', [dateStr, dsNoHyphen]),
    mp: getCsvDataFromInputBlob('manpower', [dateStr, dsNoHyphen]),
    os: getCsvDataFromInputBlob('outsourcing', [dateStr, dsNoHyphen]),
    tm: getCsvDataFromInputBlob('timee', [dsNoHyphen, dateStr]),
    cost: { data: [], name: '不明' }
  };

  const dt = new Date(dateStr);
  for(let i=0; i<12; i++) {
    const files = DriveApp.getFolderById(FOLDERS.input.cost.id).searchFiles(`title = '${FOLDERS.input.cost.prefix}${Utilities.formatDate(new Date(dt.getFullYear(), dt.getMonth()-i, 1), "JST", "yyyyMM")}.csv'`);
    if(files.hasNext()) { const file = files.next(); raw.cost = { data: parseBlobSafely(file), name: file.getName() }; break; }
  }

  const nameMap = {}, costMap = {}, aggMap = {}, volMap = {};
  raw.cost.data.forEach(r => {
    let c = r['集約拠点コード'] || r['拠点コード'], s = r['社員区分名称'], w = getNum(r['単純時給']);
    if (c && s && w > 0) { if(!costMap[c]) costMap[c]={}; costMap[c][s] = w; }
  });

  const getE = (c, t) => { let k = `${c}-${t}`; if (!aggMap[k]) aggMap[k] = { ih:0, ic:0, iv:0, tmh:0, tmc:0, tmv:0, oh:0, oc:0, ov:0 }; return aggMap[k]; };
  const staffMap = {'YSS':'ＹＳＳ作業', 'パート':'パート作業', 'アルバイト':'アルバイト作業', 'フル':'フル作業'};

  raw.mp.data.forEach(r => {
    let c = r['集約拠点コード'] || r['拠点コード'], t = r['時間帯'], s = r['社員区分名称'];
    if (!c || !t) return; nameMap[c] = r['拠点名称'];
    let e = getE(c, t), m = getNum(r['投入時間']);
    e.ih += m; e.ic += getInt(r['人員数']) || getInt(r['投入人数']);
    if (staffMap[s] && costMap[c] && costMap[c][staffMap[s]]) e.iv += (m/60) * costMap[c][staffMap[s]];
  });

  [ { k: 'tm', p: 'tm' }, { k: 'os', p: 'o' } ].forEach(cfg => {
    raw[cfg.k].data.forEach(r => {
      let c = r['集約拠点コード'] || r['拠点コード'], t = r['時間帯'];
      if (!c || !t) return;
      let e = getE(c, t);
      e[`${cfg.p}h`] += (getNum(r['投入時間']) || getNum(r['作業時間']) || getNum(r['委託時間']) || 0) * 60;
      e[`${cfg.p}c`] += getInt(r['投入人数']) || getInt(r['人員数']) || getInt(r['利用人数']) || getInt(r['委託人数']) || 0;
      e[`${cfg.p}v`] += getNum(r['合計支払金額']) || getNum(r['人的コスト']) || getNum(r['支払金額']) || getNum(r['委託金額']) || 0;
    });
  });

  raw.wv.data.forEach(r => volMap[`${r['集約拠点コード'] || r['拠点コード']}-${r['時間帯']}`] = getInt(r['作業個数']));

  const rows = [], headers = ['対象日','拠点コード','拠点名称','時間帯','作業個数','総投入時間(分)','自社投入時間(分)','タイミー投入時間(分)','外部投入時間(分)','総人員数','自社人員数','タイミー人員数','外部人員数','総コスト','自社コスト','タイミーコスト','外部コスト','個当たりコスト','参照コストファイル'];
  [...new Set([...Object.keys(volMap), ...Object.keys(aggMap)])].forEach(k => {
    let [c, t] = k.split('-'), n = nameMap[c] || `(名称不明:${c})`;
    let vol = volMap[k] || 0, e = aggMap[k] || {ih:0,ic:0,iv:0, tmh:0,tmc:0,tmv:0, oh:0,oc:0,ov:0};

    if (vol === 0 && e.ih === 0 && e.ic === 0 && e.oh === 0 && e.oc === 0) return;

    let th = e.ih + e.tmh + e.oh, tc = e.ic + e.tmc + e.oc, tv = e.iv + e.tmv + e.ov;
    rows.push([dateStr, c, n, t, vol, th.toFixed(1), e.ih.toFixed(1), e.tmh.toFixed(1), e.oh.toFixed(1), tc, e.ic, e.tmc, e.oc, Math.round(tv), Math.round(e.iv), Math.round(e.tmv), Math.round(e.ov), (vol>0?tv/vol:0).toFixed(1), raw.cost.name]);
  });
  uploadCsv(FOLDERS.output.daily, `${CSV_PREFIX.daily}${dateStr}.csv`, rows, headers);
}

function updatePeriodTotals(dateStr) {
  const t = new Date(dateStr), monDt = new Date(new Date(t).setDate(t.getDate() - t.getDay() + (t.getDay() === 0 ? -6 : 1)));
  const sunDt = new Date(monDt.getTime()); sunDt.setDate(sunDt.getDate() + 6);
  const fstDt = new Date(t.getFullYear(), t.getMonth(), 1), lstDt = new Date(t.getFullYear(), t.getMonth() + 1, 0);

  const getDts = (s, e) => { let a=[]; for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) a.push(formatDate(d)); return a; };

  const weekConcat = concatDailyFiles(getDts(monDt, sunDt), FOLDERS.output.weekly_full, `${CSV_PREFIX.weekly_full}${formatDate(monDt)}.csv`);
  const monthConcat = concatDailyFiles(getDts(fstDt, lstDt), FOLDERS.output.monthly_full, `${CSV_PREFIX.monthly_full}${formatMonth(fstDt)}.csv`);

  buildRunningFromConcat(weekConcat, dateStr, formatDate(monDt), formatDate(sunDt), 7, FOLDERS.output.weekly_running, CSV_PREFIX.weekly_running, formatDate(monDt));
  buildRunningFromConcat(monthConcat, dateStr, formatDate(fstDt), formatDate(lstDt), lstDt.getDate(), FOLDERS.output.monthly_running, CSV_PREFIX.monthly_running, formatMonth(fstDt));
}

function concatDailyFiles(dateList, folderId, fileName) {
  const folder = DriveApp.getFolderById(FOLDERS.output.daily);
  const headers = ['対象日','拠点コード','拠点名称','時間帯','作業個数','総投入時間(分)','自社投入時間(分)','タイミー投入時間(分)','外部投入時間(分)','総人員数','自社人員数','タイミー人員数','外部人員数','総コスト','自社コスト','タイミーコスト','外部コスト','個当たりコスト','参照コストファイル'];
  const allRows = [], csvOutputRows = [];

  dateList.forEach(dStr => {
    const files = folder.searchFiles(`title = '${CSV_PREFIX.daily}${dStr}.csv'`);
    if (files.hasNext()) {
      parseBlobSafely(files.next()).forEach(r => {
        allRows.push(r);
        csvOutputRows.push(headers.map(h => r[h] || ""));
      });
    }
  });

  if (allRows.length > 0) uploadCsv(folderId, fileName, csvOutputRows, headers);
  return allRows;
}

function buildRunningFromConcat(concatRows, refDate, startD, endD, totalDays, folderId, prefix, filenameDate) {
  const periodData = {};

  concatRows.forEach(r => {
    if (r['対象日'] > refDate) return;
    let c = r['拠点コード'], ts = r['時間帯'], n = r['拠点名称'];
    if (!c || !ts) return;
    let k = `${c}-${ts}`;
    if (!periodData[k]) periodData[k] = { c, n, t: ts, dates: new Set(), entries: [] };
    // ここで r['対象日'] が正しく取得できるようになり、dates.sizeが正確な日数になります
    periodData[k].dates.add(r['対象日']);
    periodData[k].entries.push(r);
  });

  const headers = ['基準日', '期間開始', '期間終了', '集計日数', 'データ存在日数', '拠点コード', '拠点名称', '時間帯'];
  const fields = ['作業個数', '総投入時間(分)', '自社投入時間(分)', 'タイミー投入時間(分)', '外部投入時間(分)', '総人員数', '自社人員数', 'タイミー人員数', '外部人員数', '総コスト', '自社コスト', 'タイミーコスト', '外部コスト'];
  fields.forEach(f => headers.push(`${f}_合計`, `${f}_日平均`));
  headers.push('個当たりコスト_合計ベース');

  const rows = Object.values(periodData).map(p => {
    let ddays = p.dates.size;
    let sum = {}; fields.forEach(f => sum[f] = 0);
    p.entries.forEach(e => fields.forEach(f => sum[f] += getNum(e[f])));
    let row = [refDate, startD, endD, totalDays, ddays, p.c, p.n, p.t];
    fields.forEach(f => row.push(sum[f].toFixed(1), (sum[f]/ddays).toFixed(1)));
    row.push((sum['総コスト'] / sum['作業個数'] || 0).toFixed(1));
    return row;
  });
  uploadCsv(folderId, `${prefix}${filenameDate}.csv`, rows, headers);
}