import { describe, expect, it } from "vitest";
import { normalizeCatalogSort, parseCatalogUrlState } from "./query";

describe("catalog URL query", () => {
  it("normalizes filters and legacy API sort names", () => {
    expect(parseCatalogUrlState({ page: "3", q: "  clipper  ", category: "tools", available: "true", sort: "price-desc" })).toEqual({
      page: 3,
      q: "clipper",
      category: "tools",
      available: true,
      sort: "high",
    });
    expect(normalizeCatalogSort("price-asc")).toBe("low");
  });

  it("uses safe defaults and supports escaping a category route filter", () => {
    expect(parseCatalogUrlState({ page: "-9", available: "yes", sort: "unknown" }, "beard-care")).toMatchObject({ page: 1, category: "beard-care", available: false, sort: "featured" });
    expect(parseCatalogUrlState({ category: "all" }, "beard-care").category).toBe("");
  });
});
