module.exports = {
  root: true,
  env: {
    es2021: true,
    'googleappsscript/googleappsscript': true
  },
  plugins: ['googleappsscript'],
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  rules: {
    // GASコードは関数引数の互換維持などで未使用が出やすいのでwarnに寄せる
    'no-unused-vars': ['warn', { args: 'none' }],
    // GASではログ記録失敗などを握りつぶすため空catchが出やすい
    'no-empty': ['error', { allowEmptyCatch: true }]
  }
};
