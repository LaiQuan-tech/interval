"use client";

// 購物車:localStorage + 自訂事件,不引入額外套件
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
};

const KEY = "interval-cart";
export const CART_EVENT = "interval:cart-updated";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const items = readCart();
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, quantity });
  }
  writeCart(items);
}

export function updateQuantity(productId: string, quantity: number) {
  let items = readCart();
  if (quantity <= 0) {
    items = items.filter((i) => i.productId !== productId);
  } else {
    items = items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
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
