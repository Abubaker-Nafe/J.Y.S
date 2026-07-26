import { describe, expect, it } from "vitest";
import type { AdminReportData } from "@/lib/admin/types";
import { reportCsv, reportCsvTypes } from "./csv";

const report: AdminReportData = {
  from: "2026-07-01",
  to: "2026-07-31",
  status: "FULFILLED",
  categoryId: "",
  fulfillment: "ALL",
  payment: "ALL",
  paymentStatus: "ALL",
  group: "day",
  metrics: { revenue: 12, orderCount: 1, averageOrderValue: 12, fulfilledOrders: 1, deliveredOrders: 1, collectedOrders: 0, cancelledOrders: 0, deliveryOrders: 1, pickupOrders: 0, registeredCustomers: 1, newCustomers: 1, returningCustomers: 0, abandonedCarts: 0 },
  salesSeries: [{ period: "07-01", orders: 1, revenue: 12 }],
  orders: [{ orderNumber: "JYS-1", createdAt: "2026-07-01T10:00:00.000Z", customerName: "عميل", customerEmail: "customer@example.com", customerPhone: "+970500000000", fulfillmentMethod: "DELIVERY", paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PAID", status: "DELIVERED", currency: "ILS", subtotal: 10, deliveryFee: 2, total: 12, itemCount: 1 }],
  categories: [],
  customers: [{ id: "c1", name: "عميل", email: "customer@example.com", phone: "+970500000000", cityAr: "رام الله", cityEn: "Ramallah", orderCount: 1, spending: 12, joinedAt: "2026-07-01T00:00:00.000Z", lastOrderAt: "2026-07-01T10:00:00.000Z" }],
  insights: [],
  products: [{ id: "1", sku: "+FORMULA", nameAr: "=صيغة", nameEn: "=formula", units: 1, revenue: 12, views: 3, wishlists: 2, cartAdds: 1, stock: 4, lowStockThreshold: 5, categoryAr: "حلاقة", categoryEn: "Shaving", active: true, available: true }],
};

describe("report CSV exports", () => {
  it("builds all required report types with UTF-8 Arabic", () => {
    for (const type of reportCsvTypes) {
      const output = reportCsv(report, "ar", type);
      expect(output.startsWith("\uFEFF")).toBe(true);
      expect(output).toContain("\"");
    }
    expect(reportCsv(report, "ar", "customers")).toContain("عميل");
  });

  it("neutralizes spreadsheet formulas", () => {
    const output = reportCsv(report, "en", "products");
    expect(output).toContain("\"'+FORMULA\"");
    expect(output).toContain("\"'=formula\"");
  });
});
