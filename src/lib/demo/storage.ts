export const storageKeys = {
  cart: "jys.cart.v1",
  wishlist: "jys.wishlist.v1",
  user: "jys.demo.user.v1",
  orders: "jys.orders.v1",
  addresses: "jys.addresses.v1",
} as const;

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled; the UI remains usable in memory. */ }
}
