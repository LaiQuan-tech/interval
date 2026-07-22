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
    gallery: "The Collection",
    journeys: "Private Journeys",
    rental: "Rent · Own",
    membership: "Membership Salon",
    booking: "Book a Visit",
    memberCenter: "My Account",
    login: "Log In",
    loginRegister: "Log In / Sign Up",
    adminPanel: "Admin",
    openMenu: "Open menu",
  },
  header: {
    brand: "Good Days",
  },
  footer: {
    brand: "Good Days",
    tagline:
      "A bookstore salon in the city, paired with an online gallery of art and journeys. Collect a painting, begin a journey.",
    pointsRedeem: "Redeem Points",
    addressLine1: "Da'an District, Taipei",
    hours: "Tue – Sun 11:00–20:00",
    email: "salon@goodays.tw",
    copyright: "Good Days",
    privacyPolicy: "Privacy Policy",
    terms: "Terms of Service",
  },
  home: {
    heroEyebrow: "A private collection, curated for you",
    heroTitleLine1: "For those who know how to live,",
    heroTitleLine2: "a collection worth lingering over",
    heroDesc:
      "Exclusive AI artworks, bespoke private journeys, and dedicated advisory service. Rent or own — members enjoy points and privileges.",
    heroCtaBooking: "Book a Private Viewing",
    heroCtaGallery: "Browse the Collection →",
    waysEyebrow: "Three ways to begin",
    waysTitle: "Three Ways to Begin",
    way1Title: "AI Art Collection",
    way1Desc: "One-of-a-kind generative art, framed by artisans into physical works — hang it, and it becomes a view.",
    way1Label: "Browse the Collection →",
    way2Title: "Rent · Own",
    way2Desc: "Rent first, buy later, swap by season. A flexible way to keep your space feeling new.",
    way2Label: "See the Plans →",
    way3Title: "Private Journeys",
    way3Desc: "Curated journeys just for you, redeemed with membership points — let inspiration travel further.",
    way3Label: "Explore Journeys →",
    featuredTitle: "Featured This Season",
    featuredViewAll: "View All Works →",
    featuredEmpty: "New pieces are coming soon — stay tuned.",
    priceRentalPrefix: "Rent",
    priceRentalSuffix: "/mo · ",
    priceOutright: "Own",
    membershipEyebrow: "Membership Salon",
    membershipTitle: "Membership Salon — Redeem Points for Journeys and Collection Privileges",
    membershipDesc: "Earn points on purchases, visits, and rentals; redeem them for private journeys and artwork discounts.",
    membershipCta: "Apply for Membership",
  },
};

export default en;
