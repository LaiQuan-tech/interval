"use client";

import type { PurchaseMode } from "@/lib/types";

// 購物車:localStorage + 自訂事件,不引入額外套件
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  // Phase G:加入購物車當下把 name_en 也一併存進去,渲染時用 localizeText(name, name_en, locale)
  // 依「當下瀏覽語系」選字——而不是在 addToCart 當下就依 locale 寫死選好的名字。
  // 這樣使用者中途切換語系,購物車裡舊加入的品項名稱也會跟著正確顯示,不會卡在加入當下的語言。
  // 選填、可為 null/undefined(舊資料或尚未翻譯):UI 端一律 fallback 回中文 name,不會壞畫面。
  name_en?: string | null;
  price: number; // 該購買模式下的單價(買斷價/月租價/旅程價/會員年費)
  mode: PurchaseMode;
  image?: string;
  quantity: number;
};

const KEY = "littlemoments-cart";
export const CART_EVENT = "littlemoments:cart-updated";
// 加入購物車後通知 flyout 自動滑出(與 CART_EVENT 分開,因為「內容變了」不代表「要打開」——
// 例如 flyout 自己呼叫 updateQuantity 調整數量時只需要重繪,不需要重新滑出)
export const CART_OPEN_EVENT = "littlemoments:cart-open";

export function openCart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_OPEN_EVENT));
}

// 實體商品(買斷/月租的藝術品)才需要配送;旅程與會員方案是服務類商品,結帳時不顯示收件區塊、不計運費
export function isPhysicalItem(item: Pick<CartItem, "mode">) {
  return item.mode === "buyout" || item.mode === "rental";
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
    // 舊資料(改版前無 mode 欄位)一律視為買斷,避免壞資料炸掉畫面
    return raw.map((i) => ({ ...i, mode: i.mode ?? "buyout" }));
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

// 同商品不同購買模式(買斷/月租)視為不同列。mode 可省略,預設 buyout
// (向下相容改版前呼叫端;新頁面應明確傳入 mode,尤其 rental/journey/membership)
export function addToCart(
  item: Omit<CartItem, "quantity" | "mode"> & { mode?: PurchaseMode },
  quantity = 1
) {
  const mode: PurchaseMode = item.mode ?? "buyout";
  const items = readCart();
  const existing = items.find((i) => i.productId === item.productId && i.mode === mode);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, mode, quantity });
  }
  writeCart(items);
}

// 向下相容:updateQuantity(productId, quantity) 沿用舊呼叫方式(視為 buyout);
// 新呼叫需區分模式時用 updateQuantity(productId, mode, quantity)
export function updateQuantity(productId: string, quantity: number): void;
export function updateQuantity(productId: string, mode: PurchaseMode, quantity: number): void;
export function updateQuantity(
  productId: string,
  modeOrQuantity: PurchaseMode | number,
  maybeQuantity?: number
) {
  const mode: PurchaseMode = typeof modeOrQuantity === "number" ? "buyout" : modeOrQuantity;
  const quantity = typeof modeOrQuantity === "number" ? modeOrQuantity : maybeQuantity ?? 0;

  let items = readCart();
  if (quantity <= 0) {
    items = items.filter((i) => !(i.productId === productId && i.mode === mode));
  } else {
    items = items.map((i) =>
      i.productId === productId && i.mode === mode ? { ...i, quantity } : i
    );
  }
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
