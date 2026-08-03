import { describe, expect, it } from "vitest";
import { assertPaymentStatusEditable, assertPaymentStatusTransition, PAYMENT_STATUS_LOCKED_MESSAGE } from "@/lib/domain/payment";

describe("payment status transitions", () => {
  it("allows payment capture, cancellation, and an explicit reset to pending", () => {
    expect(() => assertPaymentStatusTransition("PENDING", "PAID")).not.toThrow();
    expect(() => assertPaymentStatusTransition("PENDING", "CANCELLED")).not.toThrow();
    expect(() => assertPaymentStatusTransition("PAID", "PENDING")).not.toThrow();
    expect(() => assertPaymentStatusTransition("CANCELLED", "PENDING")).not.toThrow();
  });

  it("rejects direct cancelled-to-paid and paid-to-cancelled transitions", () => {
    expect(() => assertPaymentStatusTransition("CANCELLED", "PAID")).toThrow();
    expect(() => assertPaymentStatusTransition("PAID", "CANCELLED")).toThrow();
  });

  it("allows payment editing before fulfillment is final", () => {
    expect(() => assertPaymentStatusEditable("NEW")).not.toThrow();
    expect(() => assertPaymentStatusEditable("SENT_TO_DELIVERY_COMPANY")).not.toThrow();
  });

  it.each(["DELIVERED", "CANCELLED"])("locks payment editing when the order is %s", (status) => {
    expect(() => assertPaymentStatusEditable(status)).toThrow(PAYMENT_STATUS_LOCKED_MESSAGE);
  });
});
