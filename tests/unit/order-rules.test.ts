import { describe, expect, it } from "vitest";
import { allowedOrderTransitions, assertOrderTransition, canTransitionOrder } from "@/lib/domain/order-rules";

describe("order status transitions", () => {
  it("supports the complete delivery workflow", () => {
    expect(allowedOrderTransitions("DELIVERY", "PREPARING")).toContain("READY_FOR_DELIVERY");
    expect(canTransitionOrder("DELIVERY", "READY_FOR_DELIVERY", "SENT_TO_DELIVERY_COMPANY")).toBe(
      true,
    );
    expect(canTransitionOrder("DELIVERY", "SENT_TO_DELIVERY_COMPANY", "DELIVERED")).toBe(true);
  });

  it("supports pickup without delivery-only states", () => {
    expect(canTransitionOrder("PICKUP", "PREPARING", "READY_FOR_PICKUP")).toBe(true);
    expect(canTransitionOrder("PICKUP", "PREPARING", "READY_FOR_DELIVERY")).toBe(false);
    expect(() => assertOrderTransition("PICKUP", "NEW", "COLLECTED")).toThrow();
  });

  it("treats repeated requests for the current state as idempotent", () => {
    expect(canTransitionOrder("DELIVERY", "CONFIRMED", "CONFIRMED")).toBe(true);
  });
});

