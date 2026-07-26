"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { readStorage, storageKeys, writeStorage } from "@/lib/demo/storage";
import { loadClientSession, type ClientSessionUser } from "@/lib/auth/client-session";

export interface CartEntry { key: string; productId: string; variantId?: string; quantity: number; product?: Product }
export interface CartLine extends CartEntry { product: Product; unitPrice: number; availableStock: number }
export interface CartIssue { itemId: string; code: string }
export type StoreUser = ClientSessionUser;
export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface StoreContextValue {
  locale: Locale; cart: CartEntry[]; lines: CartLine[]; cartCount: number; subtotal: number; cartCurrency: string; cartIssues: CartIssue[];
  wishlist: string[]; user: StoreUser | null; sessionReady: boolean; sessionStatus: SessionStatus; sessionError: string | null;
  addToCart: (product: Product, quantity?: number, variantId?: string) => void;
  updateQuantity: (key: string, quantity: number) => void; removeFromCart: (key: string) => void; clearCart: () => void;
  toggleWishlist: (productId: string) => void; isWishlisted: (productId: string) => boolean;
  setSessionUser: (user: StoreUser | null) => void; clearCustomerSession: () => void; refreshSession: () => Promise<void>;
  syncCart: () => Promise<boolean>; refreshCart: (force?: boolean) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextValue | null>(null);
type ApiCartItem = { id: string; productId: string; variantId?: string | null; quantity: number; unitPrice?: number | string; availableStock?: number; isAvailable?: boolean; product?: { slug?: string; nameAr?: string; nameEn?: string; imageUrl?: string | null; variantLabelAr?: string | null; variantLabelEn?: string | null } };
type CartPayload = { cart?: { items?: ApiCartItem[]; currency?: string; issues?: CartIssue[] } };

export function StoreProvider({ locale, initialCurrency = "ILS", catalogProducts = [], children }: { locale: Locale; initialCurrency?: string; catalogProducts?: Product[]; children: ReactNode }) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<StoreUser | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [cartCurrency, setCartCurrency] = useState(initialCurrency);
  const [cartIssues, setCartIssues] = useState<CartIssue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const hydrated = useRef(false);
  const syncedForUser = useRef<string | null>(null);
  const cartSyncReady = useRef(false);
  const syncedWishlistUser = useRef<string | null>(null);
  const sessionRequestId = useRef(0);
  const cartRef = useRef<CartEntry[]>([]);
  const catalogProductsRef = useRef(catalogProducts);
  const userRef = useRef<StoreUser | null>(null);
  const cartOperation = useRef<Promise<boolean> | null>(null);
  const lastCartRefreshAt = useRef(0);
  const cartMutationRevision = useRef(0);
  const syncedCartRevision = useRef(0);
  const [cartMutationVersion, setCartMutationVersion] = useState(0);
  const sessionReady = sessionStatus !== "loading";
  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { catalogProductsRef.current = catalogProducts; }, [catalogProducts]);
  useEffect(() => { userRef.current = user; }, [user]);

  const refreshSession = useCallback(async () => {
    const requestId = ++sessionRequestId.current;
    setSessionStatus("loading");
    setSessionError(null);
    const result = await loadClientSession();
    if (requestId !== sessionRequestId.current) return;

    setUser(result.user);
    setSessionStatus(result.status);
    setSessionError(result.status === "error" ? result.error : null);
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
  const markCartMutation = useCallback(() => {
    cartMutationRevision.current += 1;
    setCartMutationVersion(cartMutationRevision.current);
  }, []);

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
    markCartMutation();
    setNotice(translate(locale, "common.addedCart"));
  }, [locale, markCartMutation]);
  const updateQuantity = useCallback((key: string, quantity: number) => {
    setCart((current) => current.map((entry) => {
      if (entry.key !== key) return entry;
      const product = entry.product ?? catalogProductsRef.current.find((item) => item.id === entry.productId); const variant = product?.variants.find((item) => item.id === entry.variantId); const stock = variant?.stock ?? product?.stock ?? 0;
      return { ...entry, quantity: Math.max(1, Math.min(stock, quantity)) };
    }));
    markCartMutation();
  }, [markCartMutation]);
  const removeFromCart = useCallback((key: string) => {
    setCart((current) => current.filter((item) => item.key !== key));
    markCartMutation();
  }, [markCartMutation]);
  const clearCart = useCallback(() => {
    setCart([]);
    markCartMutation();
  }, [markCartMutation]);
  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
    if (user) {
      const exists = wishlist.includes(productId);
      void fetch(exists ? `/api/wishlist/${productId}` : "/api/wishlist", { method: exists ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, ...(exists ? {} : { body: JSON.stringify({ productId }) }) }).catch(() => undefined);
    }
  }, [user, wishlist]);
  const isWishlisted = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);
  const setSessionUser = useCallback((next: StoreUser | null) => {
    sessionRequestId.current += 1;
    setUser(next);
    if (!next) setCartIssues([]);
    setSessionError(null);
    setSessionStatus(next ? "authenticated" : "unauthenticated");
  }, []);
  const clearCustomerSession = useCallback(() => {
    sessionRequestId.current += 1;
    setUser(null);
    setCart([]);
    setWishlist([]);
    setCartIssues([]);
    setCartCurrency(initialCurrency);
    setNotice(null);
    syncedForUser.current = null;
    syncedWishlistUser.current = null;
    cartSyncReady.current = false;
    cartMutationRevision.current = 0;
    syncedCartRevision.current = 0;
    setCartMutationVersion(0);
    lastCartRefreshAt.current = 0;
    if (hydrated.current) {
      writeStorage(storageKeys.cart, []);
      writeStorage(storageKeys.wishlist, []);
    }
    setSessionError(null);
    setSessionStatus("unauthenticated");
  }, [initialCurrency]);
  const productFromServer = useCallback((item: ApiCartItem, base?: Product): Product => {
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
  }, []);
  const acceptServerCart = useCallback((payload: CartPayload, mode: "replace" | "update" | "merge") => {
      const currency = payload.cart?.currency;
      if (currency && /^[A-Z]{3}$/.test(currency)) setCartCurrency(currency);
      setCartIssues(payload.cart?.issues ?? []);
      const items = payload.cart?.items ?? [];
      const entryFromServer = (item: ApiCartItem): CartEntry => ({
          key: `${item.productId}:${item.variantId ?? "base"}`,
          productId: item.productId,
          product: productFromServer(item, catalogProductsRef.current.find((product) => product.id === item.productId)),
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
      });
      if (mode === "replace") {
        const nextCart = items.map(entryFromServer);
        cartRef.current = nextCart;
        setCart(nextCart);
        return items;
      }
      let changed = false;
      const next = cartRef.current.map((entry) => {
          const serverItem = items.find((item) => item.productId === entry.productId && (item.variantId ?? undefined) === entry.variantId);
          if (!serverItem) return entry;
          const base = entry.product ?? catalogProductsRef.current.find((product) => product.id === entry.productId);
          const product = productFromServer(serverItem, base);
          if (entry.product && JSON.stringify(entry.product) === JSON.stringify(product)) return entry;
          changed = true;
          return { ...entry, product };
      });
      if (mode === "merge") {
        for (const item of items) {
          const retained = next.some((entry) => entry.productId === item.productId && (entry.variantId ?? undefined) === (item.variantId ?? undefined));
          if (!retained) {
            next.push(entryFromServer(item));
            changed = true;
          }
        }
      }
      if (changed) {
        cartRef.current = next;
        setCart(next);
      }
      return items;
  }, [productFromServer]);
  const runCartOperation = useCallback((work: () => Promise<boolean>) => {
    const previous = cartOperation.current;
    const next = previous ? previous.catch(() => false).then(work) : work();
    cartOperation.current = next;
    void next.finally(() => {
      if (cartOperation.current === next) cartOperation.current = null;
    });
    return next;
  }, []);
  const refreshCart = useCallback((force = false) => runCartOperation(async () => {
    if (!force && Date.now() - lastCartRefreshAt.current < 4_000) return true;
    if (!userRef.current) {
      const current = cartRef.current;
      if (!current.length) return true;
      try {
        const ids = Array.from(new Set(current.map((entry) => entry.productId)));
        const batches = Array.from({ length: Math.ceil(ids.length / 48) }, (_, index) => ids.slice(index * 48, (index + 1) * 48));
        const payloads = await Promise.all(batches.map(async (batch) => {
          const response = await fetch(`/api/catalog/products/snapshots?ids=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" });
          if (!response.ok) throw new Error("Product snapshots unavailable");
          return await response.json() as { products?: Product[] };
        }));
        const products = payloads.flatMap((payload) => payload.products ?? []);
        const byId = new Map(products.map((product) => [product.id, product]));
        const issues: CartIssue[] = [];
        const next = current.map((entry) => {
          const previous = entry.product ?? catalogProductsRef.current.find((product) => product.id === entry.productId);
          const fresh = byId.get(entry.productId);
          const product = fresh ?? (previous ? { ...previous, stock: 0, variants: previous.variants.map((variant) => ({ ...variant, stock: 0, available: false })) } : undefined);
          const variant = product?.variants.find((item) => item.id === entry.variantId);
          const availableStock = variant?.stock ?? product?.stock ?? 0;
          const available = availableStock > 0 && (!variant || variant.available);
          if (!available || entry.quantity > availableStock) issues.push({ itemId: entry.key, code: "UNAVAILABLE_OR_LOW_STOCK" });
          if (previous && fresh) {
            const oldPrice = previous.variants.find((item) => item.id === entry.variantId)?.price ?? previous.price;
            const newPrice = fresh.variants.find((item) => item.id === entry.variantId)?.price ?? fresh.price;
            if (oldPrice !== newPrice) issues.push({ itemId: entry.key, code: "PRICE_CHANGED" });
          }
          return product ? { ...entry, product } : entry;
        });
        cartRef.current = next;
        setCart(next);
        setCartIssues(issues);
        lastCartRefreshAt.current = Date.now();
        return true;
      } catch {
        return false;
      }
    }
    try {
      const response = await fetch("/api/cart", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) return false;
      const payload = await response.json() as CartPayload;
      const hasUnsyncedLocalChange = cartMutationRevision.current > syncedCartRevision.current;
      acceptServerCart(payload, hasUnsyncedLocalChange ? "update" : "replace");
      lastCartRefreshAt.current = Date.now();
      return true;
    } catch {
      return false;
    }
  }), [acceptServerCart, runCartOperation]);
  const syncCart = useCallback(() => runCartOperation(async () => {
    if (!userRef.current) return false;
    const desired = cartRef.current;
    const revision = cartMutationRevision.current;
    const wasReady = cartSyncReady.current;
    let payload: CartPayload;
    try {
      let response = await fetch("/api/cart", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) return false;
      payload = await response.json() as CartPayload;
      let serverItems = acceptServerCart(payload, "update");

      for (const entry of desired) {
        const existing = serverItems.find((item) => item.productId === entry.productId && (item.variantId ?? undefined) === entry.variantId);
        if (existing && existing.quantity !== entry.quantity) {
          response = await fetch(`/api/cart/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: entry.quantity }) });
        } else if (!existing) {
          response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: entry.productId, variantId: entry.variantId ?? null, quantity: entry.quantity }) });
        } else {
          continue;
        }
        if (!response.ok) {
          const latest = await fetch("/api/cart", { headers: { Accept: "application/json" }, cache: "no-store" });
          if (latest.ok) acceptServerCart(await latest.json() as CartPayload, "replace");
          cartSyncReady.current = true;
          lastCartRefreshAt.current = Date.now();
          return false;
        }
        payload = await response.json() as CartPayload;
        serverItems = acceptServerCart(payload, "update");
      }

      if (wasReady) {
        for (const serverItem of serverItems) {
          const retained = desired.some((entry) => entry.productId === serverItem.productId && (entry.variantId ?? undefined) === (serverItem.variantId ?? undefined));
          if (retained) continue;
          response = await fetch(`/api/cart/${serverItem.id}`, { method: "DELETE" });
          if (!response.ok) return false;
          payload = await response.json() as CartPayload;
          serverItems = acceptServerCart(payload, "update");
        }
      }

      const newerLocalMutation = cartMutationRevision.current > revision;
      acceptServerCart(payload, newerLocalMutation ? "merge" : "replace");
      cartSyncReady.current = true;
      syncedCartRevision.current = revision;
      lastCartRefreshAt.current = Date.now();
      return !(payload.cart?.issues ?? []).some((issue) => issue.code === "UNAVAILABLE_OR_LOW_STOCK");
    } catch {
      return false;
    }
  }), [acceptServerCart, runCartOperation]);
  useEffect(() => {
    const userKey = user?.id ?? user?.email ?? null;
    if (!userKey || syncedForUser.current === userKey) return;
    syncedForUser.current = userKey;
    cartSyncReady.current = false;
    void syncCart();
  }, [user, syncCart]);
  useEffect(() => {
    if (!user || cartMutationVersion === 0) return;
    const timer = window.setTimeout(() => { void syncCart(); }, 250);
    return () => window.clearTimeout(timer);
  }, [cartMutationVersion, user, syncCart]);
  useEffect(() => {
    if (!user) return;
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refreshCart();
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [user, refreshCart]);
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

  const value = useMemo<StoreContextValue>(() => ({ locale, cart, lines, cartCount, subtotal, cartCurrency, cartIssues, wishlist, user, sessionReady, sessionStatus, sessionError, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist, isWishlisted, setSessionUser, clearCustomerSession, refreshSession, syncCart, refreshCart }), [locale, cart, lines, cartCount, subtotal, cartCurrency, cartIssues, wishlist, user, sessionReady, sessionStatus, sessionError, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist, isWishlisted, setSessionUser, clearCustomerSession, refreshSession, syncCart, refreshCart]);
  return <StoreContext.Provider value={value}>{children}{notice ? <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full bg-brand-strong px-5 py-3 text-sm font-bold text-white shadow-2xl"><CheckCircle2 className="size-5 text-emerald-300" aria-hidden="true" />{notice}<button type="button" onClick={() => setNotice(null)} className="ms-1 rounded-full p-1 hover:bg-white/10" aria-label={locale === "ar" ? "إغلاق الإشعار" : "Dismiss notification"}><X className="size-4" aria-hidden="true" /></button></div> : null}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext); if (!context) throw new Error("useStore must be used within StoreProvider"); return context;
}
