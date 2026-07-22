// 英文訊息骨架,結構必須與 zh.ts 完全一致。
// `const en: Messages` 是刻意寫法:賦值給已標型別的變數,TS 會同時檢查
// 缺 key(結構不足)與多 key(過剩屬性,因為是物件字面量直接賦值)——兩邊漂移會在
// typecheck 就報錯,不必等到 runtime。

import type { Messages } from "./zh";

const en: Messages = {
  common: {
    loading: "Loading…",
    close: "Close",
  },
  nav: {
    home: "Home",
    gallery: "Gallery",
  },
};

export default en;
