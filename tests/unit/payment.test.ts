import { describe, expect, it } from "vitest";
import { assertPaymentStatusTransition } from "@/lib/domain/payment";

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
});
