"use client";

import type { PurchaseMode } from "@/lib/types";

// 購物車:localStorage + 自訂事件,不引入額外套件
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number; // 該購買模式下的單價(買斷價/月租價/旅程價/會員年費)
  mode: PurchaseMode;
  image?: string;
  quantity: number;
};

const KEY = "littlemoments-cart";
export const CART_EVENT = "littlemoments:cart-updated";

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
