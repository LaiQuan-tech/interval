// 中文(預設語系)訊息骨架。之後 phase(C)會把全站文案逐步搬進這裡的巢狀 key。
// 注意:不加 `as const`——保留 `Messages` 型別的 leaf 為 `string`,讓 en.ts 可以填入
// 不同字串內容而仍滿足同一個型別(用來檢查兩邊 key 結構一致,而非值一致)。

const zh = {
  common: {
    loading: "載入中…",
    close: "關閉",
  },
  nav: {
    home: "首頁",
    gallery: "藝術典藏",
  },
};

export type Messages = typeof zh;

export default zh;
