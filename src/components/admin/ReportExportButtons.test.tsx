// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportExportButtons } from "./ReportExportButtons";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReportExportButtons", () => {
  it("shows loading only for the selected export and always clears it after success", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<ReportExportButtons locale="en" baseQuery="from=2026-01-01&to=2026-01-31" />);
    const orders = screen.getByRole("button", { name: "Export Orders" }) as HTMLButtonElement;
    const sales = screen.getByRole("button", { name: "Export Sales" }) as HTMLButtonElement;
    fireEvent.click(orders);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(orders.disabled).toBe(true);
    expect(sales.disabled).toBe(true);
    expect(orders.querySelector(".animate-spin")).not.toBeNull();
    expect(sales.querySelector(".animate-spin")).toBeNull();

    resolveRequest?.(new Response("\uFEFFOrder\nJYS-1", {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="orders.csv"' },
    }));
    await waitFor(() => expect(orders.disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears loading and exposes a retryable error after a failed export", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })));

    render(<ReportExportButtons locale="en" baseQuery="" />);
    const customers = screen.getByRole("button", { name: "Export Customers" }) as HTMLButtonElement;
    fireEvent.click(customers);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be downloaded");
    expect(customers.disabled).toBe(false);
  });
});
