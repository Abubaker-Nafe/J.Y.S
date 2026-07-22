"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { readStorage, storageKeys, writeStorage } from "@/lib/demo/storage";

export interface CartEntry { key: string; productId: string; variantId?: string; quantity: number; product?: Product }
export interface CartLine extends CartEntry { product: Product; unitPrice: number; availableStock: number }
export interface CartIssue { itemId: string; code: string }
export interface StoreUser { id?: string; name: string; email: string; role?: string }

interface StoreContextValue {
  locale: Locale; cart: CartEntry[]; lines: CartLine[]; cartCount: number; subtotal: number; cartCurrency: string; cartIssues: CartIssue[];
  wishlist: string[]; user: StoreUser | null; sessionReady: boolean;
  addToCart: (product: Product, quantity?: number, variantId?: string) => void;
  updateQuantity: (key: string, quantity: number) => void; removeFromCart: (key: string) => void; clearCart: () => void;
  toggleWishlist: (productId: string) => void; isWishlisted: (productId: string) => boolean;
  setSessionUser: (user: StoreUser | null) => void; clearCustomerSession: () => void; refreshSession: () => Promise<void>; syncCart: () => Promise<boolean>;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const noCartIssues: CartIssue[] = [];

export function StoreProvider({ locale, initialCurrency = "ILS", catalogProducts = [], children }: { locale: Locale; initialCurrency?: string; catalogProducts?: Product[]; children: ReactNode }) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<StoreUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cartCurrency, setCartCurrency] = useState(initialCurrency);
  const [cartIssues, setCartIssues] = useState<CartIssue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const hydrated = useRef(false);
  const syncedForUser = useRef<string | null>(null);
  const cartSyncReady = useRef(false);
  const syncedWishlistUser = useRef<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { user?: StoreUser | null };
        setUser(payload.user ?? null);
        if (!payload.user) setCartIssues([]);
      } else { setUser(null); setCartIssues([]); }
    } catch { setUser(null); setCartIssues([]); }
    finally { setSessionReady(true); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(readStorage<CartEntry[]>(storageKeys.cart, []));
      setWishlist(readStorage<string[]>(storageKeys.wishlist, []));
      hydrated.current = true;
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);
  useEffect(() => { if (hydrated.current) writeStorage(storageKeys.cart, cart); }, [cart]);
  useEffect(() => { if (hydrated.current) writeStorage(storageKeys.wishlist, wishlist); }, [wishlist]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 2600); return () => window.clearTimeout(timer); }, [notice]);

  const lines = useMemo(() => cart.flatMap((entry): CartLine[] => {
    const product = entry.product ?? catalogProducts.find((item) => item.id === entry.productId); if (!product) return [];
    const variant = product.variants.find((item) => item.id === entry.variantId);
    return [{ ...entry, product, unitPrice: variant?.price ?? product.price, availableStock: variant?.stock ?? product.stock }];
  }), [cart, catalogProducts]);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [lines]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const addToCart = useCallback((product: Product, quantity = 1, variantId?: string) => {
    const productId = product.id;
    const variant = product.variants.find((item) => item.id === variantId);
    const stock = variant?.stock ?? product.stock;
    if (stock < 1 || (variant && !variant.available)) return;
    const key = `${productId}:${variantId ?? "base"}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, product, quantity: Math.min(stock, item.quantity + quantity) } : item);
      return [...current, { key, productId, product, ...(variantId ? { variantId } : {}), quantity: Math.min(stock, Math.max(1, quantity)) }];
    });
    setNotice(translate(locale, "common.addedCart"));
  }, [locale]);
  const updateQuantity = useCallback((key: string, quantity: number) => setCart((current) => current.map((entry) => {
    if (entry.key !== key) return entry;
    const product = entry.product ?? catalogProducts.find((item) => item.id === entry.productId); const variant = product?.variants.find((item) => item.id === entry.variantId); const stock = variant?.stock ?? product?.stock ?? 1;
    return { ...entry, quantity: Math.max(1, Math.min(stock, quantity)) };
  })), [catalogProducts]);
  const removeFromCart = useCallback((key: string) => setCart((current) => current.filter((item) => item.key !== key)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
    if (user) {
      const exists = wishlist.includes(productId);
      void fetch(exists ? `/api/wishlist/${productId}` : "/api/wishlist", { method: exists ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, ...(exists ? {} : { body: JSON.stringify({ productId }) }) }).catch(() => undefined);
    }
  }, [user, wishlist]);
  const isWishlisted = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);
  const setSessionUser = useCallback((next: StoreUser | null) => { setUser(next); if (!next) setCartIssues([]); setSessionReady(true); }, []);
  const clearCustomerSession = useCallback(() => {
    setUser(null);
    setCart([]);
    setWishlist([]);
    setCartIssues([]);
    setCartCurrency(initialCurrency);
    setNotice(null);
    syncedForUser.current = null;
    syncedWishlistUser.current = null;
    cartSyncReady.current = false;
    if (hydrated.current) {
      writeStorage(storageKeys.cart, []);
      writeStorage(storageKeys.wishlist, []);
    }
    setSessionReady(true);
  }, [initialCurrency]);
  const syncCart = useCallback(async () => {
    if (!user) return false;
    type ApiItem = { id: string; productId: string; variantId?: string | null; quantity: number; unitPrice?: number | string; availableStock?: number; isAvailable?: boolean; product?: { slug?: string; nameAr?: string; nameEn?: string; imageUrl?: string | null; variantLabelAr?: string | null; variantLabelEn?: string | null } };
    type CartPayload = { cart?: { items?: ApiItem[]; currency?: string; issues?: CartIssue[] } };
    const productFromServer = (item: ApiItem, base?: Product): Product => {
      const parsedPrice = Number(item.unitPrice);
      const unitPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
      const stock = Number.isInteger(item.availableStock) && (item.availableStock ?? -1) >= 0 ? item.availableStock as number : 0;
      const available = item.isAvailable ?? stock > 0;
      const fallback: Product = {
        id: item.productId,
        slug: item.product?.slug ?? item.productId,
        sku: "",
        name: { ar: item.product?.nameAr ?? "", en: item.product?.nameEn ?? "" },
        description: { ar: "", en: "" },
        categorySlug: "",
        price: unitPrice,
        stock,
        featured: false,
        createdAt: "",
        variants: [],
        ...(item.product?.imageUrl ? { images: [item.product.imageUrl] } : {}),
        visual: { from: "#202225", to: "#756556", kind: "bottle", ...(item.product?.imageUrl ? { image: item.product.imageUrl } : {}) },
      };
      const product = base ?? fallback;
      const name = {
        ar: item.product?.nameAr ?? product.name.ar,
        en: item.product?.nameEn ?? product.name.en,
      };
      if (!item.variantId) return { ...product, name, price: unitPrice, stock };
      const currentVariant = product.variants.find((variant) => variant.id === item.variantId);
      const serverVariant = {
        id: item.variantId,
        sku: currentVariant?.sku ?? "",
        label: {
          ar: item.product?.variantLabelAr ?? currentVariant?.label.ar ?? "",
          en: item.product?.variantLabelEn ?? currentVariant?.label.en ?? "",
        },
        price: unitPrice,
        stock,
        available,
      };
      const variants = currentVariant
        ? product.variants.map((variant) => variant.id === item.variantId ? { ...variant, ...serverVariant } : variant)
        : [...product.variants, serverVariant];
      return { ...product, name, variants };
    };
    const acceptServerCart = (payload: CartPayload) => {
      const currency = payload.cart?.currency;
      if (currency && /^[A-Z]{3}$/.test(currency)) setCartCurrency(currency);
      setCartIssues(payload.cart?.issues ?? []);
      const items = payload.cart?.items ?? [];
      setCart((current) => {
        let changed = false;
        const next = current.map((entry) => {
          const serverItem = items.find((item) => item.productId === entry.productId && (item.variantId ?? undefined) === entry.variantId);
          if (!serverItem) return entry;
          const base = entry.product ?? catalogProducts.find((product) => product.id === entry.productId);
          const product = productFromServer(serverItem, base);
          if (entry.product && JSON.stringify(entry.product) === JSON.stringify(product)) return entry;
          changed = true;
          return { ...entry, product };
        });
        return changed ? next : current;
      });
      return items;
    };
    try {
      let response = await fetch("/api/cart", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) return false;
      let payload = await response.json() as CartPayload;
      let serverItems = acceptServerCart(payload);
      for (const entry of cart) {
        const existing = serverItems.find((item) => item.productId === entry.productId && (item.variantId ?? undefined) === entry.variantId);
        if (existing && existing.quantity !== entry.quantity) {
          response = await fetch(`/api/cart/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: entry.quantity }) });
        } else if (!existing) {
          response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: entry.productId, variantId: entry.variantId ?? null, quantity: entry.quantity }) });
        } else continue;
        if (!response.ok) return false;
        payload = await response.json() as CartPayload; serverItems = acceptServerCart(payload);
      }
      if (cart.length === 0 && serverItems.length && !cartSyncReady.current) setCart(serverItems.map((item) => ({ key: `${item.productId}:${item.variantId ?? "base"}`, productId: item.productId, product: productFromServer(item, catalogProducts.find((product) => product.id === item.productId)), ...(item.variantId ? { variantId: item.variantId } : {}), quantity: item.quantity })));
      else if (cartSyncReady.current) {
        for (const serverItem of serverItems) {
          const retained = cart.some((entry) => entry.productId === serverItem.productId && (entry.variantId ?? undefined) === (serverItem.variantId ?? undefined));
          if (retained) continue;
          const removed = await fetch(`/api/cart/${serverItem.id}`, { method: "DELETE" });
          if (!removed.ok) return false;
          payload = await removed.json() as CartPayload;
          acceptServerCart(payload);
        }
      }
      cartSyncReady.current = true;
      return true;
    } catch { return false; }
  }, [cart, catalogProducts, user]);
  useEffect(() => {
    const userKey = user?.id ?? user?.email ?? null;
    if (!userKey || syncedForUser.current === userKey) return;
    syncedForUser.current = userKey;
    cartSyncReady.current = false;
    void syncCart();
  }, [user, syncCart]);
  useEffect(() => {
    if (!user || !cartSyncReady.current) return;
    const timer = window.setTimeout(() => { void syncCart(); }, 250);
    return () => window.clearTimeout(timer);
  }, [cart, user, syncCart]);
  useEffect(() => {
    const userKey = user?.id ?? user?.email ?? null;
    if (!userKey || syncedWishlistUser.current === userKey) return;
    syncedWishlistUser.current = userKey;
    const controller = new AbortController();
    void fetch("/api/wishlist", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { items?: Array<{ productId: string }> };
      const serverIds = (payload.items ?? []).map((item) => item.productId);
      for (const productId of wishlist.filter((id) => !serverIds.includes(id))) {
        await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }), signal: controller.signal });
      }
      setWishlist(Array.from(new Set([...serverIds, ...wishlist])));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [user, wishlist]);

  const value = useMemo<StoreContextValue>(() => ({ locale, cart, lines, cartCount, subtotal, cartCurrency, cartIssues: user ? cartIssues : noCartIssues, wishlist, user, sessionReady, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist, isWishlisted, setSessionUser, clearCustomerSession, refreshSession, syncCart }), [locale, cart, lines, cartCount, subtotal, cartCurrency, cartIssues, wishlist, user, sessionReady, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist, isWishlisted, setSessionUser, clearCustomerSession, refreshSession, syncCart]);
  return <StoreContext.Provider value={value}>{children}{notice ? <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full bg-brand-strong px-5 py-3 text-sm font-bold text-white shadow-2xl"><CheckCircle2 className="size-5 text-emerald-300" aria-hidden="true" />{notice}<button type="button" onClick={() => setNotice(null)} className="ms-1 rounded-full p-1 hover:bg-white/10" aria-label={locale === "ar" ? "إغلاق الإشعار" : "Dismiss notification"}><X className="size-4" aria-hidden="true" /></button></div> : null}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext); if (!context) throw new Error("useStore must be used within StoreProvider"); return context;
}
