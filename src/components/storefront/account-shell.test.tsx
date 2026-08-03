// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountShell } from "./account-shell";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  useStore: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/profile",
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("./store-provider", () => ({ useStore: mocks.useStore }));

function authenticatedStore(name: string) {
  return {
    user: { id: "customer-1", name, email: "long.customer.address@example.com", role: "CUSTOMER" },
    sessionReady: true,
    sessionStatus: "authenticated",
    sessionError: null,
    clearCustomerSession: vi.fn(),
    refreshSession: vi.fn(),
  };
}

describe("AccountShell customer greeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useStore.mockReturnValue(authenticatedStore("Nafe Abubaker"));
  });
  afterEach(() => cleanup());

  it("renders the authenticated database name in English without duplicating it", () => {
    render(<AccountShell locale="en"><p>Profile content</p></AccountShell>);
    expect(screen.getByText("Hi Nafe Abubaker", { exact: true })).toBeTruthy();
    expect(screen.getAllByText(/Nafe Abubaker/)).toHaveLength(1);
    expect(screen.getByText("long.customer.address@example.com", { exact: true })).toBeTruthy();
  });

  it("renders the localized Arabic greeting in an RTL-compatible account shell", () => {
    mocks.useStore.mockReturnValue(authenticatedStore("نافع أبو بكر"));
    render(<div dir="rtl"><AccountShell locale="ar"><p>المحتوى</p></AccountShell></div>);
    expect(screen.getByText("مرحباً نافع أبو بكر", { exact: true })).toBeTruthy();
  });

  it("omits the greeting cleanly when the name is blank", () => {
    mocks.useStore.mockReturnValue(authenticatedStore("   "));
    render(<AccountShell locale="en"><p>Profile content</p></AccountShell>);
    expect(screen.queryByText(/^Hi\s/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "My account" })).toBeTruthy();
    expect(screen.getByText("long.customer.address@example.com", { exact: true })).toBeTruthy();
  });
});
