import { describe, expect, it } from "vitest";
import type { AdminReportData } from "@/lib/admin/types";
import { productReportCsv } from "./csv";

const report: AdminReportData = {
  from: "2026-07-01",
  to: "2026-07-31",
  status: "FULFILLED",
  categoryId: "",
  fulfillment: "ALL",
  payment: "ALL",
  group: "day",
  metrics: { revenue: 0, orderCount: 0, averageOrderValue: 0, fulfilledOrders: 0, cancelledOrders: 0, deliveryOrders: 0, pickupOrders: 0, registeredCustomers: 0, newCustomers: 0, returningCustomers: 0, abandonedCarts: 0 },
  salesSeries: [], categories: [], customers: [], insights: [],
  products: [{ id: "1", sku: "+FORMULA", nameAr: "=صيغة", nameEn: "=formula", units: 1, revenue: 12, views: 3, wishlists: 2, cartAdds: 1, stock: 4 }],
};

describe("product report CSV", () => {
  it("includes a UTF-8 BOM and neutralizes spreadsheet formulas", () => {
    const csv = productReportCsv(report, "en");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'+FORMULA\"");
    expect(csv).toContain("\"'=formula\"");
  });
});
