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
    journeys: "私人旅程",
    rental: "租賃 · 買斷",
    membership: "會員沙龍",
    booking: "預約參訪",
    memberCenter: "會員中心",
    login: "登入",
    loginRegister: "登入 / 註冊",
    adminPanel: "後台管理",
    openMenu: "開啟選單",
  },
  header: {
    brand: "好日子",
  },
  footer: {
    brand: "好日子",
    tagline: "線下書店門市 × 線上藝術與旅程。收藏一幅畫，啟程一段旅行。",
    pointsRedeem: "點數兌換",
    addressLine1: "台北市大安區",
    hours: "週二 – 週日 11:00–20:00",
    email: "salon@goodays.tw",
    copyright: "好日子 · Good Days",
    privacyPolicy: "隱私政策",
    terms: "服務條款",
  },
};

export type Messages = typeof zh;

export default zh;
