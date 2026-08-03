import { describe, expect, it } from "vitest";
import { calculateOrderTotals, minorToMoney, moneyToMinor } from "@/lib/domain/money";

describe("money and order totals", () => {
  it("calculates exact totals without floating-point drift", () => {
    const totals = calculateOrderTotals(
      [
        { unitPriceMinor: moneyToMinor("39.00"), quantity: 2 },
        { unitPriceMinor: moneyToMinor("18.50"), quantity: 3 },
      ],
    );
    expect(totals).toEqual({ subtotalMinor: 13_350, totalMinor: 13_350 });
    expect(minorToMoney(totals.totalMinor)).toBe("133.50");
  });

  it("keeps the order total equal to product line totals", () => {
    expect(calculateOrderTotals([{ unitPriceMinor: 2_500, quantity: 2 }]).totalMinor).toBe(5_000);
  });

  it("rejects negative or malformed totals", () => {
    expect(() => calculateOrderTotals([{ unitPriceMinor: -1, quantity: 1 }])).toThrow();
    expect(() => moneyToMinor("1.999")).toThrow();
  });
});

