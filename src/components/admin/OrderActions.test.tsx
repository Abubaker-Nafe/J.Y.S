// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderActions } from "./OrderActions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("OrderActions payment status", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it("selects the current value and disables save until it changes", () => {
    render(<OrderActions id="order-1" locale="en" status="NEW" paymentStatus="PENDING" fulfillment="DELIVERY" />);
    expect((screen.getByLabelText("Cash payment status") as HTMLSelectElement).value).toBe("PENDING");
    expect((screen.getByRole("button", { name: "Save payment status" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects the saved value immediately and keeps it after server-prop refresh", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse({ ok: true, data: { id: "order-1" }, message: "Saved" }));
    const user = userEvent.setup();
    const view = render(<OrderActions id="order-1" locale="en" status="NEW" paymentStatus="PENDING" fulfillment="DELIVERY" />);
    await user.selectOptions(screen.getByLabelText("Cash payment status"), "PAID");
    await user.click(screen.getByRole("button", { name: "Save payment status" }));
    await waitFor(() => expect((screen.getByLabelText("Cash payment status") as HTMLSelectElement).value).toBe("PAID"));
    expect((screen.getByRole("button", { name: "Save payment status" }) as HTMLButtonElement).disabled).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();

    view.rerender(<OrderActions id="order-1" locale="en" status="NEW" paymentStatus="PAID" fulfillment="DELIVERY" />);
    expect((screen.getByLabelText("Cash payment status") as HTMLSelectElement).value).toBe("PAID");
  });

  it("clears loading and leaves retry controls usable after failure", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse({ ok: false, error: "Update failed" }, 500));
    const user = userEvent.setup();
    render(<OrderActions id="order-1" locale="en" status="NEW" paymentStatus="PENDING" fulfillment="DELIVERY" />);
    await user.selectOptions(screen.getByLabelText("Cash payment status"), "PAID");
    await user.click(screen.getByRole("button", { name: "Save payment status" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Cash payment status") as HTMLSelectElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Save payment status" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders Arabic status labels", () => {
    render(<OrderActions id="order-1" locale="ar" status="NEW" paymentStatus="PENDING" fulfillment="DELIVERY" />);
    expect((screen.getByLabelText("حالة الدفع النقدي") as HTMLSelectElement).value).toBe("PENDING");
    expect(screen.getByRole("option", { name: "قيد الانتظار" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "مدفوع" })).toBeTruthy();
  });

  it("replaces payment editing with the current value for delivered orders", () => {
    render(<OrderActions id="order-1" locale="en" status="DELIVERED" paymentStatus="PAID" fulfillment="DELIVERY" />);
    expect(screen.getByText("Paid", { exact: true })).toBeTruthy();
    expect(screen.getByText("Payment status cannot be changed after an order is delivered or cancelled.")).toBeTruthy();
    expect(screen.queryByLabelText("Cash payment status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save payment status" })).toBeNull();
  });

  it("renders the Arabic lock message and current status for cancelled orders", () => {
    render(<OrderActions id="order-1" locale="ar" status="CANCELLED" paymentStatus="PENDING" fulfillment="DELIVERY" />);
    expect(screen.getByText("قيد الانتظار", { exact: true })).toBeTruthy();
    expect(screen.getByText("لا يمكن تغيير حالة الدفع بعد توصيل الطلب أو إلغائه.")).toBeTruthy();
    expect(screen.queryByLabelText("حالة الدفع النقدي")).toBeNull();
  });
});
