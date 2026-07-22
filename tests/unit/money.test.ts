import { describe, expect, it } from "vitest";
import { calculateOrderTotals, minorToMoney, moneyToMinor } from "@/lib/domain/money";
import { calculateDeliveryFee } from "@/lib/domain/delivery";

describe("money and order totals", () => {
  it("calculates exact totals without floating-point drift", () => {
    const totals = calculateOrderTotals(
      [
        { unitPriceMinor: moneyToMinor("39.00"), quantity: 2 },
        { unitPriceMinor: moneyToMinor("18.50"), quantity: 3 },
      ],
      moneyToMinor("15.00"),
    );
    expect(totals).toEqual({ subtotalMinor: 13_350, deliveryFeeMinor: 1_500, totalMinor: 14_850 });
    expect(minorToMoney(totals.totalMinor)).toBe("148.50");
  });

  it("uses an area fee override for delivery", () => {
    expect(
      calculateDeliveryFee({ fulfillmentMethod: "DELIVERY", cityFee: "25.00", areaFee: "20.00" }),
    ).toBe(2_000);
  });

  it("never charges delivery for pickup", () => {
    expect(calculateDeliveryFee({ fulfillmentMethod: "PICKUP", cityFee: "25.00" })).toBe(0);
  });

  it("rejects negative or malformed totals", () => {
    expect(() => calculateOrderTotals([{ unitPriceMinor: -1, quantity: 1 }], 0)).toThrow();
    expect(() => moneyToMinor("1.999")).toThrow();
  });
});

