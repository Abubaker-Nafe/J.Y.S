// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/catalog";
import { StoreProvider, useStore } from "@/components/storefront/store-provider";

const product: Product = {
  id: "product-1",
  slug: "test-product",
  sku: "TEST-1",
  name: { ar: "منتج", en: "Test product" },
  description: { ar: "", en: "" },
  categorySlug: "tools",
  price: 10,
  stock: 5,
  featured: false,
  createdAt: "2026-01-01",
  variants: [],
  visual: { from: "#111", to: "#222", kind: "bottle" },
};

function Harness() {
  const store = useStore();
  return (
    <div>
      <output>{store.sessionStatus}</output>
      <output aria-label="Cart count">{store.cartCount}</output>
      <button type="button" onClick={() => store.addToCart(product)}>Add</button>
    </div>
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("authenticated cart synchronization", () => {
  it("does not poll while idle and performs one controlled refresh on focus or mutation", async () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let cartGets = 0;
    let cartPosts = 0;
    let serverItems: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session") return json({ user: { id: "user-1", name: "Customer", email: "customer@example.com", role: "CUSTOMER" } });
      if (url === "/api/cart" && (!init?.method || init.method === "GET")) {
        cartGets += 1;
        return json({ cart: { items: serverItems, currency: "ILS", issues: [] } });
      }
      if (url === "/api/cart" && init?.method === "POST") {
        cartPosts += 1;
        const body = JSON.parse(String(init.body)) as { productId: string; quantity: number };
        serverItems = [{
          id: "cart-item-1",
          productId: body.productId,
          quantity: body.quantity,
          unitPrice: 10,
          availableStock: 5,
          isAvailable: true,
          product: { slug: "test-product", nameAr: "منتج", nameEn: "Test product" },
        }];
        return json({ cart: { items: serverItems, currency: "ILS", issues: [] } }, 201);
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StoreProvider locale="en" catalogProducts={[product]}><Harness /></StoreProvider>);
    await screen.findByText("authenticated");
    await waitFor(() => expect(cartGets).toBe(1));

    await new Promise((resolve) => window.setTimeout(resolve, 500));
    expect(cartGets).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(cartPosts).toBe(1));
    expect(cartGets).toBe(2);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    expect(cartGets).toBe(2);

    act(() => window.dispatchEvent(new Event("focus")));
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(cartGets).toBe(2);

    now += 5_000;
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(cartGets).toBe(3));
  });

  it("does not lose a cart mutation made while the initial account cart is loading", async () => {
    let resolveInitialCart: ((response: Response) => void) | undefined;
    let posts = 0;
    let gets = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session") return json({ user: { id: "user-1", name: "Customer", email: "customer@example.com", role: "CUSTOMER" } });
      if (url === "/api/cart" && (!init?.method || init.method === "GET")) {
        gets += 1;
        if (gets === 1) return new Promise<Response>((resolve) => { resolveInitialCart = resolve; });
        return json({ cart: { items: [], currency: "ILS", issues: [] } });
      }
      if (url === "/api/cart" && init?.method === "POST") {
        posts += 1;
        return json({ cart: { currency: "ILS", issues: [], items: [{
          id: "cart-item-1",
          productId: product.id,
          quantity: 1,
          unitPrice: 10,
          availableStock: 5,
          isAvailable: true,
          product: { slug: product.slug, nameAr: product.name.ar, nameEn: product.name.en },
        }] } }, 201);
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StoreProvider locale="en" catalogProducts={[product]}><Harness /></StoreProvider>);
    await screen.findByText("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("Cart count").textContent).toBe("1");

    resolveInitialCart?.(json({ cart: { items: [], currency: "ILS", issues: [] } }));
    await waitFor(() => expect(posts).toBe(1));
    expect(screen.getByLabelText("Cart count").textContent).toBe("1");
  });
});
