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
  home: {
    heroEyebrow: "A private collection, curated for you",
    heroTitleLine1: "為懂得生活的人，",
    heroTitleLine2: "典藏值得停留的時光",
    heroDesc:
      "獨家 AI 藝術畫作、量身訂製的私人旅程，以及專屬顧問服務。租賃或買斷皆宜，會員享點數與禮遇。",
    heroCtaBooking: "預約私人鑑賞",
    heroCtaGallery: "瀏覽典藏 →",
    waysEyebrow: "Three ways to begin",
    waysTitle: "三種開始的方式",
    way1Title: "AI 藝術典藏",
    way1Desc: "獨一無二的生成藝術，職人裝裱為實體畫作，掛上牆即是風景。",
    way1Label: "瀏覽典藏 →",
    way2Title: "租賃 · 買斷",
    way2Desc: "先租後買、依季更換。用彈性的方式，讓空間持續有新意。",
    way2Label: "了解方案 →",
    way3Title: "私人旅程",
    way3Desc: "為你策劃的旅行提案，以會員點數兌換體驗，讓靈感延伸到遠方。",
    way3Label: "探索旅程 →",
    featuredTitle: "本季精選",
    featuredViewAll: "看全部作品 →",
    featuredEmpty: "典藏即將上架，敬請期待。",
    priceRentalPrefix: "租賃",
    priceRentalSuffix: "/月 · ",
    priceOutright: "買斷",
    membershipEyebrow: "Membership Salon",
    membershipTitle: "會員沙龍．以點數兌換旅程與典藏禮遇",
    membershipDesc: "消費、參訪、租賃皆可累點；點數可兌換私人旅程與藝術品折扣。",
    membershipCta: "申請入會",
  },
};

export type Messages = typeof zh;

export default zh;
