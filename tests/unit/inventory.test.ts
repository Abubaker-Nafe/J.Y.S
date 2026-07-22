import { describe, expect, it } from "vitest";
import { applyInventoryDelta, inventoryActionForTransition } from "@/lib/domain/inventory";

describe("inventory mutation rules", () => {
  it("deducts stock once on confirmation", () => {
    const initial = { deducted: false, restored: false };
    expect(inventoryActionForTransition(initial, "CONFIRMED")).toBe("DEDUCT");
    expect(inventoryActionForTransition({ deducted: true, restored: false }, "CONFIRMED")).toBe("NONE");
    expect(applyInventoryDelta(10, -3)).toBe(7);
  });

  it("restores previously deducted stock once on cancellation", () => {
    expect(inventoryActionForTransition({ deducted: true, restored: false }, "CANCELLED")).toBe(
      "RESTORE",
    );
    expect(inventoryActionForTransition({ deducted: true, restored: true }, "CANCELLED")).toBe(
      "NONE",
    );
    expect(inventoryActionForTransition({ deducted: false, restored: false }, "CANCELLED")).toBe(
      "NONE",
    );
    expect(applyInventoryDelta(7, 3)).toBe(10);
  });

  it("prevents overselling", () => {
    expect(() => applyInventoryDelta(2, -3)).toThrow("Insufficient stock");
  });
});

